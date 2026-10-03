# Fluxograma da aplicação

```mermaid
flowchart TD
    A[Usuário acessa frontend] --> B[Cria ou seleciona projeto]
    B --> C[Contexto do projeto e etapas PDLC/SDLC]
    C --> D[Upload de documentos]
    D --> E[Indexação local e RAG]
    C --> F[Criação de artefatos]
    F --> G[Exportação markdown/json]
    C --> H[Chat em modo Aprender/Construir/Revisar]
    H --> I[Assistente responde com contexto e fontes]
    I --> J[Persistência em SQLite]
    J --> K[Revisão e evolução do projeto]

    subgraph Local
        D
        E
        J
        G
    end

    subgraph IA
        H
        I
    end
