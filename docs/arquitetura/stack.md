# Stack e dependências

## Frontend

- React 18+
- TypeScript
- Vite
- CSS moderno com componentes em painel

## Backend

- Python 3.11 (recomendado)
- FastAPI
- Uvicorn
- SQLite
- Pydantic
- Python Multipart

## Infra local

- Ollama para execução local de modelos de linguagem
- Arquivos em disco para uploads e documentos indexados
- Variáveis de ambiente em `.env`

## Dependências principais

- fastapi==0.115.0
- uvicorn==0.30.6
- pydantic==2.9.2
- httpx==0.27.2
- python-dotenv==1.0.1
- python-multipart==0.0.1
- pypdf==5.4.0
- pytest==8.3.3
- pytest-asyncio==0.24.0

## Observações

- O ambiente recomendado é Python 3.11 ou 3.12.
- Python 3.14 não é compatível com a stack atual do backend.
- O uso do Ollama é opcional para o MVP, mas recomendado para experiência completa.
