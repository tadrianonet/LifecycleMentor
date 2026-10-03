export type Mode = 'Aprender' | 'Construir' | 'Revisar'
export type View = 'overview' | 'stages' | 'assistant' | 'artifacts' | 'documents' | 'settings'

export type Project = {
  id: string
  name: string
  description: string
  audience?: string | null
  problem?: string | null
  constraints?: string | null
  learning_objective?: string | null
  context_summary?: string | null
  project_data?: {
    stage_flow?: Array<{ id: string; name: string; category: string }>
  }
}

export type Message = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  mode: Mode
  created_at: string
}

export type Artifact = {
  id: string
  project_id: string
  name: string
  kind: string
  content: string
  version: number
  status: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type DocumentItem = {
  id: string
  title: string
  doc_type: string
  source_path?: string | null
  content?: string
  chunk_count?: number
  created_at?: string
}

export type SearchResult = {
  id: string
  document_id?: string | null
  content: string
  section?: string | null
  page?: number | null
}

export type ChatSource = {
  title: string
  snippet: string
}

export type Stage = {
  id: string
  name: string
  category: 'PDLC' | 'SDLC'
  meaning: string
  purpose: string
  deliverable: string
  questions: string[]
  artifactKind: string
}

export const stages: Stage[] = [
  {
    id: 'discovery',
    name: 'Descoberta do problema',
    category: 'PDLC',
    meaning: 'Delimitar uma situação real que merece ser compreendida antes de propor uma solução.',
    purpose: 'Evita começar pela funcionalidade e ajuda a separar observações de suposições.',
    deliverable: 'Definição do problema',
    artifactKind: 'Definição do problema',
    questions: ['O que acontece hoje e com quem?', 'Que evidências mostram que isso importa?', 'O que ainda é uma hipótese?'],
  },
  {
    id: 'research',
    name: 'Pesquisa e evidências',
    category: 'PDLC',
    meaning: 'Investigar o contexto, as alternativas atuais e as necessidades das pessoas envolvidas.',
    purpose: 'Reduz o risco de confundir uma experiência individual com uma necessidade compartilhada.',
    deliverable: 'Síntese de pesquisa e evidências',
    artifactKind: 'Síntese de pesquisa',
    questions: ['Como as pessoas resolvem isso hoje?', 'Que fontes sustentam a análise?', 'Que evidência poderia contradizer a hipótese?'],
  },
  {
    id: 'hypothesis',
    name: 'Hipóteses e validação',
    category: 'PDLC',
    meaning: 'Registrar suposições sobre problema, comportamento e resultado esperado de forma testável.',
    purpose: 'Torna explícito o que precisa ser aprendido antes de ampliar o investimento.',
    deliverable: 'Registro de hipóteses',
    artifactKind: 'Registro de hipóteses',
    questions: ['Qual comportamento esperamos observar?', 'Que resultado indicaria valor?', 'Qual é o teste mais simples e ético?'],
  },
  {
    id: 'value',
    name: 'Proposta de valor',
    category: 'PDLC',
    meaning: 'Explicar para quem o produto é útil, em qual situação e qual benefício pretende entregar.',
    purpose: 'Conecta a necessidade identificada à mudança desejada para o público.',
    deliverable: 'Proposta de valor',
    artifactKind: 'Proposta de valor',
    questions: ['Quem é o público prioritário?', 'Que tarefa ou necessidade está em foco?', 'Por que a proposta seria melhor que a alternativa atual?'],
  },
  {
    id: 'mvp',
    name: 'Definição e priorização do MVP',
    category: 'PDLC',
    meaning: 'Selecionar o menor conjunto de capacidades que permite testar uma hipótese relevante.',
    purpose: 'Mantém o escopo proporcional ao aprendizado que se busca obter.',
    deliverable: 'Escopo do MVP',
    artifactKind: 'Escopo do MVP',
    questions: ['Qual hipótese o MVP precisa testar?', 'O que fica explicitamente fora do escopo?', 'Como reconhecer um resultado útil sem prometer sucesso?'],
  },
  {
    id: 'launch',
    name: 'Lançamento e métricas',
    category: 'PDLC',
    meaning: 'Planejar como disponibilizar a solução e observar seu uso em condições definidas.',
    purpose: 'Ajuda a medir comportamento e resultado sem confundir atividade com impacto.',
    deliverable: 'Plano de lançamento e métricas',
    artifactKind: 'Plano de testes',
    questions: ['Quem participará do piloto?', 'Quais métricas respondem à hipótese?', 'Que limites de segurança e privacidade se aplicam?'],
  },
  {
    id: 'learning',
    name: 'Aprendizagem e evolução',
    category: 'PDLC',
    meaning: 'Comparar resultados observados com as hipóteses e decidir o que manter, mudar ou interromper.',
    purpose: 'Fecha o ciclo de produto com decisões apoiadas por evidências.',
    deliverable: 'Registro de aprendizados e decisões',
    artifactKind: 'Registro de aprendizados',
    questions: ['O que aprendemos com os dados?', 'Que hipótese foi enfraquecida?', 'Qual decisão decorre desse aprendizado?'],
  },
  {
    id: 'requirements',
    name: 'Requisitos',
    category: 'SDLC',
    meaning: 'Descrever comportamentos, restrições e critérios que a solução precisa respeitar.',
    purpose: 'Alinha as necessidades do produto com expectativas verificáveis de implementação.',
    deliverable: 'Requisitos e critérios de aceitação',
    artifactKind: 'Backlog',
    questions: ['Qual é o comportamento esperado?', 'Como será validado?', 'Quais requisitos de privacidade e acessibilidade se aplicam?'],
  },
  {
    id: 'design',
    name: 'Arquitetura e design',
    category: 'SDLC',
    meaning: 'Definir componentes, dados, integrações e decisões técnicas para atender aos requisitos.',
    purpose: 'Expõe riscos e compromissos antes da construção.',
    deliverable: 'Arquitetura e decisões técnicas',
    artifactKind: 'ADR',
    questions: ['Quais sistemas e dados estão envolvidos?', 'Como falhas e permissões serão tratados?', 'Que alternativas foram consideradas?'],
  },
  {
    id: 'implementation-plan',
    name: 'Planejamento da implementação',
    category: 'SDLC',
    meaning: 'Organizar trabalho, dependências, riscos e critérios de entrega em fatias verificáveis.',
    purpose: 'Facilita execução incremental e reavaliação frequente do escopo.',
    deliverable: 'Plano de implementação',
    artifactKind: 'Backlog',
    questions: ['Qual fatia vertical entrega valor primeiro?', 'Quais dependências podem bloquear o trabalho?', 'Como manter cada entrega testável?'],
  },
  {
    id: 'development',
    name: 'Desenvolvimento',
    category: 'SDLC',
    meaning: 'Implementar capacidades de acordo com requisitos e decisões técnicas registrados.',
    purpose: 'Transforma o escopo acordado em incrementos revisáveis e rastreáveis.',
    deliverable: 'Incremento implementado e revisado',
    artifactKind: 'Backlog',
    questions: ['Qual requisito este incremento atende?', 'Como o comportamento pode ser exercitado?', 'Que dados não devem aparecer em logs?'],
  },
  {
    id: 'testing',
    name: 'Testes',
    category: 'SDLC',
    meaning: 'Verificar requisitos, fluxos principais, falhas e critérios de qualidade definidos.',
    purpose: 'Dá confiança proporcional ao risco e revela regressões antes da publicação.',
    deliverable: 'Plano de testes e resultados observados',
    artifactKind: 'Plano de testes',
    questions: ['Quais cenários críticos precisam ser cobertos?', 'Que falhas são previsíveis?', 'Como registrar resultados reproduzíveis?'],
  },
  {
    id: 'publication',
    name: 'Publicação',
    category: 'SDLC',
    meaning: 'Preparar uma versão, configuração e comunicação adequadas para disponibilização.',
    purpose: 'Reduz riscos de configuração, acesso e reversão no momento da entrega.',
    deliverable: 'Checklist de publicação',
    artifactKind: 'Plano de testes',
    questions: ['Como validar a configuração do ambiente?', 'Como reverter uma publicação problemática?', 'Quem precisa ser informado?'],
  },
  {
    id: 'operations',
    name: 'Operação e manutenção',
    category: 'SDLC',
    meaning: 'Acompanhar o comportamento em uso, responder a incidentes e planejar manutenção.',
    purpose: 'Mantém segurança, disponibilidade e qualidade após a publicação.',
    deliverable: 'Plano operacional e de manutenção',
    artifactKind: 'Plano de testes',
    questions: ['Quais sinais indicam degradação?', 'Como usuários reportam problemas?', 'Como dados e integrações serão mantidos seguros?'],
  },
]

export const artifactKinds = [
  'Definição do problema',
  'Registro de hipóteses',
  'Proposta de valor',
  'Escopo do MVP',
  'Backlog',
  'ADR',
  'Plano de testes',
  'Síntese de pesquisa',
  'Registro de aprendizados',
]

export const pulsoNexoExample = {
  name: 'PulsoNexo — métricas de treino com integração Polar',
  description: 'Sistema integrado ao Polar para acompanhar frequência cardíaca, zonas de intensidade, duração e volume semanal dos treinos.',
  problem: 'A pessoa que treina precisa reunir e interpretar métricas registradas em sessões diferentes para acompanhar sua evolução. A experiência pessoal é um ponto de partida; a utilidade para outros atletas ainda precisa ser validada.',
  audience: 'Praticantes de atividades físicas que utilizam dispositivos Polar e desejam compreender suas métricas de treino.',
  hypotheses: ['Uma visão semanal ajuda a perceber mudanças de volume e intensidade.', 'Resumos explicativos tornam as métricas mais compreensíveis sem substituir orientação profissional.'],
  mvp: ['Autorização e sincronização de treinos via Polar AccessLink.', 'Dashboard semanal de frequência cardíaca, zonas e duração.', 'Resumo educativo, sem diagnóstico médico.'],
  requirements: ['Isolar dados por usuário e proteger tokens.', 'Exibir métricas apenas quando fornecidas pelo dispositivo/API.', 'Não inferir passos nem dados de sono do Verity Sense.'],
  decisions: ['Validar disponibilidade das métricas antes de fechar o modelo de dados.', 'Manter integração e resumos desacoplados para facilitar testes.'],
  tests: ['Validar autorização, sincronização e falhas da API.', 'Comparar os dados exibidos com sessões de origem autorizadas.', 'Investigar compreensão do dashboard com usuários.'],
}