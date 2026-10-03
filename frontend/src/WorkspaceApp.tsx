import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, FormEvent, KeyboardEvent, ReactNode, RefObject } from 'react'
import {
  Activity, ArrowDown, ArrowRight, BookOpen, Check, ChevronDown, ChevronRight,
  CircleHelp, FilePlus2, FileText, FolderOpen, HeartPulse, Layers3, Lightbulb,
  LoaderCircle, Menu, MessageSquareText, MoreHorizontal, PanelLeftClose,
  PanelLeftOpen, Plus, RefreshCw, Search, Send, Settings2, Sparkles, Upload, X,
} from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { artifactKinds, pulsoNexoExample, stages } from './domain'
import type { Artifact, ChatSource, DocumentItem, Message, Mode, Project, SearchResult, View } from './domain'
import { Button, Dialog, EmptyState, Field, IconButton, MarkdownContent, Notice } from './ui'
import './workspace.css'

type ApiIssue = { loc?: Array<string | number>; msg?: string }
type ApiErrorBody = { detail?: string | ApiIssue[] }
type ProviderStatus = { available: boolean; provider: 'mlx' | 'ollama'; provider_label: string; model: string; base_model?: string; base_url: string; reason?: string }
type ApiConnection = 'checking' | 'connected' | 'offline'
type ConnectionSnapshot = { api: ApiConnection; apiError: string; provider: ProviderStatus | null; providerError: string }
type ProjectForm = { name: string; description: string; audience: string; problem: string; constraints: string; learning_objective: string }
type ArtifactForm = { name: string; kind: string; content: string }
type UploadState = 'idle' | 'sending' | 'success' | 'warning' | 'error'

const emptyProjectForm: ProjectForm = { name: '', description: '', audience: '', problem: '', constraints: '', learning_objective: '' }
const emptyArtifactForm: ArtifactForm = { name: '', kind: 'Definição do problema', content: '' }
const viewLabels: Record<View, string> = { overview: 'Visão geral', stages: 'Etapas', assistant: 'Assistente', artifacts: 'Artefatos', documents: 'Documentos', settings: 'Configurações' }

class ApiError extends Error {
  readonly status: number
  readonly body: ApiErrorBody

  constructor(message: string, status: number, body: ApiErrorBody = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const raw = await response.text()
  let body: ApiErrorBody = {}
  if (raw) {
    try { body = JSON.parse(raw) as ApiErrorBody } catch { body = { detail: raw } }
  }
  if (!response.ok) {
    const detail = body.detail
    const message = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((issue) => issue.msg ?? 'Entrada inválida').join(' ') : `A solicitação falhou (${response.status}).`
    throw new ApiError(message, response.status, body)
  }
  return body as T
}

function jsonRequest(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

function getFieldErrors(error: unknown): Partial<Record<keyof ProjectForm, string>> {
  if (!(error instanceof ApiError) || !Array.isArray(error.body.detail)) return {}
  const errors: Partial<Record<keyof ProjectForm, string>> = {}
  for (const issue of error.body.detail) {
    const field = issue.loc?.at(-1)
    if (typeof field === 'string' && field in emptyProjectForm) errors[field as keyof ProjectForm] = issue.msg ?? 'Verifique este campo.'
  }
  return errors
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.'
}

function formatDate(value?: string) {
  if (!value) return 'Data indisponível'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Data indisponível' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date)
}

function relatedStage(kind: string) {
  return stages.find((stage) => stage.artifactKind === kind)
}

async function queryConnections(): Promise<ConnectionSnapshot> {
  const [apiResult, providerResult] = await Promise.allSettled([
    apiRequest<{ status: string }>('/api/health'),
    apiRequest<ProviderStatus>('/api/ollama/status'),
  ])
  const apiConnected = apiResult.status === 'fulfilled' && apiResult.value.status === 'ok'
  const provider = providerResult.status === 'fulfilled' ? providerResult.value : null
  return {
    api: apiConnected ? 'connected' : 'offline',
    apiError: apiConnected ? '' : apiResult.status === 'rejected' ? getErrorMessage(apiResult.reason) : 'A API respondeu com um estado inesperado.',
    provider,
    providerError: providerResult.status === 'rejected' ? getErrorMessage(providerResult.reason) : provider?.reason ?? '',
  }
}

function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [activeView, setActiveView] = useState<View>('overview')
  const [selectedStageId, setSelectedStageId] = useState('discovery')
  const [messages, setMessages] = useState<Message[]>([])
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [chatSources, setChatSources] = useState<ChatSource[]>([])
  const [chatMode, setChatMode] = useState<Mode>('Aprender')
  const [chatInput, setChatInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [isSavingArtifact, setIsSavingArtifact] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [artifactDialogOpen, setArtifactDialogOpen] = useState(false)
  const [projectForm, setProjectForm] = useState<ProjectForm>(emptyProjectForm)
  const [projectFieldErrors, setProjectFieldErrors] = useState<Partial<Record<keyof ProjectForm, string>>>({})
  const [projectFormError, setProjectFormError] = useState('')
  const [artifactForm, setArtifactForm] = useState<ArtifactForm>(emptyArtifactForm)
  const [artifactInitial, setArtifactInitial] = useState<ArtifactForm>(emptyArtifactForm)
  const [editingArtifactId, setEditingArtifactId] = useState<string | null>(null)
  const [artifactFormError, setArtifactFormError] = useState('')
  const [artifactQuery, setArtifactQuery] = useState('')
  const [documentQuery, setDocumentQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchMessage, setSearchMessage] = useState('')
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [uploadMessage, setUploadMessage] = useState('')
  const [retryFile, setRetryFile] = useState<File | null>(null)
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null)
  const [providerError, setProviderError] = useState('')
  const [apiConnection, setApiConnection] = useState<ApiConnection>('checking')
  const [apiConnectionError, setApiConnectionError] = useState('')
  const [isCheckingConnections, setIsCheckingConnections] = useState(true)
  const [pageError, setPageError] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [contextOpen, setContextOpen] = useState(true)
  const [showLatestMessage, setShowLatestMessage] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [exampleOpen, setExampleOpen] = useState(false)
  const [artifactPreview, setArtifactPreview] = useState(false)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const messageListRef = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null
  const selectedStage = stages.find((stage) => stage.id === selectedStageId) ?? stages[0]

  const filteredArtifacts = useMemo(() => {
    const query = artifactQuery.trim().toLocaleLowerCase('pt-BR')
    return query ? artifacts.filter((artifact) => `${artifact.name} ${artifact.kind} ${artifact.content}`.toLocaleLowerCase('pt-BR').includes(query)) : artifacts
  }, [artifactQuery, artifacts])
  const firstMissingKind = artifactKinds.find((kind) => !artifacts.some((artifact) => artifact.kind === kind))
  const suggestedStage = firstMissingKind ? relatedStage(firstMissingKind) : undefined
  const pendencies = [
    !selectedProject?.problem?.trim() ? 'Descrever o problema observado' : null,
    !selectedProject?.audience?.trim() ? 'Definir o público prioritário' : null,
    artifacts.length === 0 ? 'Criar o primeiro artefato' : null,
  ].filter((item): item is string => Boolean(item))

  const refreshConnections = async () => {
    setIsCheckingConnections(true)
    const snapshot = await queryConnections()
    setApiConnection(snapshot.api); setApiConnectionError(snapshot.apiError)
    setProviderStatus(snapshot.provider); setProviderError(snapshot.providerError)
    setIsCheckingConnections(false)
  }

  useEffect(() => {
    let active = true
    const check = async () => {
      const snapshot = await queryConnections()
      if (!active) return
      setApiConnection(snapshot.api); setApiConnectionError(snapshot.apiError)
      setProviderStatus(snapshot.provider); setProviderError(snapshot.providerError)
      setIsCheckingConnections(false)
    }
    void check()
    const interval = window.setInterval(() => {
      setIsCheckingConnections(true)
      void check()
    }, 30000)
    return () => { active = false; window.clearInterval(interval) }
  }, [])

  useEffect(() => {
    let active = true
    async function loadProjects() {
      setIsLoading(true)
      try {
        const data = await apiRequest<Project[]>('/api/projects')
        if (!active) return
        setProjects(data)
        setSelectedProjectId((current) => current && data.some((project) => project.id === current) ? current : data[0]?.id ?? '')
        setPageError('')
      } catch (error) {
        if (active) setPageError(getErrorMessage(error))
      } finally {
        if (active) setIsLoading(false)
      }
    }
    void loadProjects()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!selectedProjectId) return
    let active = true
    async function loadProject() {
      try {
        const detail = await apiRequest<Project & { messages: Message[]; artifacts: Artifact[]; documents: DocumentItem[] }>(`/api/projects/${selectedProjectId}`)
        if (!active) return
        setMessages(detail.messages ?? []); setArtifacts(detail.artifacts ?? []); setDocuments(detail.documents ?? []); setChatSources([]); setPageError('')
      } catch (error) {
        if (active) setPageError(getErrorMessage(error))
      }
    }
    void loadProject()
    return () => { active = false }
  }, [selectedProjectId])

