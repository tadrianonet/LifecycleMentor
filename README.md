# Lifecycle Mentor

Lifecycle Mentor é uma plataforma educacional local para aprender PDLC e SDLC em projetos reais, com suporte a RAG local, chat com Ollama ou com o adaptador MLX publicado no Hugging Face, gestão de projetos e treinamento local.

## Visão geral

Este repositório organiza:

- frontend/: interface em React + TypeScript + Vite
- backend/: API em FastAPI com SQLite local
- knowledge/: documentos didáticos e exemplos fictícios
- datasets/: dados para fine-tuning, validação e avaliação
- training/: pipeline de preparação, treino e exportação
- evaluation/: casos e rubricas de avaliação
- scripts/: utilitários operacionais
- docs/: guias específicos de instalação e uso

## Requisitos mínimos

- macOS com Python 3.11 (recomendado) e Node 20+
- macOS Apple Silicon para usar o adaptador MLX publicado (ou Ollama como alternativa)
- Ollama opcional para embeddings e inferência alternativa
- uma pasta de trabalho para armazenar dados e documentos
- MLX-LM instalado no ambiente do projeto para inferência do adaptador treinado

> Importante: o projeto não foi validado com Python 3.14 em conjunto com as dependências atuais do backend. Use Python 3.11 ou 3.12 para evitar falhas de instalação.

O repositório público já contém o adaptador LoRA experimental do Lifecycle Mentor. Não é necessário treinar outro modelo para conversar com ele. Em Apple Silicon, `CHAT_PROVIDER=auto` seleciona MLX se `mlx-lm` estiver instalado; nos demais ambientes, seleciona Ollama.

## Inicialização rápida

1. Crie um ambiente virtual com Python 3.11:

   ```bash
   python3.11 -m venv .venv
   source .venv/bin/activate
   python -m pip install --upgrade pip
   python -m pip install -r backend/requirements.txt
   ```

   Para usar o adaptador MLX em Apple Silicon, instale também o runtime opcional:

   ```bash
   python -m pip install mlx-lm
   ```

2. Configure as variáveis de ambiente:

   ```bash
   cp .env.example .env
   ```

3. Inicie o backend:

   ```bash
   PYTHONPATH=. python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

4. Inicie o frontend:

   ```bash
   cd frontend
   npm install
   npm run dev -- --host 0.0.0.0 --port 5173
   ```

5. Acesse http://localhost:5173

## Modelo no Ollama

Ollama permanece disponível como provedor alternativo e é usado para embeddings quando disponível. Para selecionar explicitamente esse provedor, configure `CHAT_PROVIDER=ollama` no `.env`. Instale um modelo, por exemplo:

```bash
ollama pull llama3.2:3b-instruct-q8_0
```

O valor de `OLLAMA_MODEL` no `.env.example` é apenas uma referência; nomes de modelos podem variar.

## Adaptador MLX publicado

O chat pode usar o adaptador LoRA público [tadrianonet/lifecycle-mentor](https://huggingface.co/tadrianonet/lifecycle-mentor), treinado sobre [Qwen2.5-7B-Instruct-4bit da MLX Community](https://huggingface.co/mlx-community/Qwen2.5-7B-Instruct-4bit). Em Apple Silicon com `mlx-lm` instalado, a configuração padrão `CHAT_PROVIDER=auto` seleciona esse caminho. Também é possível escolher explicitamente com `CHAT_PROVIDER=mlx`.

Na primeira pergunta, o backend baixa o checkpoint MLX (aproximadamente 4,3 GB) e o pequeno adaptador para o cache do Hugging Face; execuções posteriores reutilizam os arquivos em cache. O repositório de pesos é público, portanto não é necessário criar nem configurar `HF_TOKEN` para inferência. Opcionalmente, `MLX_ADAPTER_PATH` aponta para uma cópia local do diretório do adaptador.

O repositório publicado contém somente o adaptador MLX, não o modelo-base completo. Esse formato não pode ser carregado diretamente pelo Ollama: o Ollama requer um artefato compatível, normalmente GGUF, após fusão/conversão. A configuração do projeto mantém Ollama como alternativa, sem afirmar compatibilidade entre os formatos.

O MLX atende ao chat; RAG/embeddings continua consultando Ollama quando disponível e usa o fallback local existente se Ollama não estiver rodando.

### Trocar o provedor

Edite `.env` e escolha uma destas opções:

```dotenv
CHAT_PROVIDER=auto
```

`auto` seleciona MLX em Apple Silicon quando o runtime está instalado e Ollama nos demais casos. Para fixar um provedor, use `CHAT_PROVIDER=mlx` ou `CHAT_PROVIDER=ollama`. Reinicie o backend após alterar essa configuração. A tela Configurações mostra o provedor selecionado e o estado reportado pelo backend.

## Rotina de teste funcional do PulsoNexo

Use esta rotina para validar o back e o front em sequência real de uso do produto.

### 1) Backend

```bash
cd /Users/tadriano/Documents/treinamento-itau/LifecycleMentor
source .venv/bin/activate
PYTHONPATH=. python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2) Frontend

