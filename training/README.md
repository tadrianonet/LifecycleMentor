# Treinamento LoRA com MLX-LM

O pipeline treina um adaptador experimental no Apple Silicon, avalia um holdout e permite publicar apenas o adaptador no Hugging Face. O modelo-base não é copiado para o repositório do adaptador.

## Requisitos

- macOS em Apple Silicon, Python 3.11+
- MLX-LM instalado no `.venv` do projeto (`python -m pip install mlx-lm`)
- Hugging Face token com permissão de escrita somente para publicar
- `HF_MODEL_REPO` em `.env` deve ser um identificador `usuario/nome`, não o valor de exemplo

## Execução

```bash
cd /Users/tadriano/Documents/treinamento-itau/LifecycleMentor
source .venv/bin/activate
python training/prepare_dataset.py
PYTHONPATH=. python training/train_lora.py
PYTHONPATH=. python training/evaluate_model.py
```

O treino local usa o checkpoint `mlx-community/Qwen2.5-7B-Instruct-4bit`, 20 passos, quatro camadas e batch 1. O dataset atual tem seis exemplos fictícios revisados: 4 treino, 1 validação e 1 teste. Isso permite verificar o pipeline, mas é insuficiente para concluir que o modelo é útil, robusto ou seguro em produção.

## Publicação pública

O token deve ficar somente no `.env` em `HF_TOKEN`. Nunca o cole no código, linha de comando, log ou chat. Revogue qualquer token que tenha sido exposto fora do arquivo de segredo.

O destino padrão do piloto é `tadrianonet/lifecycle-mentor`. Confirme o identificador e execute explicitamente:

```bash
PYTHONPATH=. python training/publish_model.py --confirm-public
```

O comando valida o usuário autenticado, o adaptador final e sua configuração. Envia apenas `adapters.safetensors`, `adapter_config.json` e `README.md`; não publica o dataset, logs ou checkpoints intermediários.

## Artefatos

- Adaptador: `training/exports/lifecycle-mentor-adapter/`
- Partições do dataset: `datasets/train.jsonl`, `datasets/valid.jsonl`, `datasets/test.jsonl`
- Métricas do treino e teste: saída do terminal; registre-as em um relatório versionado antes de divulgar alegações de desempenho
