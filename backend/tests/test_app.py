from pathlib import Path

from backend.app.services.project_service import build_project_context, create_project, validate_artifact_content
from backend.app.services.rag_service import split_text_to_chunks

SYSTEM_PROMPT = Path(__file__).resolve().parents[1] / "app" / "prompts" / "system_prompt.md"


def test_system_prompt_mentions_required_behaviors() -> None:
    text = SYSTEM_PROMPT.read_text(encoding="utf-8")
    assert "Aprender" in text
    assert "Construir" in text
    assert "Revisar" in text
    assert "até três perguntas" in text.lower()
    assert "não invente" in text.lower()


def test_validate_artifact_rejects_empty_content() -> None:
    ok, message = validate_artifact_content({"name": "X", "content": ""})
    assert ok is False
    assert "ao menos 10 caracteres" in message


def test_build_project_context_keeps_summary_compact() -> None:
    project = create_project(
        {
            "name": "Projeto teste",
            "description": "Projeto para testar contexto.",
            "audience": "Alunos",
            "problem": "Problema de aprendizagem",
            "constraints": "Tempo limitado",
            "learning_objective": "Aplicar conceitos",
        }
    )
    context = build_project_context(project["id"])
    assert "Projeto: Projeto teste" in context
    assert "Público: Alunos" in context
    assert len(context) < 10000


def test_chunking_preserves_text() -> None:
    text = "A " * 3000
    chunks = split_text_to_chunks(text, chunk_size=300, overlap=50)
    assert chunks
    assert all(len(chunk) > 0 for chunk in chunks)
