# Roteiro de testes funcionais do Lifecycle Mentor

## 1. Preparação

1. Ative o ambiente virtual do projeto:
   ```bash
   cd /Users/tadriano/Documents/treinamento-itau/LifecycleMentor
   source .venv/bin/activate
   ```
2. Inicie o backend:
   ```bash
   PYTHONPATH=. python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
3. Inicie o frontend:
   ```bash
   cd frontend
   npm install
   npm run dev -- --host 0.0.0.0 --port 5173
   ```
4. Acesse: http://localhost:5173

## 2. Testes via frontend

### Cenário A: criar projeto
- Abra a tela principal.
- Use como base o projeto: "PulsoNexo — Métricas de treino com integração Polar".
- Preencha nome, descrição, audiência, problema, restrições e objetivo de aprendizagem com os dados do cenário abaixo.
- Clique em "Criar projeto".
- Confirme que o projeto aparece na lista lateral.

Payload recomendado:

```json
{
  "name": "PulsoNexo — Métricas de treino com integração Polar",
  "description": "Sistema que integra dados do Polar para acompanhar treinos de jiu-jítsu, musculação e corrida. Apresenta frequência cardíaca, zonas de intensidade, duração e volume semanal em um dashboard, com resumos apoiados por IA. O projeto registra a investigação da necessidade antes da implementação e acompanha sua evolução pelo PDLC e SDLC.",
  "audience": "Praticantes de atividades físicas que utilizam dispositivos Polar e desejam compreender suas métricas e acompanhar a evolução dos treinos.",
  "problem": "Na minha rotina de treinos, surgiu a necessidade de reunir e interpretar os dados registrados pelo Polar Verity Sense. O projeto investiga como transformar frequência cardíaca, intensidade e volume de treino em informações claras para acompanhar minha evolução. A experiência pessoal representa o ponto de partida; a utilidade para outros atletas deve ser validada com usuários.",
  "constraints": "Integração com Polar AccessLink e autorização do usuário. Disponibilidade de métricas conforme dispositivo e dados fornecidos pela API. O Verity Sense não deve ser tratado como fonte de passos ou análise de sono. Proteção dos tokens e isolamento dos dados por usuário. MVP focado em sincronização de treinos, dashboard e acompanhamento semanal. Insights de IA devem explicar os dados sem oferecer diagnósticos médicos.",
  "learning_objective": "Aplicar PDLC e SDLC ao PulsoNexo: registrar o problema observado, as hipóteses e as evidências coletadas antes da construção; justificar o escopo do MVP; definir requisitos e arquitetura; testar a integração com o Polar; e avaliar se o dashboard ajuda os usuários a compreender suas métricas de treino."
}
```

### Cenário B: validar chat
- Selecione o projeto recém-criado.
- Escreva uma pergunta como: "Qual é o próximo passo importante para este projeto?"
- Escolha o modo Aprender, Construir ou Revisar.
- Verifique se a resposta é exibida no painel.

### Cenário C: criar artefato
- Preencha nome do artefato, tipo e conteúdo completo.
- Clique em "Salvar artefato".
- Confirme que ele aparece na lista de artefatos com versão 1.

### Cenário D: exportar projeto
- Clique em "Exportar Markdown".
- Confirme que a operação não falha.
- Repetir para JSON.

### Cenário E: upload de documento
- Envie um arquivo txt ou md simples.
- Verifique que o documento aparece na biblioteca de documentos.
- Faça uma busca por palavra-chave relevante.

## 3. Testes via API

Use o arquivo [api-tests.http](../api-tests.http) ou os comandos abaixo.

### Verificação de saúde
```bash
curl http://localhost:8000/api/health
```

### Criação de projeto
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

### Criação de artefato válido
```bash
curl -s -X POST http://localhost:8000/api/projects/<PROJECT_ID>/artifacts \
  -H 'Content-Type: application/json' \
  -d '{
    "name":"Hipótese inicial",
    "kind":"Registro de hipóteses",
    "content":"A hipótese principal é que a proposta de valor melhora a compreensão da jornada do usuário e reduz a fricção operacional em relação ao modelo atual de anotações e planilhas manuais."
  }'
```

### Criação de artefato inválido
```bash
curl -s -X POST http://localhost:8000/api/projects/<PROJECT_ID>/artifacts \
  -H 'Content-Type: application/json' \
  -d '{
    "name":"Artefato inválido",
    "kind":"Definição do problema",
    "content":"curto"
  }'
```

### Chat em modo Aprender
```bash
curl -s -X POST http://localhost:8000/api/projects/<PROJECT_ID>/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "message":"Explique a hipótese principal do produto e qual problema ele resolve.",
    "mode":"Aprender"
  }'
```

### Exportação
```bash
curl -s "http://localhost:8000/api/projects/<PROJECT_ID>/export?format=markdown"
```

## 4. Critérios de sucesso

- O projeto pode ser criado e listado.
- O artefato válido é aceito.
- O artefato inválido é rejeitado com erro 400.
- O chat responde em todos os modos.
- A exportação retorna conteúdo válido.
- A aplicação permanece estável durante o fluxo principal.

## 5. Observações importantes

- O backend precisa estar rodando antes dos testes.
- O uso de Ollama melhora a qualidade da resposta, mas o sistema já possui fallback funcional.
- O ambiente recomendado continua sendo Python 3.11 ou 3.12.