  useEffect(() => {
    if (!messageListRef.current || !nearBottomRef.current) return
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight
    setShowLatestMessage(false)
  }, [messages])

  useEffect(() => {
    if (activeView === 'assistant') composerRef.current?.focus({ preventScroll: true })
  }, [activeView])

  const refreshProject = async (projectId = selectedProjectId) => {
    if (!projectId) return
    const detail = await apiRequest<Project & { messages: Message[]; artifacts: Artifact[]; documents: DocumentItem[] }>(`/api/projects/${projectId}`)
    setMessages(detail.messages ?? []); setArtifacts(detail.artifacts ?? []); setDocuments(detail.documents ?? [])
  }

  const selectProject = (projectId: string) => {
    setSelectedProjectId(projectId); setSelectedStageId('discovery'); setActiveView('overview'); setMobileSidebarOpen(false); setPageError('')
    setMessages([]); setArtifacts([]); setDocuments([]); setChatSources([])
  }

  const startNewProject = () => {
    setProjectForm(emptyProjectForm); setProjectFieldErrors({}); setProjectFormError(''); setCreateDialogOpen(true)
  }

  const handleProjectCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isCreatingProject) return
    setProjectFieldErrors({}); setProjectFormError(''); setIsCreatingProject(true)
    const validationErrors: Partial<Record<keyof ProjectForm, string>> = {}
    if (projectForm.name.trim().length < 2) validationErrors.name = 'Informe pelo menos 2 caracteres.'
    if (projectForm.description.trim().length < 10) validationErrors.description = 'Informe pelo menos 10 caracteres.'
    if (Object.keys(validationErrors).length) {
      setProjectFieldErrors(validationErrors)
      setProjectFormError('Revise os campos destacados antes de continuar.')
      setIsCreatingProject(false)
      toast.error('Revise os campos obrigatórios do projeto.')
      return
    }
    try {
      const project = await apiRequest<Project>('/api/projects', jsonRequest(projectForm))
      setProjects((current) => [project, ...current.filter((item) => item.id !== project.id)])
      setSelectedProjectId(project.id); setSelectedStageId('discovery'); setActiveView('overview')
      setMessages([]); setArtifacts([]); setDocuments([]); setChatSources([])
      setProjectForm(emptyProjectForm); setCreateDialogOpen(false); toast.success(`Projeto “${project.name}” criado.`)
    } catch (error) {
      setProjectFieldErrors(getFieldErrors(error)); setProjectFormError(getErrorMessage(error))
      toast.error(`Não foi possível criar o projeto. ${getErrorMessage(error)}`)
    } finally { setIsCreatingProject(false) }
  }

  const handleChatSend = async (suggestedMessage?: string, requestedMode: Mode = chatMode) => {
    const messageText = (suggestedMessage ?? chatInput).trim()
    if (!messageText || !selectedProjectId || isSending) return
    setIsSending(true); setPageError('')
    try {
      const result = await apiRequest<{ answer: string; mode: Mode; project_id: string; sources: ChatSource[] }>(`/api/projects/${selectedProjectId}/chat`, jsonRequest({ message: messageText, mode: requestedMode }))
      const timestamp = new Date().toISOString()
      setMessages((current) => [...current,
        { id: `${Date.now()}-user`, role: 'user', content: messageText, mode: requestedMode, created_at: timestamp },
        { id: `${Date.now()}-assistant`, role: 'assistant', content: result.answer, mode: requestedMode, created_at: timestamp },
      ])
      setChatSources(result.sources ?? []); setChatInput(''); toast.success('Resposta adicionada ao histórico.')
    } catch (error) {
      setPageError(`A mensagem não foi enviada. ${getErrorMessage(error)}`)
      toast.error(`A mensagem não foi enviada. ${getErrorMessage(error)}`)
    } finally { setIsSending(false) }
  }

  const openNewArtifact = (kind = selectedStage.artifactKind) => {
    const initial = { ...emptyArtifactForm, kind }
    setArtifactForm(initial); setArtifactInitial(initial); setEditingArtifactId(null); setArtifactFormError(''); setArtifactPreview(false); setArtifactDialogOpen(true)
  }

  const openArtifactEditor = (artifact: Artifact) => {
    const draft = { name: artifact.name, kind: artifact.kind, content: artifact.content }
    setArtifactForm(draft); setArtifactInitial(draft); setEditingArtifactId(artifact.id); setArtifactFormError(''); setArtifactPreview(false); setArtifactDialogOpen(true)
  }

  const requestArtifactClose = () => {
    if (JSON.stringify(artifactForm) !== JSON.stringify(artifactInitial) && !window.confirm('Descartar as alterações não salvas deste artefato?')) return
    setArtifactDialogOpen(false)
  }

  const handleArtifactSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedProjectId || isSavingArtifact) return
    setIsSavingArtifact(true); setArtifactFormError('')
    try {
      const url = editingArtifactId ? `/api/projects/${selectedProjectId}/artifacts/${editingArtifactId}` : `/api/projects/${selectedProjectId}/artifacts`
      const result = await apiRequest<Artifact>(url, { ...jsonRequest(artifactForm), method: editingArtifactId ? 'PUT' : 'POST' })
      setArtifacts((current) => editingArtifactId ? current.map((artifact) => artifact.id === result.id ? result : artifact) : [result, ...current])
      setArtifactDialogOpen(false); toast.success(editingArtifactId ? `Artefato atualizado para a versão ${result.version}.` : `Artefato “${result.name}” criado.`)
    } catch (error) { setArtifactFormError(getErrorMessage(error)); toast.error(`Não foi possível salvar o artefato. ${getErrorMessage(error)}`) } finally { setIsSavingArtifact(false) }
  }

  const reviewArtifact = (artifact: Artifact) => {
    setChatMode('Revisar')
    setChatInput(`Revise este artefato do projeto ${selectedProject?.name ?? ''}. Considere clareza, evidências, riscos e próximos ajustes.\n\nArtefato: ${artifact.name}\nTipo: ${artifact.kind}\n\n${artifact.content}`)
    setActiveView('assistant'); setContextOpen(true); setPageError('')
  }

  const handleProjectExport = async (format: 'markdown' | 'json') => {
    if (!selectedProjectId) return
    setExportMenuOpen(false)
    try {
      const result = await apiRequest<{ content: string }>(`/api/projects/${selectedProjectId}/export?format=${format}`)
      const blob = new Blob([result.content], { type: format === 'json' ? 'application/json' : 'text/markdown' })
      const href = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = href
      link.download = `${selectedProject?.name.toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, '-') || 'projeto'}.${format === 'json' ? 'json' : 'md'}`
      link.click(); URL.revokeObjectURL(href); toast.success(`Exportação ${format.toUpperCase()} baixada.`)
    } catch (error) { setPageError(getErrorMessage(error)); toast.error(`Falha ao exportar o projeto. ${getErrorMessage(error)}`) }
  }

  const uploadFile = async (file: File) => {
    if (!selectedProjectId) return
    const extension = file.name.split('.').at(-1)?.toLowerCase()
    if (!extension || !['txt', 'md', 'pdf'].includes(extension)) {
      setUploadState('error'); setUploadMessage('Formato não aceito. Escolha um arquivo TXT, MD ou PDF.'); toast.error('Formato não aceito. Selecione TXT, MD ou PDF.'); return
    }
    setRetryFile(file); setUploadState('sending'); setUploadMessage('Enviando e processando o documento…')
    const formData = new FormData()
    formData.append('file', file); formData.append('project_id', selectedProjectId); formData.append('title', file.name); formData.append('doc_type', 'didatico')
    try {
      const result = await apiRequest<{ status: 'ok' | 'warning'; message?: string; warning?: string; document?: DocumentItem }>('/api/documents/upload', { method: 'POST', body: formData })
      if (result.status === 'ok') {
        setUploadState('success'); setUploadMessage(`Documento indexado: ${result.document?.title ?? file.name}.`); toast.success(`Documento “${result.document?.title ?? file.name}” indexado.`)
        try { await refreshProject() } catch (error) { setPageError(`O arquivo foi enviado, mas a biblioteca não atualizou. ${getErrorMessage(error)}`); toast.error('Documento enviado, mas não foi possível atualizar a lista.') }
      } else {
        setUploadState('warning'); setUploadMessage(result.message ?? result.warning ?? 'O arquivo não contém texto indexável.')
        toast.warning(result.message ?? result.warning ?? 'O arquivo não contém texto indexável.')
      }
    } catch (error) { setUploadState('error'); setUploadMessage(getErrorMessage(error)); toast.error(`Falha no envio do documento. ${getErrorMessage(error)}`) }
  }

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) void uploadFile(file)
    event.target.value = ''
  }

  const handleDropFile = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); setIsDraggingFile(false)
    const file = event.dataTransfer.files[0]
    if (file) void uploadFile(file)
  }

  const handleDocumentSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedProjectId || !documentQuery.trim() || isSearching) return
    setIsSearching(true); setSearchMessage('')
    try {
      const params = new URLSearchParams({ project_id: selectedProjectId, query: documentQuery.trim() })
      const results = await apiRequest<SearchResult[]>(`/api/search?${params.toString()}`)
      setSearchResults(results)
      if (!results.length) setSearchMessage('Nenhum trecho correspondente foi encontrado na biblioteca deste projeto.')
    } catch (error) { setSearchResults([]); setSearchMessage(getErrorMessage(error)) } finally { setIsSearching(false) }
  }

  const selectView = (view: View) => {
    setActiveView(view); setMobileSidebarOpen(false); setPageError('')
  }

  const continueWithAssistant = (stageId = selectedStageId) => {
    setSelectedStageId(stageId); setActiveView('assistant'); setContextOpen(true); setChatMode('Aprender')
  }

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void handleChatSend() }
  }

  const sidebar = (
    <aside className={`sidebar ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${mobileSidebarOpen ? 'sidebar-mobile-open' : ''}`} aria-label="Navegação do projeto">
      <div className="brand-row">
        <div className="brand-mark" aria-hidden="true">L</div>
        {!sidebarCollapsed ? <div className="brand-copy"><strong>Lifecycle Mentor</strong><span>PDLC · SDLC</span></div> : null}
        <IconButton className="sidebar-collapse" aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'} title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'} onClick={() => setSidebarCollapsed((value) => !value)}>{sidebarCollapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}</IconButton>
        <IconButton className="sidebar-mobile-close" aria-label="Fechar navegação" onClick={() => setMobileSidebarOpen(false)}><X size={19} aria-hidden="true" /></IconButton>
      </div>
      <div className="sidebar-project">
        {!sidebarCollapsed ? <label htmlFor="project-switcher">PROJETO ATUAL</label> : <span className="sr-only">Projeto atual</span>}
        <div className="project-select-wrap"><FolderOpen size={16} aria-hidden="true" /><select id="project-switcher" value={selectedProjectId} aria-label="Selecionar projeto" onChange={(event) => selectProject(event.target.value)} disabled={!projects.length}>{projects.length ? projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>) : <option value="">Nenhum projeto</option>}</select>{!sidebarCollapsed ? <ChevronDown size={14} aria-hidden="true" /> : null}</div>
        <Button variant="primary" className="sidebar-new-project" icon={<Plus size={16} aria-hidden="true" />} onClick={startNewProject} aria-label="Novo projeto">{sidebarCollapsed ? 'Novo' : 'Novo projeto'}</Button>
      </div>
      <nav className="primary-nav" aria-label="Seções">
        {!sidebarCollapsed ? <span className="nav-group-label">ESPAÇO DE TRABALHO</span> : null}
        <NavItem view="overview" activeView={activeView} onSelect={selectView} collapsed={sidebarCollapsed} disabled={!selectedProject} icon={<Activity size={18} aria-hidden="true" />} />
        <NavItem view="stages" activeView={activeView} onSelect={selectView} collapsed={sidebarCollapsed} disabled={!selectedProject} icon={<Layers3 size={18} aria-hidden="true" />} />
        <NavItem view="assistant" activeView={activeView} onSelect={selectView} collapsed={sidebarCollapsed} disabled={!selectedProject} icon={<MessageSquareText size={18} aria-hidden="true" />} />
        <NavItem view="artifacts" activeView={activeView} onSelect={selectView} collapsed={sidebarCollapsed} disabled={!selectedProject} icon={<FileText size={18} aria-hidden="true" />} count={artifacts.length} />
        <NavItem view="documents" activeView={activeView} onSelect={selectView} collapsed={sidebarCollapsed} disabled={!selectedProject} icon={<BookOpen size={18} aria-hidden="true" />} count={documents.length} />
      </nav>
      <div className="sidebar-bottom">
        <NavItem view="settings" activeView={activeView} onSelect={selectView} collapsed={sidebarCollapsed} icon={<Settings2 size={18} aria-hidden="true" />} />
        <ConnectionPanel apiStatus={apiConnection} provider={providerStatus} checking={isCheckingConnections} collapsed={sidebarCollapsed} onRefresh={() => void refreshConnections()} />
      </div>
    </aside>
  )

  const renderPage = () => {
    if (isLoading) return <div className="loading-state"><LoaderCircle className="spin" size={22} aria-hidden="true" /> Carregando projetos…</div>
    if (!selectedProject) return <>{pageError ? <Notice tone="error" onDismiss={() => setPageError('')}>{pageError}</Notice> : null}<EmptyProject onCreate={startNewProject} onExample={() => setExampleOpen((value) => !value)} exampleOpen={exampleOpen} /></>
    if (activeView === 'overview') return <>
      <PageHeading eyebrow="WORKSPACE / VISÃO GERAL" title={selectedProject.name} description={selectedProject.description}><ExportMenu open={exportMenuOpen} setOpen={setExportMenuOpen} onExport={handleProjectExport} /></PageHeading>
      {pageError ? <Notice tone="error" onDismiss={() => setPageError('')}>{pageError}</Notice> : null}
      <section className="overview-columns">
        <div className="overview-primary">
          <section className="next-step-panel" aria-labelledby="next-step-title">
            <div className="next-step-overline"><span className="overline-icon"><ArrowRight size={15} aria-hidden="true" /></span> PRÓXIMA AÇÃO SUGERIDA</div>
            <h2 id="next-step-title">{firstMissingKind ? `Produza: ${firstMissingKind}` : 'Revise o aprendizado do projeto'}</h2>
            <p>{firstMissingKind ? `Ainda não há artefato do tipo “${firstMissingKind}”. A sugestão considera apenas os registros existentes; ela não marca etapas como concluídas.` : 'Os tipos de artefato disponíveis aparecem no projeto. Reavalie as evidências e registre o próximo aprendizado.'}</p>
            <div className="next-step-actions"><Button variant="primary" icon={<FilePlus2 size={16} aria-hidden="true" />} onClick={() => openNewArtifact(firstMissingKind ?? selectedStage.artifactKind)}>Criar artefato</Button><Button variant="secondary" icon={<Sparkles size={16} aria-hidden="true" />} onClick={() => continueWithAssistant(suggestedStage?.id ?? selectedStageId)}>Continuar com o assistente</Button></div>
            <div className="suggestion-stage"><span>{suggestedStage ? 'Etapa relacionada à sugestão' : 'Etapa selecionada'}</span><button type="button" onClick={() => { setSelectedStageId(suggestedStage?.id ?? selectedStageId); setActiveView('stages') }}>{suggestedStage?.name ?? selectedStage.name}<ArrowRight size={14} aria-hidden="true" /></button></div>
          </section>
          <section className="section-block overview-project-facts" aria-labelledby="project-context-title">
            <SectionHeading eyebrow="CONTEXTO DO PRODUTO" title="O que estamos investigando" id="project-context-title" />
            <FactRow label="Problema" value={selectedProject.problem} /><FactRow label="Público" value={selectedProject.audience} />
            {selectedProject.constraints ? <FactRow label="Restrições" value={selectedProject.constraints} /> : null}
            {selectedProject.learning_objective ? <FactRow label="Objetivo de aprendizagem" value={selectedProject.learning_objective} /> : null}
          </section>
        </div>
        <aside className="overview-secondary">
          <section className="section-block stage-summary" aria-labelledby="selected-stage-heading">
            <div className="section-topline"><span className={`tag ${selectedStage.category === 'PDLC' ? 'tag-blue' : 'tag-violet'}`}>{selectedStage.category === 'PDLC' ? 'PRODUTO · PDLC' : 'SOFTWARE · SDLC'}</span><span className="not-complete">○ Não marcado como concluído</span></div>
            <h2 id="selected-stage-heading">{selectedStage.name}</h2><p>{selectedStage.meaning}</p><Button variant="quiet" icon={<ArrowRight size={16} aria-hidden="true" />} onClick={() => setActiveView('stages')}>Abrir etapa</Button>
          </section>
          <section className="section-block overview-counts" aria-labelledby="counts-heading"><SectionHeading eyebrow="REGISTROS NO PROJETO" title="Conteúdo disponível" id="counts-heading" /><CountLine label="Artefatos" count={artifacts.length} icon={<FileText size={16} aria-hidden="true" />} /><CountLine label="Documentos" count={documents.length} icon={<BookOpen size={16} aria-hidden="true" />} /><CountLine label="Mensagens" count={messages.filter((message) => message.role === 'user').length} icon={<MessageSquareText size={16} aria-hidden="true" />} /></section>
          <section className="section-block pending-list" aria-labelledby="pending-heading"><SectionHeading eyebrow="PENDÊNCIAS OBSERVÁVEIS" title="O que falta registrar" id="pending-heading" />{pendencies.length ? <ul>{pendencies.map((item) => <li key={item}><span aria-hidden="true">○</span>{item}</li>)}</ul> : <p className="muted-copy">Problema, público e primeiro artefato estão registrados.</p>}</section>
        </aside>
      </section>
    </>
    if (activeView === 'stages') return <StagesView selectedStageId={selectedStageId} onSelect={setSelectedStageId} onCreateArtifact={openNewArtifact} onContinue={continueWithAssistant} artifacts={artifacts} />
    if (activeView === 'assistant') return <AssistantView project={selectedProject} stage={selectedStage} mode={chatMode} setMode={setChatMode} messages={messages} sources={chatSources} value={chatInput} setValue={setChatInput} sending={isSending} onSend={handleChatSend} onKeyDown={onComposerKeyDown} composerRef={composerRef} messageListRef={messageListRef} onScroll={() => {
      const list = messageListRef.current
      if (!list) return
      nearBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 96
      setShowLatestMessage(!nearBottomRef.current)
    }} showLatestMessage={showLatestMessage} onLatest={() => {
      const list = messageListRef.current
      if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })
      nearBottomRef.current = true; setShowLatestMessage(false)
    }} contextOpen={contextOpen} onToggleContext={() => setContextOpen((value) => !value)} onOpenStages={() => selectView('stages')} relatedArtifacts={artifacts.filter((artifact) => artifact.kind === selectedStage.artifactKind)} onReviewArtifact={reviewArtifact} />
    if (activeView === 'artifacts') return <ArtifactsView artifacts={filteredArtifacts} totalCount={artifacts.length} query={artifactQuery} onQueryChange={setArtifactQuery} onCreate={() => openNewArtifact()} onEdit={openArtifactEditor} onReview={reviewArtifact} exportMenu={<ExportMenu open={exportMenuOpen} setOpen={setExportMenuOpen} onExport={handleProjectExport} compact />} />
    if (activeView === 'documents') return <DocumentsView documents={documents} uploadState={uploadState} uploadMessage={uploadMessage} retryFile={retryFile} inputRef={uploadInputRef} isDragging={isDraggingFile} onInput={handleFileInput} onRetry={() => retryFile && void uploadFile(retryFile)} onDrop={handleDropFile} onDragEnter={() => setIsDraggingFile(true)} onDragLeave={() => setIsDraggingFile(false)} query={documentQuery} setQuery={setDocumentQuery} results={searchResults} searching={isSearching} searchMessage={searchMessage} onSearch={handleDocumentSearch} />
    return <SettingsView apiStatus={apiConnection} apiError={apiConnectionError} status={providerStatus} error={providerError} checking={isCheckingConnections} onRefresh={() => void refreshConnections()} />
  }

  return <div className={`app-shell ${sidebarCollapsed ? 'app-shell-collapsed' : ''} ${activeView === 'assistant' && selectedProject ? 'app-shell-assistant' : ''}`}>
    <Toaster position="top-right" theme="light" richColors closeButton duration={3600} />
    {sidebar}
    {mobileSidebarOpen ? <button className="mobile-scrim" aria-label="Fechar navegação" onClick={() => setMobileSidebarOpen(false)} /> : null}
    <main className="main-area">
      <header className="app-header"><div className="header-start"><IconButton className="mobile-menu-button" aria-label="Abrir navegação" onClick={() => setMobileSidebarOpen(true)}><Menu size={20} aria-hidden="true" /></IconButton><div className="breadcrumbs"><span>Lifecycle Mentor</span><ChevronRight size={13} aria-hidden="true" /><strong>{selectedProject?.name ?? 'Seu espaço de aprendizagem'}</strong></div></div><div className="header-actions">{selectedProject ? <Button variant="quiet" aria-label="Novo projeto" icon={<Plus size={16} aria-hidden="true" />} onClick={startNewProject}>Novo projeto</Button> : null}</div></header>
      <div className={`page-content ${activeView === 'assistant' && selectedProject ? 'page-content-assistant' : ''}`}>
        {pageError && selectedProject && activeView !== 'overview' ? <Notice tone="error" onDismiss={() => setPageError('')}>{pageError}</Notice> : null}
        {renderPage()}
      </div>
    </main>

    <Dialog open={createDialogOpen} title="Criar projeto" description="Registre o contexto antes de decidir o que construir. Você poderá complementar as informações depois." onRequestClose={() => setCreateDialogOpen(false)} size="wide">
      <form className="project-form" onSubmit={(event) => void handleProjectCreate(event)} noValidate>
        {projectFormError ? <Notice tone="error">{projectFormError}</Notice> : null}
        <FormSection number="01" title="Sobre o projeto" description="Identifique a ideia e o resultado de aprendizagem." />
        <div className="form-grid"><Field label="Nome do projeto" htmlFor="project-name" required error={projectFieldErrors.name}><input id="project-name" autoFocus minLength={2} required value={projectForm.name} aria-invalid={Boolean(projectFieldErrors.name)} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })} placeholder="Ex.: PulsoNexo" /></Field><Field label="Descrição da ideia" htmlFor="project-description" required hint="Descreva em uma ou duas frases o que você quer investigar." error={projectFieldErrors.description}><textarea id="project-description" rows={3} minLength={10} required value={projectForm.description} aria-invalid={Boolean(projectFieldErrors.description)} onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })} placeholder="Qual experiência ou produto você quer explorar?" /></Field></div>
        <FormSection number="02" title="Problema e público" description="Separe o que observou daquilo que ainda precisa validar." />
        <div className="form-grid form-grid-two"><Field label="Público" htmlFor="project-audience" error={projectFieldErrors.audience}><textarea id="project-audience" rows={3} value={projectForm.audience} aria-invalid={Boolean(projectFieldErrors.audience)} onChange={(event) => setProjectForm({ ...projectForm, audience: event.target.value })} placeholder="Quem vivencia essa situação?" /></Field><Field label="Problema" htmlFor="project-problem" hint="Experiência pessoal pode ser o ponto de partida." error={projectFieldErrors.problem}><textarea id="project-problem" rows={3} value={projectForm.problem} aria-invalid={Boolean(projectFieldErrors.problem)} onChange={(event) => setProjectForm({ ...projectForm, problem: event.target.value })} placeholder="O que acontece hoje e por que importa?" /></Field></div>
        <FormSection number="03" title="Restrições e aprendizagem" description="Registre limites conhecidos e o que deseja aprender ao longo do ciclo." />
        <div className="form-grid form-grid-two"><Field label="Restrições" htmlFor="project-constraints" error={projectFieldErrors.constraints}><textarea id="project-constraints" rows={3} value={projectForm.constraints} aria-invalid={Boolean(projectFieldErrors.constraints)} onChange={(event) => setProjectForm({ ...projectForm, constraints: event.target.value })} placeholder="Privacidade, integrações, prazo ou segurança…" /></Field><Field label="Objetivo de aprendizagem" htmlFor="project-learning" error={projectFieldErrors.learning_objective}><textarea id="project-learning" rows={3} value={projectForm.learning_objective} aria-invalid={Boolean(projectFieldErrors.learning_objective)} onChange={(event) => setProjectForm({ ...projectForm, learning_objective: event.target.value })} placeholder="O que você quer descobrir antes de avançar?" /></Field></div>
        <div className="dialog-footer"><p><span className="required-mark">*</span> Campos obrigatórios pela API</p><div><Button type="button" variant="quiet" onClick={() => setCreateDialogOpen(false)}>Cancelar</Button><Button type="submit" variant="primary" disabled={isCreatingProject} icon={isCreatingProject ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}>{isCreatingProject ? 'Criando…' : 'Criar projeto'}</Button></div></div>
      </form>
    </Dialog>

    <Dialog open={artifactDialogOpen} title={editingArtifactId ? 'Editar artefato' : 'Novo artefato'} description="Escreva uma entrega clara e revisável. O histórico anterior não é disponibilizado pela API." onRequestClose={requestArtifactClose} size="wide">
      <form className="artifact-editor" onSubmit={(event) => void handleArtifactSave(event)}>
        {artifactFormError ? <Notice tone="error">{artifactFormError}</Notice> : null}
        <div className="form-grid form-grid-two"><Field label="Nome do artefato" htmlFor="artifact-name" required><input id="artifact-name" required minLength={2} value={artifactForm.name} onChange={(event) => setArtifactForm({ ...artifactForm, name: event.target.value })} placeholder="Ex.: Hipótese de valor" /></Field><Field label="Tipo" htmlFor="artifact-kind" required><select id="artifact-kind" value={artifactForm.kind} onChange={(event) => setArtifactForm({ ...artifactForm, kind: event.target.value })}>{artifactKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select></Field></div>
        <div className="editor-toolbar"><span>Conteúdo</span><div className="segmented-control" role="tablist" aria-label="Modo do editor"><button type="button" role="tab" aria-selected={!artifactPreview} className={!artifactPreview ? 'is-selected' : ''} onClick={() => setArtifactPreview(false)}>Editar</button><button type="button" role="tab" aria-selected={artifactPreview} className={artifactPreview ? 'is-selected' : ''} onClick={() => setArtifactPreview(true)}>Visualizar</button></div></div>
        {artifactPreview ? <div className="artifact-preview"><MarkdownContent content={artifactForm.content || 'A visualização aparecerá aqui.'} /></div> : <textarea className="artifact-content-editor" required minLength={10} value={artifactForm.content} onChange={(event) => setArtifactForm({ ...artifactForm, content: event.target.value })} aria-label="Conteúdo do artefato" placeholder="Registre a hipótese, evidência, decisão ou requisito…" />}
        <div className="dialog-footer"><p>Conteúdo precisa ter ao menos 10 caracteres.</p><div><Button type="button" variant="quiet" onClick={requestArtifactClose}>Cancelar</Button><Button type="submit" variant="primary" disabled={isSavingArtifact} icon={isSavingArtifact ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}>{isSavingArtifact ? 'Salvando…' : editingArtifactId ? 'Salvar alterações' : 'Salvar artefato'}</Button></div></div>
      </form>
    </Dialog>
  </div>
}

