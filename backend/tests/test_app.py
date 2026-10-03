from pathlib import Path

from backend.app.services import ollama_service
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


def test_mlx_provider_uses_published_adapter(monkeypatch) -> None:
    captured_messages = []

    def fake_generate(messages):
        captured_messages.extend(messages)
        return "Resposta gerada pelo adaptador MLX."

    monkeypatch.setattr(ollama_service, "CHAT_PROVIDER", "mlx")
    monkeypatch.setattr(ollama_service, "_generate_mlx_response", fake_generate)

    result = ollama_service.generate_chat_response("Contexto PulsoNexo", "Explique a hipótese", "Aprender")

    assert result["answer"] == "Resposta gerada pelo adaptador MLX."
    assert captured_messages[0]["role"] == "system"
    assert "Aprender" in captured_messages[0]["content"]


def test_mlx_model_status_names_the_adapter(monkeypatch) -> None:
    monkeypatch.setattr(ollama_service, "CHAT_PROVIDER", "mlx")
    monkeypatch.setattr(ollama_service, "find_spec", lambda _: object())

    status = ollama_service.model_status()

    assert status["available"] is True
    assert status["provider"] == "mlx"
    assert status["model"] == "tadrianonet/lifecycle-mentor"


def test_ollama_can_be_selected_as_chat_provider(monkeypatch) -> None:
    class FakeResponse:
        status_code = 200

        @staticmethod
        def json():
            return {"message": {"content": "Resposta do Ollama."}}

    captured_payload = {}

    def fake_post(url, json, timeout):
        captured_payload.update(json)
        return FakeResponse()

    monkeypatch.setattr(ollama_service, "CHAT_PROVIDER", "ollama")
    monkeypatch.setattr(ollama_service.httpx, "post", fake_post)

    result = ollama_service.generate_chat_response("Contexto", "Pergunta", "Aprender")

    assert result["answer"] == "Resposta do Ollama."
    assert captured_payload["model"] == ollama_service.OLLAMA_MODEL
