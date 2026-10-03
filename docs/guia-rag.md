# Guia de RAG local

## Pipeline

1. Inserir texto em TXT, MD ou PDF textual.
2. Validar se há texto útil.
3. Dividir em chunks.
4. Gerar embeddings locais via Ollama.
5. Persistir no SQLite.
6. Recuperar por projeto e por pergunta.

## Boas práticas

- Separe documentos didáticos gerais dos documentos de projeto.
- Evite recuperação cruzada entre projetos.
- Exiba referências verificáveis com trecho e metadados.
- Quando o arquivo estiver vazio, informe que ele precisa de OCR ou conversão.

## Limitações

- Esta implementação não inventa páginas ou referências; quando não houver texto util, o sistema registra a necessidade de OCR.
- O ambiente local deve ter o Ollama funcionando para embeddings e inferência.
