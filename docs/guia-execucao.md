# Guia de execução da aplicação

## Backend

```bash
cd /caminho/para/LifecycleMentor
source .venv/bin/activate
PYTHONPATH=. uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Frontend

```bash
cd frontend
npm run dev -- --host 0.0.0.0 --port 5173
```

## Acesso

Abra http://localhost:5173 no navegador.

## Diagnóstico

```bash
python3 scripts/ollama_diagnostics.py
```

Se o Ollama não responder, verifique:

- serviço no host
- porta 11434 aberta
- modelo disponível com `ollama list`
- `.env` com a URL correta