function NavItem({ view, activeView, onSelect, collapsed, disabled = false, icon, count }: { view: View; activeView: View; onSelect: (view: View) => void; collapsed: boolean; disabled?: boolean; icon: ReactNode; count?: number }) {
  const title = disabled ? 'Crie um projeto para acessar esta área' : collapsed ? viewLabels[view] : undefined
  return <button type="button" className={`nav-item ${activeView === view ? 'nav-item-active' : ''}`} onClick={() => onSelect(view)} aria-current={activeView === view ? 'page' : undefined} title={title} disabled={disabled}><span className="nav-icon">{icon}</span>{!collapsed ? <><span>{viewLabels[view]}</span>{count !== undefined && count > 0 ? <span className="nav-count">{count}</span> : null}</> : null}</button>
}

function PageHeading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: string; children?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description ? <p>{description}</p> : null}</div>{children ? <div className="page-heading-actions">{children}</div> : null}</div>
}

function SectionHeading({ eyebrow, title, id }: { eyebrow: string; title: string; id?: string }) {
  return <div className="section-heading"><span>{eyebrow}</span><h2 id={id}>{title}</h2></div>
}

function FactRow({ label, value }: { label: string; value?: string | null }) {
  return <div className="fact-row"><span>{label}</span><p>{value?.trim() || <em>Ainda não registrado no projeto.</em>}</p></div>
}

