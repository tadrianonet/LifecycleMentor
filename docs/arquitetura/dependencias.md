# Dependências e requisitos do projeto

## Requisitos de execução

- Python 3.11 ou 3.12
- Node 20+
- npm
- macOS ou ambiente Linux/WSL compatível
- Ollama instalado para uso completo do chat e embeddings

## Dependências do backend

- fastapi
- uvicorn
- pydantic
- httpx
- python-dotenv
- python-multipart
- pypdf
- pytest
- pytest-asyncio

## Dependências do frontend

- react
- react-dom
- vite
- typescript
- @types/react
- @types/react-dom

## Estrutura de armazenamento

- SQLite para projetos, mensagens e artefatos
- pasta `backend/uploads` para documentos enviados
- `datasets/` para preparação de treino, validação e modelagem
- `training/` para scripts de preparação e exportação

## Limites conhecidos

- Python 3.14 pode quebrar a instalação de dependências atuais.
- IA real depende de Ollama ou outro cliente local configurado.
- Treinamento local em MLX-LM é opcional e separado do fluxo principal.
