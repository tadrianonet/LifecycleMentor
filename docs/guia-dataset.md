# Guia de dataset

## Objetivo

Preparar um conjunto de exemplos de conversa para treino de um modelo orientado a educação em produto e software.

## Estrutura

Os exemplos devem seguir o schema em datasets/schema.json e incluir:

- cenário
- projeto
- instrução
- resposta
- metadados com modelo, etapa, licença e revisão humana

## Regras

- não usar conversas de alunos por padrão
- separar treino, validação e teste
- marcar dados fictícios e uma amostra como demonstração inicial
- manter dados de cenário/projeto separados para reduzir vazamento
- registrar provenance e licença

## Validação

O script training/prepare_dataset.py valida campos mínimos e separa o conjunto em arquivos JSONL por divisão.