function CountLine({ label, count, icon }: { label: string; count: number; icon: ReactNode }) {
  return <div className="count-line"><span>{icon}{label}</span><strong>{count}</strong></div>
}

function ExportMenu({ open, setOpen, onExport, compact = false }: { open: boolean; setOpen: (open: boolean) => void; onExport: (format: 'markdown' | 'json') => void; compact?: boolean }) {
  return <div className="export-menu-wrap"><Button variant="secondary" icon={<MoreHorizontal size={17} aria-hidden="true" />} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}>{compact ? 'Exportar projeto' : 'Exportar'}</Button>{open ? <><button className="menu-dismiss" aria-label="Fechar menu de exportação" onClick={() => setOpen(false)} /><div className="export-menu" role="menu" aria-label="Exportar projeto"><span>Exportar projeto</span><button type="button" role="menuitem" onClick={() => onExport('markdown')}><FileText size={16} aria-hidden="true" />Markdown <small>.md</small></button><button type="button" role="menuitem" onClick={() => onExport('json')}><Layers3 size={16} aria-hidden="true" />JSON <small>.json</small></button></div></> : null}</div>
}

function EmptyProject({ onCreate, onExample, exampleOpen }: { onCreate: () => void; onExample: () => void; exampleOpen: boolean }) {
  return <div className="empty-project-page"><div className="empty-project-intro"><div className="empty-project-mark"><Sparkles size={23} aria-hidden="true" /></div><span className="eyebrow">SEU ESPAÇO DE APRENDIZAGEM</span><h1>Comece pelo problema.<br />Construa com intenção.</h1><p>Investigue uma necessidade real e avance por produto e software com apoio do assistente.</p><div className="empty-project-actions"><Button variant="primary" icon={<Plus size={17} aria-hidden="true" />} onClick={onCreate}>Criar meu primeiro projeto</Button><Button variant="quiet" onClick={onExample} aria-expanded={exampleOpen}>Explorar exemplo</Button></div></div><div className="empty-project-steps" aria-label="Fluxo de aprendizagem"><div><span>01</span><strong>Investigar</strong><small>Problema e evidências</small></div><ArrowRight size={18} aria-hidden="true" /><div><span>02</span><strong>Definir</strong><small>Hipótese e proposta</small></div><ArrowRight size={18} aria-hidden="true" /><div><span>03</span><strong>Construir</strong><small>Requisitos e testes</small></div></div>{exampleOpen ? <PulsoNexoExample /> : null}</div>
}

