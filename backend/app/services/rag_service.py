import hashlib
import json
import uuid
from pathlib import Path

from pypdf import PdfReader

from backend.app.database import deserialize, get_connection, serialize
from backend.app.services.ollama_service import fetch_embedding


def _safe_text(raw: str) -> str:
    return (raw or "").replace("\x00", " ").strip()


def split_text_to_chunks(text: str, chunk_size: int = 600, overlap: int = 120) -> list[str]:
    if not text:
        return []
    text = _safe_text(text)
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk = text[start:end]
        if end < len(text):
            last_space = chunk.rfind(" ")
            if last_space > 0:
                end = start + last_space
                chunk = text[start:end]
        chunks.append(chunk.strip())
        start = max(start + len(chunk), end - overlap)
    return [chunk for chunk in chunks if chunk]


def extract_text_from_file(file_path: str) -> tuple[str, str, str]:
    path = Path(file_path)
    suffix = path.suffix.lower()
    if suffix in {".txt", ".md"}:
        text = path.read_text(encoding="utf-8", errors="ignore")
        return text, None, None
    if suffix == ".pdf":
        try:
            reader = PdfReader(str(path))
            pages = []
            for page in reader.pages:
                text = page.extract_text() or ""
                pages.append(text)
            return "\n\n".join(pages), None, None
        except Exception:
            return "", "pdf", "Texto extraído do PDF não foi encontrado. Considere OCR ou converter para texto simples."
    return "", suffix, "Arquivo sem texto útil. O conteúdo precisa de OCR ou conversão para TXT/MD antes do índice."


def tag_document(project_id, title: str, doc_type: str, content: str, source_path=None) -> dict:
    doc_id = str(uuid.uuid4())
    chunks = split_text_to_chunks(content)
    now = __import__("datetime").datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO documents (id, project_id, title, source_path, content, doc_type, metadata, created_at, chunk_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (doc_id, project_id, title, source_path, content, doc_type, serialize({"source": source_path or "", "embedding_version": "ollama:local-fallback"}), now, len(chunks)),
        )
        for index, chunk in enumerate(chunks):
            chunk_id = str(uuid.uuid4())
            embedding = fetch_embedding(chunk)
            conn.execute(
                "INSERT INTO document_chunks (id, document_id, project_id, section, page, content, embedding_version, embedding_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (chunk_id, doc_id, project_id, f"secao-{index + 1}", None, chunk, "ollama:local-fallback", json.dumps(embedding, ensure_ascii=False), now),
            )
        conn.commit()
    finally:
        conn.close()
    return {"id": doc_id, "title": title, "doc_type": doc_type, "chunk_count": len(chunks), "source_path": source_path}


def list_documents(project_id=None) -> list[dict]:
    conn = get_connection()
    try:
        if project_id:
            rows = conn.execute("SELECT * FROM documents WHERE project_id = ? ORDER BY created_at DESC", (project_id,)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM documents ORDER BY created_at DESC").fetchall()
    finally:
        conn.close()
    return [dict(row) | {"metadata": deserialize(row["metadata"])} for row in rows]


def search_documents(project_id, query: str, top_k: int = 5) -> list[dict]:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM document_chunks WHERE project_id IS ? AND project_id = ? ORDER BY created_at DESC",
            (None, project_id),
        ).fetchall()
        if not rows:
            rows = conn.execute(
                "SELECT * FROM document_chunks WHERE project_id IS NULL OR project_id = ? ORDER BY created_at DESC",
                (project_id,),
            ).fetchall()
    finally:
        conn.close()
    if not query:
        return [dict(row) for row in rows[:top_k]]
    filtered = []
    q = query.lower()
    for row in rows:
        score = 0
        content = row["content"].lower()
        score += content.count(q)
        if len(q.split()) > 1:
            score += sum(1 for token in q.split() if token in content)
        if score > 0:
            filtered.append((score, dict(row)))
    filtered.sort(key=lambda item: item[0], reverse=True)
    return [item[1] for item in filtered[:top_k]]


def document_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()
