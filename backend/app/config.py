import os
import platform
from importlib.util import find_spec
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

APP_ENV = os.getenv("APP_ENV", "development")
APP_HOST = os.getenv("APP_HOST", "0.0.0.0")
APP_PORT = int(os.getenv("APP_PORT", "8000"))
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///data/lifecycle_mentor.db")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b-instruct-q8_0")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")
CHAT_PROVIDER_SETTING = os.getenv("CHAT_PROVIDER", "auto").strip().lower()
MLX_MODEL = os.getenv("MLX_MODEL", "mlx-community/Qwen2.5-7B-Instruct-4bit")
MLX_ADAPTER_REPO = os.getenv("MLX_ADAPTER_REPO", "tadrianonet/lifecycle-mentor")
MLX_ADAPTER_PATH = os.getenv("MLX_ADAPTER_PATH", "").strip()
MLX_MAX_TOKENS = int(os.getenv("MLX_MAX_TOKENS", "512"))
MLX_RUNTIME_AVAILABLE = (
	platform.system() == "Darwin"
	and platform.machine() == "arm64"
	and find_spec("mlx_lm") is not None
)
CHAT_PROVIDER = (
    "mlx" if CHAT_PROVIDER_SETTING == "auto" and MLX_RUNTIME_AVAILABLE
    else "ollama" if CHAT_PROVIDER_SETTING == "auto"
    else CHAT_PROVIDER_SETTING
)
PROJECT_CONTEXT_LIMIT = int(os.getenv("PROJECT_CONTEXT_LIMIT", "12000"))
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
