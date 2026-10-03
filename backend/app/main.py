import json
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from backend.app.config import ALLOWED_ORIGINS, APP_HOST, APP_PORT, CHAT_PROVIDER, OLLAMA_MODEL
from backend.app.database import init_db
from backend.app.schemas import ArtifactCreate, ChatRequest, ProjectCreate
from backend.app.services.ollama_service import generate_chat_response, model_status, stream_chat_response
from backend.app.services.project_service import build_project_context, create_artifact, create_project, export_project, get_project, get_projects, list_artifacts, list_messages, save_message, set_demo_seed, update_artifact, validate_artifact_content
from backend.app.services.rag_service import extract_text_from_file, list_documents, search_documents, tag_document

app = FastAPI(title="Lifecycle Mentor", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    init_db()
    # Seed a demo project if no projects exist yet.
    if not get_projects():
        set_demo_seed()


@app.get("/api/health")
def health_check() -> dict:
    return {
        "status": "ok",
        "mode": "local",
        "chat_provider": CHAT_PROVIDER,
        "ollama_model": OLLAMA_MODEL,
    }


@app.get("/api/projects")
def list_projects() -> list[dict]:
    return get_projects()


@app.post("/api/projects")
def create_new_project(payload: ProjectCreate) -> dict:
    project = create_project(payload.model_dump())
    return project


@app.get("/api/projects/{project_id}")
def get_project_by_id(project_id: str) -> dict:
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")
    project["messages"] = list_messages(project_id)
    project["artifacts"] = list_artifacts(project_id)
    project["documents"] = list_documents(project_id)
    return project


@app.post("/api/projects/{project_id}/artifacts")
def create_project_artifact(project_id: str, payload: ArtifactCreate) -> dict:
    valid, error = validate_artifact_content(payload.model_dump())
    if not valid:
        raise HTTPException(status_code=400, detail=error)
    artifact = create_artifact(project_id, payload.model_dump())
    return artifact


@app.get("/api/projects/{project_id}/artifacts")
def get_project_artifacts(project_id: str) -> list[dict]:
    return list_artifacts(project_id)


@app.put("/api/projects/{project_id}/artifacts/{artifact_id}")
def edit_project_artifact(project_id: str, artifact_id: str, payload: ArtifactCreate) -> dict:
    valid, error = validate_artifact_content(payload.model_dump())
    if not valid:
        raise HTTPException(status_code=400, detail=error)
    try:
        return update_artifact(project_id, artifact_id, payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/projects/{project_id}/export")
def export_project_json(project_id: str, format: str = "markdown") -> dict:
    if format not in {"markdown", "json"}:
        raise HTTPException(status_code=400, detail="Formato inválido. Use markdown ou json.")
    if not get_project(project_id):
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")
    return {"project_id": project_id, "format": format, "content": export_project(project_id, fmt=format)}


@app.post("/api/projects/{project_id}/chat")
def chat_with_project(project_id: str, payload: ChatRequest) -> dict:
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")
    project_context = build_project_context(project_id)
    docs = search_documents(project_id, payload.message, top_k=4)
    sources = "\n\n".join(
        f"[{doc['content'][:350]}]" for doc in docs if doc.get("content")
    )
    assistant_message = generate_chat_response(project_context, payload.message, payload.mode, sources)
    save_message(project_id, "user", payload.message, payload.mode)
    save_message(project_id, "assistant", assistant_message["answer"], payload.mode)
    return {
        "answer": assistant_message["answer"],
        "mode": payload.mode,
        "project_id": project_id,
        "sources": [
            {
                "title": "Documento recuperado",
                "snippet": item.get("content", "")[:300],
            }
            for item in docs
        ],
    }


@app.get("/api/projects/{project_id}/chat/stream")
def chat_stream(project_id: str, message: str, mode: str = "Aprender") -> StreamingResponse:
    project = get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")
    project_context = build_project_context(project_id)
    docs = search_documents(project_id, message, top_k=4)
    sources = "\n\n".join(
        f"[{doc['content'][:350]}]" for doc in docs if doc.get("content")
    )
    words = stream_chat_response(project_context, message, mode, sources)

    def generate() -> str:
        for chunk in words:
            yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.post("/api/documents/upload")
async def upload_document(file: UploadFile = File(...), project_id: str = "", title: str = "", doc_type: str = "didatico") -> dict:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")
    base_dir = Path(__file__).resolve().parents[1] / "uploads"
    base_dir.mkdir(parents=True, exist_ok=True)
    safe_name = file.filename.replace("..", "")
    destination = base_dir / safe_name
    content = await file.read()
    destination.write_bytes(content)
    raw_text, issue, warning = extract_text_from_file(str(destination))
    if not raw_text.strip():
        return {
            "status": "warning",
            "message": warning or "Arquivo sem texto útil. Necessita de OCR ou conversão.",
            "title": title or safe_name,
        }
    doc = tag_document(project_id or None, title or safe_name, doc_type, raw_text, str(destination))
    return {"status": "ok", "document": doc, "issue": issue, "warning": warning}


@app.get("/api/documents")
def list_all_documents() -> list[dict]:
    return list_documents()


@app.get("/api/search")
def search_for_documents(project_id=None, query: str = "") -> list[dict]:
    return search_documents(project_id, query, top_k=5)


@app.get("/api/ollama/status")
def get_status() -> dict:
    return model_status()


@app.post("/api/ollama/test")
def test_ollama() -> dict:
    ok, reason = model_status()["available"], model_status()["reason"]
    return {"available": ok, "reason": reason}


@app.get("/api/demo")
def demo_project() -> dict:
    if not get_projects():
        demo = set_demo_seed()
        return {"project": demo}
    return {"project": get_projects()[0]}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.app.main:app", host=APP_HOST, port=APP_PORT, reload=True)
