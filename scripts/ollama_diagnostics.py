#!/usr/bin/env python3
import json
import os

import httpx

OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")


def main() -> None:
    try:
        response = httpx.get(f"{OLLAMA_URL}/api/tags", timeout=10)
        payload = response.json()
        print(json.dumps({"status": response.status_code, "models": payload.get("models", [])}, ensure_ascii=False, indent=2))
    except Exception as exc:  # pragma: no cover
        print(json.dumps({"status": "error", "message": str(exc)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
