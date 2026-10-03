# Guia de treinamento

## Modelo base

A escolha recomendada deve priorizar:

- qualidade em português
- licença permissiva e redistribuição viável
- suporte ao MLX-LM
- suporte a exportação para GGUF e execução no Ollama
- memória compatível com hardware local

Para o piloto, a estratégia mais segura é começar com um modelo pequeno de 4B a 8B, evitar exigir uma arquitetura incompatível e manter um caminho documental para GPU remota.

## Pipeline

1. Preparar dataset.
2. Confirmar suporte do modelo base.
3. Executar treino LoRA em ambiente local Apple Silicon.
4. Registrar seed, hiperparâmetros e checkpoints.
5. Validar inferência e exportar artefatos.

## Limitações

- o treinamento real não é disparado automaticamente
- uma máquina sem suporte MLX não consegue executar esse passo localmente
- se necessário, use GPU remota com configuração e licença próprias