function PulsoNexoExample() {
  return <section className="example-panel" aria-labelledby="example-title"><div className="example-heading"><div><span className="tag tag-violet">CONTEÚDO ILUSTRATIVO</span><h2 id="example-title">{pulsoNexoExample.name}</h2><p>{pulsoNexoExample.description}</p></div><HeartPulse size={28} aria-hidden="true" /></div><div className="example-grid"><ExampleList title="Problema e público" items={[pulsoNexoExample.problem, pulsoNexoExample.audience]} /><ExampleList title="Hipóteses a validar" items={pulsoNexoExample.hypotheses} /><ExampleList title="Escopo de MVP" items={pulsoNexoExample.mvp} /><ExampleList title="Requisitos e decisões" items={[...pulsoNexoExample.requirements, ...pulsoNexoExample.decisions]} /><ExampleList title="Testes e métricas propostas" items={pulsoNexoExample.tests} /></div><p className="example-disclaimer">Este cenário não representa entrevistas, validações ou resultados realizados e não cria um projeto na sua conta.</p></section>
}

function ExampleList({ title, items }: { title: string; items: string[] }) {
  return <div className="example-list"><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></div>
}

function FormSection({ number, title, description }: { number: string; title: string; description: string }) {
  return <div className="form-section-heading"><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div></div>
}

