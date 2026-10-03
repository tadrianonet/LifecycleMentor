# Guia de instalação no Mac

## Pré-requisitos

- macOS recente
- Python 3.11 ou superior
- Node.js 20+
- Ollama instalado no host
- opcional: MLX-LM para treinamento local em Apple Silicon

## Instalação do Ollama

1. Acesse o site oficial do Ollama.
2. Instale o cliente e siga as instruções do host.
3. Confirme o serviço em http://localhost:11434.
4. Baixe um modelo de referência:

```bash
ollama pull llama3.2:3b-instruct-q8_0
```

## Instalação do projeto

```bash
cd /caminho/para/LifecycleMentor
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cp .env.example .env
```

## Configuração do frontend

```bash
cd frontend
npm install
```

## Observações

- Não coloque treinamento MLX em contêiner Linux como se o hardware Apple estivesse acessível.
- Todo o treinamento deve ser executado em ambiente local do host e documentado separadamente.
