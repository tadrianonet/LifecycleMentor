import json
from functools import lru_cache
from pathlib import Path
from threading import Lock
from importlib.util import find_spec

import httpx

from backend.app.config import (
    CHAT_PROVIDER,
    EMBEDDING_MODEL,
    MLX_ADAPTER_PATH,
    MLX_ADAPTER_REPO,
    MLX_MAX_TOKENS,
    MLX_MODEL,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
)

SYSTEM_PROMPT_PATH = Path(__file__).resolve().parents[1] / "prompts" / "system_prompt.md"
_mlx_load_lock = Lock()


def load_system_prompt() -> str:
    if SYSTEM_PROMPT_PATH.exists():
        return SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")
    return "Você é um assistente de apoio pedagógico..."


def ollama_available() -> tuple[bool, str]:
    try:
        response = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=6)
        if response.status_code == 200:
            data = response.json()
            models = [item.get("name") for item in data.get("models", [])]
            if models:
                return True, "OK"
            return False, "Ollama respondeu, mas não encontrou modelos disponíveis."
        return False, f"Ollama respondeu com status {response.status_code}."
    except Exception as exc:  # pragma: no cover - integration failure path
        return False, str(exc)


def model_status() -> dict:
    if CHAT_PROVIDER == "mlx":
        available = find_spec("mlx_lm") is not None
        return {
            "available": available,
            "provider": "mlx",
            "provider_label": "MLX · Lifecycle Mentor",
            "model": MLX_ADAPTER_REPO,
            "base_model": MLX_MODEL,
            "base_url": "Apple Silicon local",
            "reason": "O adaptador será carregado na primeira mensagem." if available else "mlx-lm não está instalado neste ambiente Apple Silicon.",
        }

    ok, reason = ollama_available()
    return {
        "available": ok,
        "provider": "ollama",
        "provider_label": "Ollama",
        "base_url": OLLAMA_BASE_URL,
        "model": OLLAMA_MODEL,
        "version": "not-queried",
        "reason": reason,
    }


def fetch_embedding(text: str, model: str = EMBEDDING_MODEL) -> list[float]:
    try:
        response = httpx.post(
            f"{OLLAMA_BASE_URL}/api/embed",
            json={"model": model, "input": text},
            timeout=30,
        )
        if response.status_code == 200:
            payload = response.json()
            data = payload.get("embeddings") or payload.get("embedding")
            if isinstance(data, list):
                if data and isinstance(data[0], list):
                    return data[0]
                return data
    except Exception:
        pass
    import hashlib

    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    vector = [float(int(digest[i : i + 2], 16)) / 255.0 for i in range(0, 32, 2)]
    return vector


def chat_messages_for_prompt(project_context: str, question: str, mode: str, sources: str = "") -> list[dict]:
    system_message = load_system_prompt().replace("{{MODE}}", mode).replace("{{PROJETO}}", project_context[:1500])
    user_message = f"Modo: {mode}\n\nPergunta: {question}\n\nFontes relevantes:\n{sources[:2000]}"
    return [
        {"role": "system", "content": system_message},
        {"role": "user", "content": user_message},
    ]


@lru_cache(maxsize=1)
def _load_mlx_components(base_model: str, adapter_repo: str, local_adapter_path: str):
    from huggingface_hub import snapshot_download
    from mlx_lm import load

    adapter_path = local_adapter_path
    if not adapter_path:
        adapter_path = snapshot_download(
            repo_id=adapter_repo,
            allow_patterns=["adapters.safetensors", "adapter_config.json"],
        )
    return load(base_model, adapter_path=adapter_path)


def _generate_mlx_response(messages: list[dict]) -> str:
    from mlx_lm import generate
    from mlx_lm.sample_utils import make_sampler

    with _mlx_load_lock:
        model, tokenizer = _load_mlx_components(MLX_MODEL, MLX_ADAPTER_REPO, MLX_ADAPTER_PATH)
        prompt = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
        return generate(
            model,
            tokenizer,
            prompt=prompt,
            max_tokens=MLX_MAX_TOKENS,
            sampler=make_sampler(temp=0.3, top_p=0.8),
            verbose=False,
        )


def generate_chat_response(project_context: str, question: str, mode: str, sources: str = "") -> dict:
    messages = chat_messages_for_prompt(project_context, question, mode, sources)
    if CHAT_PROVIDER == "mlx":
        try:
            answer = _generate_mlx_response(messages)
            if answer.strip():
                return {"answer": answer, "sources": []}
            raise RuntimeError("O adaptador MLX retornou uma resposta vazia.")
        except Exception as exc:  # pragma: no cover - requires Apple Silicon and model files
            return {
                "answer": (
                    "Não foi possível gerar uma resposta com o adaptador Lifecycle Mentor no MLX. "
                    f"Verifique o modelo, o adaptador e a memória disponível ({type(exc).__name__})."
                ),
                "sources": [],
            }

    payload = {
        "model": OLLAMA_MODEL,
        "stream": False,
        "messages": messages,
        "options": {"temperature": 0.3, "top_p": 0.8},
    }
    try:
        response = httpx.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload, timeout=60)
        if response.status_code != 200:
            return {
                "answer": (
                    "O servidor do Ollama respondeu com um erro."
                    f" Status {response.status_code}. A aplicação continuará em modo local e pedagógico."
                ),
                "sources": [],
            }
        data = response.json()
        content = data.get("message", {}).get("content")
        if content:
            return {"answer": content, "sources": []}
    except Exception as exc:  # pragma: no cover - integration failure path
        pass
    fallback = (
        f"Modo: {mode}.\n\n"
        f"Não houve resposta do Ollama no momento. Com base no contexto do projeto e nas regras pedagógicas, "
        f"recomendo focar em: identificar a hipótese, confirmar a evidência e validar o artefato antes de avançar."
    )
    return {"answer": fallback, "sources": []}


def stream_chat_response(project_context: str, question: str, mode: str, sources: str = "") -> list[str]:
    data = generate_chat_response(project_context, question, mode, sources)
    answer = data["answer"]
    chunks = answer.split()
    return chunks