function StagesView({ selectedStageId, onSelect, onCreateArtifact, onContinue, artifacts }: { selectedStageId: string; onSelect: (id: string) => void; onCreateArtifact: (kind?: string) => void; onContinue: (id?: string) => void; artifacts: Artifact[] }) {
  const selected = stages.find((stage) => stage.id === selectedStageId) ?? stages[0]
  const groups = [{ id: 'PDLC', title: 'PDLC · Produto', detail: 'Encontrar o problema e aprender com o valor entregue.' }, { id: 'SDLC', title: 'SDLC · Software', detail: 'Definir, construir, verificar e operar a solução.' }] as const
  const related = artifacts.filter((artifact) => artifact.kind === selected.artifactKind)
  return <><PageHeading eyebrow="WORKSPACE / MÉTODO" title="Etapas do ciclo" description="Uma sequência para orientar o trabalho, não uma lista obrigatoriamente linear."><span className="revisit-note"><CircleHelp size={15} aria-hidden="true" /> Etapas podem ser revisitadas</span></PageHeading><div className="stages-workspace"><nav className="stage-navigation" aria-label="Etapas PDLC e SDLC">{groups.map((group) => <section className="stage-group" key={group.id} aria-labelledby={`stage-group-${group.id}`}><div className="stage-group-heading"><h2 id={`stage-group-${group.id}`}>{group.title}</h2><p>{group.detail}</p></div><ol>{stages.filter((stage) => stage.category === group.id).map((stage, index) => <li key={stage.id}><button type="button" className={`stage-nav-button ${stage.id === selectedStageId ? 'is-current' : ''}`} aria-current={stage.id === selectedStageId ? 'step' : undefined} onClick={() => onSelect(stage.id)}><span className="stage-index">{String(index + 1).padStart(2, '0')}</span><span className="stage-nav-name">{stage.name}</span>{stage.id === selectedStageId ? <ChevronRight size={15} aria-hidden="true" /> : null}</button></li>)}</ol></section>)}</nav><section className="stage-detail" aria-labelledby="stage-detail-title"><span className={`tag ${selected.category === 'PDLC' ? 'tag-blue' : 'tag-violet'}`}>{selected.category === 'PDLC' ? 'CICLO DE PRODUTO' : 'CICLO DE SOFTWARE'}</span><h2 id="stage-detail-title">{selected.name}</h2><p className="stage-meaning">{selected.meaning}</p><div className="stage-purpose"><Lightbulb size={18} aria-hidden="true" /><div><strong>Por que esta etapa existe</strong><p>{selected.purpose}</p></div></div><div className="stage-deliverable"><span>ENTREGA SUGERIDA</span><strong>{selected.deliverable}</strong><Button variant="secondary" icon={<FilePlus2 size={15} aria-hidden="true" />} onClick={() => onCreateArtifact(selected.artifactKind)}>Criar artefato</Button></div><div className="guiding-questions"><h3>Perguntas orientadoras</h3><ul>{selected.questions.map((question) => <li key={question}>{question}</li>)}</ul></div><div className="related-artifacts"><div className="related-artifact-heading"><h3>Artefatos relacionados</h3><span>{related.length}</span></div>{related.length ? <ul>{related.map((artifact) => <li key={artifact.id}><FileText size={15} aria-hidden="true" /><span>{artifact.name}</span><small>{formatDate(artifact.updated_at)}</small></li>)}</ul> : <p>Nenhum artefato deste tipo foi registrado ainda.</p>}</div><div className="stage-detail-footer"><span>Selecionar esta etapa não a marca como concluída.</span><Button variant="primary" icon={<Sparkles size={16} aria-hidden="true" />} onClick={() => onContinue(selected.id)}>Trabalhar esta etapa com o assistente</Button></div></section></div></>
}

