# Guia de exportação e publicação

## Exportação

1. Salvar adaptador e metadados.
2. Fundir o adaptador ao modelo base, quando suportado.
3. Converter para GGUF com um caminho compatível e verificado.
4. Quantizar em Q4_K_M como etapa inicial.
5. Validar inferência no Ollama.

## Publicação

- separar publicação do adaptador, do modelo completo e do GGUF
- ser cauteloso com licença do modelo base
- usar HF_TOKEN via variável de ambiente
- nunca publicar automaticamente
- manter dry-run explícito

## Limitações

- o download do modelo não inclui automaticamente a base RAG ou o estado dos projetos da aplicação
- o pipeline de exportação requer revisão e validação humana
