# Arquitetura do Lifecycle Mentor

## Visão geral

O Lifecycle Mentor é uma plataforma local de aprendizagem orientada por produto e software. O objetivo é guiar o usuário por um ciclo de PDLC e SDLC, com apoio de chat pedagógico, rastreabilidade de artefatos e recuperação de documentos locais.

## Componentes principais

- Frontend: React + TypeScript + Vite
- Backend: FastAPI + SQLite
- Motor de IA: Ollama local
- Armazenamento: SQLite + diretórios locais para upload
- RAG: indexação de documentos e busca textual por relevância
- Fluxo educacional: projetos, artefatos, mensagens e etapas de ciclo de vida

## Fluxo funcional

1. O usuário cria ou seleciona um projeto.
2. O sistema monta o contexto do projeto e os artefatos ligados ao ciclo.
3. O usuário pode enviar documentos locais para indexação.
4. O assistente responde em modo Aprender, Construir ou Revisar.
5. Artefatos e exportações ficam disponíveis para revisão e evolução.

## Objetivos de arquitetura

- Rodar localmente sem dependência crítica de serviços externos
- Focar em aprendizagem prática e progresso incremental
- Mantém persistência local para projetos, mensagens e artefatos
- Separar pipeline de treino/exportação do fluxo principal de uso