function AssistantView({ project, stage, mode, setMode, messages, sources, value, setValue, sending, onSend, onKeyDown, composerRef, messageListRef, onScroll, showLatestMessage, onLatest, contextOpen, onToggleContext, onOpenStages, relatedArtifacts, onReviewArtifact }: {
  project: Project; stage: (typeof stages)[number]; mode: Mode; setMode: (mode: Mode) => void; messages: Message[]; sources: ChatSource[]; value: string; setValue: (value: string) => void; sending: boolean; onSend: (message?: string, mode?: Mode) => Promise<void>; onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void; composerRef: RefObject<HTMLTextAreaElement | null>; messageListRef: RefObject<HTMLDivElement | null>; onScroll: () => void; showLatestMessage: boolean; onLatest: () => void; contextOpen: boolean; onToggleContext: () => void; onOpenStages: () => void; relatedArtifacts: Artifact[]; onReviewArtifact: (artifact: Artifact) => void
}) {
  const suggestions: Array<{ label: string; prompt: string; mode: Mode }> = [
    { label: 'Explique esta etapa usando meu projeto', prompt: `Explique a etapa ${stage.name} usando o contexto do meu projeto.`, mode: 'Aprender' },
    { label: 'Ajude a identificar minhas hipóteses', prompt: 'Ajude-me a separar fatos, suposições e hipóteses que precisam ser validadas neste projeto.', mode: 'Construir' },
    { label: 'O que falta para definir meu MVP?', prompt: 'O que falta investigar para definir um MVP proporcional às hipóteses deste projeto?', mode: 'Construir' },
    { label: 'Revise um artefato comigo', prompt: 'Quero revisar um artefato. Ajude-me a avaliar clareza, evidências e próximos ajustes.', mode: 'Revisar' },
  ]
  return <><div className="assistant-page-heading"><div><div className="eyebrow">WORKSPACE / ASSISTENTE</div><h1>Assistente</h1><p>Converse com o contexto de <strong>{project.name}</strong>.</p></div><Button variant="secondary" icon={<PanelLeftOpen size={16} aria-hidden="true" />} aria-expanded={contextOpen} onClick={onToggleContext}>{contextOpen ? 'Ocultar contexto' : 'Mostrar contexto'}</Button></div><section className={`assistant-layout ${contextOpen ? 'assistant-layout-context' : ''}`} aria-label="Área do assistente"><div className="chat-workspace"><div className="chat-workspace-header"><div className="assistant-identity"><div className="assistant-avatar"><Sparkles size={16} aria-hidden="true" /></div><div><strong>Mentor de produto e software</strong><span><span className="assistant-online-dot" /> Contexto do projeto ativo</span></div></div><div className="chat-stage-breadcrumb"><span>ETAPA</span><button type="button" onClick={onOpenStages}>{stage.name}<ChevronDown size={14} aria-hidden="true" /></button></div></div><div className="chat-mode-row"><ModeControl mode={mode} onChange={setMode} /><span className="mode-hint">{mode === 'Aprender' ? 'Entenda conceitos e contexto' : mode === 'Construir' ? 'Elabore uma entrega' : 'Analise um artefato'}</span></div><div className="chat-message-list" ref={messageListRef} onScroll={onScroll} aria-label="Histórico da conversa" aria-live="polite">{messages.length === 0 ? <div className="chat-empty"><div className="chat-empty-icon"><Sparkles size={20} aria-hidden="true" /></div><h2>O que vamos entender ou construir?</h2><p>As respostas usam o contexto registrado para este projeto e a etapa selecionada.</p><div className="suggestion-list">{suggestions.map((suggestion) => <button type="button" key={suggestion.label} disabled={sending} onClick={() => void onSend(suggestion.prompt, suggestion.mode)}><span>{suggestion.label}</span><ArrowRight size={15} aria-hidden="true" /></button>)}</div></div> : messages.map((message) => <ChatMessage key={message.id} message={message} />)}{sending ? <div className="assistant-thinking" role="status"><span className="thinking-dots"><i /><i /><i /></span><span>Preparando uma resposta…</span></div> : null}</div>{showLatestMessage ? <button className="latest-message-button" type="button" onClick={onLatest}><ArrowDown size={15} aria-hidden="true" /> Voltar à mensagem mais recente</button> : null}<form className="chat-composer" onSubmit={(event) => { event.preventDefault(); void onSend() }}><label htmlFor="assistant-message" className="sr-only">Sua mensagem</label><textarea id="assistant-message" ref={composerRef} value={value} rows={1} maxLength={12000} onChange={(event) => { setValue(event.target.value); event.target.style.height = 'auto'; event.target.style.height = `${Math.min(event.target.scrollHeight, 144)}px` }} onKeyDown={onKeyDown} placeholder="Escreva sua pergunta ou contexto…" disabled={sending} /><div className="composer-footer"><span>Enter envia · Shift+Enter quebra linha</span><Button type="submit" variant="primary" disabled={sending || !value.trim()} icon={sending ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}>{sending ? 'Enviando…' : 'Enviar'}</Button></div></form></div>{contextOpen ? <aside className="assistant-context" aria-label="Contexto da conversa"><div className="context-panel-heading"><div><span className="eyebrow">CONTEXTO ATIVO</span><h2>Esta conversa</h2></div><IconButton aria-label="Ocultar contexto" onClick={onToggleContext}><X size={17} aria-hidden="true" /></IconButton></div><section className="context-section"><span>PROJETO</span><strong>{project.name}</strong><p>{project.description}</p></section><section className="context-section context-stage"><span>ETAPA SELECIONADA</span><strong>{stage.name}</strong><p>{stage.purpose}</p><button type="button" onClick={onOpenStages}>Abrir orientação da etapa <ArrowRight size={14} aria-hidden="true" /></button></section><section className="context-section"><div className="context-list-heading"><span>ARTEFATOS RELACIONADOS</span><small>{relatedArtifacts.length}</small></div>{relatedArtifacts.length ? <ul className="context-artifact-list">{relatedArtifacts.slice(0, 4).map((artifact) => <li key={artifact.id}><FileText size={14} aria-hidden="true" /><span>{artifact.name}</span><button type="button" onClick={() => onReviewArtifact(artifact)} aria-label={`Revisar ${artifact.name}`} title="Revisar este artefato"><ArrowRight size={14} aria-hidden="true" /></button></li>)}</ul> : <p>Nenhum artefato relacionado por tipo.</p>}</section><section className="context-section sources-section"><div className="context-list-heading"><span>FONTES RECENTES</span><small>{sources.length}</small></div>{sources.length ? <ul>{sources.map((source, index) => <li key={`${source.title}-${index}`}><strong>{source.title}</strong><p>{source.snippet}</p></li>)}</ul> : <p>As fontes recuperadas para uma resposta aparecerão aqui.</p>}</section></aside> : null}</section></>
}