```bash
cd /Users/tadriano/Documents/treinamento-itau/LifecycleMentor/frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

### 3) Teste de criação do projeto via API

```bash
curl -s -X POST http://localhost:8000/api/projects \
   -H 'Content-Type: application/json' \
   -d '{
      "name": "PulsoNexo — Métricas de treino com integração Polar",
      "description": "Sistema que integra dados do Polar para acompanhar treinos de jiu-jítsu, musculação e corrida. Apresenta frequência cardíaca, zonas de intensidade, duração e volume semanal em um dashboard, com resumos apoiados por IA. O projeto registra a investigação da necessidade antes da implementação e acompanha sua evolução pelo PDLC e SDLC.",
      "audience": "Praticantes de atividades físicas que utilizam dispositivos Polar e desejam compreender suas métricas e acompanhar a evolução dos treinos.",
      "problem": "Na minha rotina de treinos, surgiu a necessidade de reunir e interpretar os dados registrados pelo Polar Verity Sense. O projeto investiga como transformar frequência cardíaca, intensidade e volume de treino em informações claras para acompanhar minha evolução. A experiência pessoal representa o ponto de partida; a utilidade para outros atletas deve ser validada com usuários.",
      "constraints": "Integração com Polar AccessLink e autorização do usuário. Disponibilidade de métricas conforme dispositivo e dados fornecidos pela API. O Verity Sense não deve ser tratado como fonte de passos ou análise de sono. Proteção dos tokens e isolamento dos dados por usuário. MVP focado em sincronização de treinos, dashboard e acompanhamento semanal. Insights de IA devem explicar os dados sem oferecer diagnósticos médicos.",
      "learning_objective": "Aplicar PDLC e SDLC ao PulsoNexo: registrar o problema observado, as hipóteses e as evidências coletadas antes da construção; justificar o escopo do MVP; definir requisitos e arquitetura; testar a integração com o Polar; e avaliar se o dashboard ajuda os usuários a compreender suas métricas de treino."
   }'
```

### 4) Validação no frontend

1. Abra http://localhost:5173
2. Crie um projeto com os mesmos dados do payload acima.
3. Confirme que o projeto aparece na lista.
4. Selecione o projeto e envie uma pergunta no chat em modo Aprender, Construir ou Revisar.
5. Crie um artefato com conteúdo completo e valide a rejeição do conteúdo curto.
6. Exporte em Markdown e JSON.

### 5) Validação final

O fluxo principal está correto quando:

- o projeto é criado com sucesso;
- o projeto aparece no frontend;
- o chat responde sem erro;
- o artefato válido é salvo;
- o artefato inválido é rejeitado;
- a exportação funciona.

## Funcionalidades principais

- Criação e recuperação de projetos com contexto persistido
- Três modos do assistente: Aprender, Construir, Revisar
- RAG local com documentos em TXT/MD/PDF textual
- Gestão de artefatos e rastreabilidade por etapas
- Banco SQLite local
- Fluxo demonstrativo de jiu-jítsu
- Pipeline de dataset, avaliação e treinamento com documentação e limites explícitos
- Adaptador LoRA experimental no Hugging Face, utilizável localmente com MLX-LM

## Documentação adicional

- docs/guia-instalacao-mac.md
- docs/guia-execucao.md
- docs/guia-aluno.md
- docs/guia-professor.md
- docs/guia-rag.md
- docs/guia-dataset.md
- docs/guia-treinamento.md
- docs/guia-avaliacao.md
- docs/guia-exportacao-publicacao.md
- docs/projeto-demonstrativo.md

## Observações importantes

- A aplicação funciona localmente e não depende de serviços externos para o MVP.
- O provedor de chat pode ser MLX (adaptador Lifecycle Mentor) ou Ollama; embeddings usam Ollama quando disponível.
- O adaptador publicado é um piloto treinado com seis exemplos fictícios e não deve ser tratado como modelo validado para produção.
- Treinamento local com MLX-LM está disponível em `training/`; a execução do chat usa o adaptador já publicado e não dispara novo treinamento.
- O pipeline do dataset, treino e exportação é separado da aplicação principal para evitar poluir o fluxo de produção.