function ModeControl({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const modes: Mode[] = ['Aprender', 'Construir', 'Revisar']
  return <div className="mode-control" role="group" aria-label="Modo do assistente">{modes.map((item) => <button key={item} type="button" className={item === mode ? 'is-selected' : ''} aria-pressed={item === mode} onClick={() => onChange(item)}>{item}</button>)}</div>
}

function ChatMessage({ message }: { message: Message }) {
  const assistant = message.role === 'assistant'
  return <article className={`chat-message ${assistant ? 'chat-message-assistant' : 'chat-message-user'}`}><div className="chat-message-avatar" aria-hidden="true">{assistant ? <Sparkles size={14} /> : <span>Você</span>}</div><div className="chat-message-content"><div className="chat-message-meta"><strong>{assistant ? 'Assistente' : 'Você'}</strong><span>{message.mode}</span><time dateTime={message.created_at}>{formatDate(message.created_at)}</time></div><MarkdownContent content={message.content} /></div></article>
}

function ArtifactsView({ artifacts, totalCount, query, onQueryChange, onCreate, onEdit, onReview, exportMenu }: { artifacts: Artifact[]; totalCount: number; query: string; onQueryChange: (value: string) => void; onCreate: () => void; onEdit: (artifact: Artifact) => void; onReview: (artifact: Artifact) => void; exportMenu: ReactNode }) {
  return <><PageHeading eyebrow="WORKSPACE / REGISTROS" title="Artefatos" description="Entregas do projeto que podem ser revisadas e evoluídas ao longo das etapas."><div className="artifact-heading-actions">{exportMenu}<Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={onCreate}>Criar artefato</Button></div></PageHeading><section className="content-section artifact-library"><div className="library-toolbar"><span>{totalCount} {totalCount === 1 ? 'artefato' : 'artefatos'}</span><label className="search-field"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Buscar artefatos" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar por nome, tipo ou conteúdo" /></label></div>{artifacts.length ? <div className="artifact-table-wrap"><table className="artifact-table"><thead><tr><th>Artefato</th><th>Etapa relacionada</th><th>Atualizado</th><th>Status / versão</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{artifacts.map((artifact) => { const stage = relatedStage(artifact.kind); return <tr key={artifact.id}><td><button type="button" className="artifact-title-button" onClick={() => onEdit(artifact)}><strong>{artifact.name}</strong><span>{artifact.kind}</span></button></td><td><span className="suggested-link">{stage?.name ?? 'Etapa não mapeada'}<small>Vínculo sugerido pelo tipo</small></span></td><td>{formatDate(artifact.updated_at)}</td><td><span className="status-tag">{artifact.status}</span><small className="version-label">v{artifact.version}</small></td><td><div className="table-actions"><IconButton aria-label={`Revisar ${artifact.name}`} title="Revisar com o assistente" onClick={() => onReview(artifact)}><Sparkles size={16} aria-hidden="true" /></IconButton><IconButton aria-label={`Editar ${artifact.name}`} title="Editar artefato" onClick={() => onEdit(artifact)}><FileText size={16} aria-hidden="true" /></IconButton></div></td></tr> })}</tbody></table></div> : <EmptyState icon={<FileText size={22} />} title={query ? 'Nenhum resultado para esta busca' : 'Nenhum artefato registrado'}>{query ? 'Tente outro termo ou limpe a busca.' : 'Registre problemas, hipóteses, decisões e entregas para acompanhar o raciocínio do projeto.'}<div className="inline-empty-action"><Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={onCreate}>Criar artefato</Button></div></EmptyState>}<p className="artifact-history-note">A API mantém versões numéricas ao editar, mas não oferece visualização do conteúdo de versões anteriores.</p></section></>
}

function DocumentsView({ documents, uploadState, uploadMessage, retryFile, inputRef, isDragging, onInput, onRetry, onDrop, onDragEnter, onDragLeave, query, setQuery, results, searching, searchMessage, onSearch }: {
  documents: DocumentItem[]; uploadState: UploadState; uploadMessage: string; retryFile: File | null; inputRef: RefObject<HTMLInputElement | null>; isDragging: boolean; onInput: (event: ChangeEvent<HTMLInputElement>) => void; onRetry: () => void; onDrop: (event: DragEvent<HTMLDivElement>) => void; onDragEnter: () => void; onDragLeave: () => void; query: string; setQuery: (value: string) => void; results: SearchResult[]; searching: boolean; searchMessage: string; onSearch: (event: FormEvent<HTMLFormElement>) => void
}) {
  return <><PageHeading eyebrow="WORKSPACE / BIBLIOTECA" title="Documentos" description="Adicione materiais de referência e pesquise trechos indexados para este projeto." /><div className="documents-layout"><section className="content-section document-library-panel"><SectionHeading eyebrow="BIBLIOTECA DO PROJETO" title="Materiais" /><div className={`upload-zone ${isDragging ? 'upload-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); onDragEnter() }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) onDragLeave() }} onDrop={onDrop}><div className="upload-icon"><Upload size={20} aria-hidden="true" /></div><div className="upload-copy"><strong>Adicione um documento</strong><p>Arraste um arquivo para esta área ou selecione no dispositivo.</p><small>Formatos aceitos: TXT, MD e PDF textual. O backend não define limite de tamanho.</small></div><input ref={inputRef} className="visually-hidden-input" type="file" accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf" onChange={onInput} aria-label="Selecionar documento para upload" /><Button type="button" variant="secondary" icon={<Upload size={15} aria-hidden="true" />} onClick={() => inputRef.current?.click()}>Selecionar arquivo</Button></div>{uploadState !== 'idle' ? <div className={`upload-feedback upload-${uploadState}`} role={uploadState === 'error' ? 'alert' : 'status'}>{uploadState === 'sending' ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : uploadState === 'success' ? <Check size={16} aria-hidden="true" /> : <CircleHelp size={16} aria-hidden="true" />}<span>{uploadMessage}</span>{uploadState === 'error' && retryFile ? <Button type="button" variant="quiet" onClick={onRetry}>Tentar novamente</Button> : null}</div> : null}<div className="document-list-heading"><h2>Documentos deste projeto</h2><span>{documents.length}</span></div>{documents.length ? <ul className="document-list">{documents.map((document) => <li key={document.id}><div className="document-file-icon"><FileText size={17} aria-hidden="true" /></div><div className="document-file-details"><strong>{document.title}</strong><span>{document.doc_type} · {document.chunk_count ?? 0} trechos</span></div><time dateTime={document.created_at}>{formatDate(document.created_at)}</time><span className="document-indexed">Indexado</span></li>)}</ul> : <p className="document-empty-copy">Ainda não há documentos nesta biblioteca. Arquivos legíveis serão indexados para consulta.</p>}<p className="endpoint-limit-note">A API atual não oferece exclusão de documentos nem apresenta tamanho do arquivo salvo.</p></section><section className="content-section document-search-panel"><SectionHeading eyebrow="RECUPERAÇÃO LOCAL" title="Pesquisar na biblioteca" /><p>Busque palavras ou expressões nos trechos indexados deste projeto.</p><form className="document-search-form" onSubmit={onSearch}><label className="search-field"><Search size={16} aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Termo de busca" placeholder="Ex.: zonas de intensidade" /></label><Button type="submit" variant="primary" disabled={searching || !query.trim()} icon={searching ? <LoaderCircle className="spin" size={15} aria-hidden="true" /> : <Search size={15} aria-hidden="true" />}>{searching ? 'Buscando…' : 'Buscar'}</Button></form>{searchMessage ? <p className="search-feedback" role="status">{searchMessage}</p> : null}{results.length ? <ol className="search-results">{results.map((result, index) => { const document = documents.find((item) => item.id === result.document_id); return <li key={`${result.document_id ?? 'chunk'}-${result.section ?? index}`}><div><strong>{document?.title ?? 'Trecho recuperado'}</strong><span>{result.section ?? 'Trecho do documento'}</span></div><p>{result.content}</p></li> })}</ol> : null}</section></div></>
}

function ConnectionPanel({ apiStatus, provider, checking, collapsed, onRefresh }: { apiStatus: ApiConnection; provider: ProviderStatus | null; checking: boolean; collapsed: boolean; onRefresh: () => void }) {
  const apiLabel = apiStatus === 'checking' ? 'Verificando' : apiStatus === 'connected' ? 'Conectada' : 'Indisponível'
  const providerName = provider?.provider_label ?? 'Provedor de IA'
  const providerLabel = !provider ? 'Verificando' : provider.available ? 'Disponível' : 'Indisponível'
  return <div className={`connection-panel ${collapsed ? 'connection-panel-collapsed' : ''}`} role="status" aria-live="polite" aria-label={`API local: ${apiLabel}. ${providerName}: ${providerLabel}.`}>
    <div className="connection-line" title={`API local: ${apiLabel}`}><span className={`connection-dot is-${apiStatus}`} aria-hidden="true" /><span className="connection-label">API local</span><strong className="connection-value">{apiLabel}</strong></div>
    <div className="connection-line" title={`${providerName}: ${providerLabel}`}><span className={`connection-dot ${!provider ? 'is-checking' : provider.available ? 'is-connected' : 'is-offline'}`} aria-hidden="true" /><span className="connection-label">{providerName}</span><strong className="connection-value">{providerLabel}</strong></div>
    <button type="button" className="connection-refresh" onClick={onRefresh} disabled={checking} aria-label="Atualizar status das conexões" title="Atualizar status das conexões"><RefreshCw size={14} className={checking ? 'spin' : ''} aria-hidden="true" />{collapsed ? null : <span>{checking ? 'Verificando…' : 'Verificar agora'}</span>}</button>
  </div>
}

function SettingsView({ apiStatus, apiError, status, error, checking, onRefresh }: { apiStatus: ApiConnection; apiError: string; status: ProviderStatus | null; error: string; checking: boolean; onRefresh: () => void }) {
  const providerName = status?.provider_label ?? 'Provedor de IA'
  const providerReady = status?.available === true
  return <><PageHeading eyebrow="WORKSPACE / PREFERÊNCIAS" title="Configurações" description="Diagnóstico das integrações locais usadas pelo assistente." /><section className="content-section settings-panel"><div className="settings-heading"><div className="settings-icon"><Activity size={20} aria-hidden="true" /></div><div><span className="eyebrow">INFERÊNCIA LOCAL</span><h2>{providerName}</h2><p>{status?.provider === 'mlx' ? 'O adaptador Lifecycle Mentor será carregado em memória quando a primeira pergunta for enviada.' : 'O provedor configurado é consultado pelo backend local.'}</p></div><Button variant="secondary" disabled={checking} icon={checking ? <LoaderCircle className="spin" size={15} aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />} onClick={onRefresh}>{checking ? 'Verificando…' : 'Verificar conexões'}</Button></div><div className="settings-details"><div><span>API local</span><strong className={apiStatus === 'connected' ? 'text-success' : apiStatus === 'offline' ? 'text-error' : 'text-warning'}>{apiStatus === 'connected' ? 'Conectada' : apiStatus === 'offline' ? 'Indisponível' : 'Verificando'}</strong>{apiError ? <p>{apiError}</p> : null}</div><div><span>{providerName}</span><strong className={providerReady ? 'text-success' : status ? 'text-warning' : 'text-error'}>{status ? providerReady ? 'Disponível' : 'Indisponível' : 'Sem resposta'}</strong>{error ? <p>{error}</p> : null}</div>{status ? <><div><span>Adaptador/modelo</span><strong>{status.model || 'Não informado'}</strong></div><div><span>Modelo-base/runtime</span><strong>{status.base_model || status.base_url}</strong></div></> : null}</div><p className="endpoint-limit-note">Credenciais e tokens do Polar não são gerenciados por esta aplicação atualmente.</p></section></>
}

export default App