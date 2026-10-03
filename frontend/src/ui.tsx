import { useEffect, useId, useRef, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Check, Copy } from 'lucide-react'

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger'
  icon?: ReactNode
}

export function Button({ variant = 'secondary', icon, className = '', children, ...props }: ButtonProps) {
  return (
    <button className={`button button-${variant} ${className}`.trim()} {...props}>
      {icon}
      <span>{children}</span>
    </button>
  )
}

export function IconButton({ className = '', ...props }: ComponentProps<'button'>) {
  return <button className={`icon-button ${className}`.trim()} {...props} />
}

type FieldProps = {
  label: string
  htmlFor: string
  required?: boolean
  hint?: string
  error?: string
  children: ReactNode
}

export function Field({ label, htmlFor, required, hint, error, children }: FieldProps) {
  const hintId = hint ? `${htmlFor}-hint` : undefined
  const errorId = error ? `${htmlFor}-error` : undefined
  return (
    <div className={`field ${error ? 'field-error' : ''}`}>
      <label htmlFor={htmlFor}>
        {label}{required ? <span className="required-mark" aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {hint ? <small id={hintId} className="field-hint">{hint}</small> : null}
      {error ? <small id={errorId} className="field-error-text" role="alert">{error}</small> : null}
    </div>
  )
}

type DialogProps = {
  open: boolean
  title: string
  description?: string
  onRequestClose: () => void
  children: ReactNode
  size?: 'regular' | 'wide'
}

export function Dialog({ open, title, description, onRequestClose, children, size = 'regular' }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className={`dialog dialog-${size}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault()
        onRequestClose()
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onRequestClose()
      }}
    >
      <div className="dialog-header">
        <div>
          <h2 id={titleId}>{title}</h2>
          {description ? <p id={descriptionId}>{description}</p> : null}
        </div>
        <button type="button" className="dialog-close" aria-label="Fechar janela" onClick={onRequestClose}>×</button>
      </div>
      {children}
    </dialog>
  )
}

export function EmptyState({
  eyebrow,
  title,
  children,
  action,
  icon,
}: {
  eyebrow?: string
  title: string
  children?: ReactNode
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="empty-state">
      {icon ? <div className="empty-icon" aria-hidden="true">{icon}</div> : null}
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <h2>{title}</h2>
      {children ? <div className="empty-copy">{children}</div> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  )
}

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <MarkdownCode>{children}</MarkdownCode>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

function getText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(getText).join('')
  if (node && typeof node === 'object' && 'props' in node) {
    return getText((node as { props?: { children?: ReactNode } }).props?.children)
  }
  return ''
}

function MarkdownCode({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false)
  const text = getText(children)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="markdown-code">
      <button type="button" className="code-copy" onClick={() => void copy()} aria-label="Copiar bloco de código">
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        {copied ? 'Copiado' : 'Copiar'}
      </button>
      <pre>{children}</pre>
    </div>
  )
}

export function Notice({ children, tone = 'neutral', onDismiss }: { children: ReactNode; tone?: 'neutral' | 'success' | 'error'; onDismiss?: () => void }) {
  return (
    <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onDismiss ? <button type="button" aria-label="Dispensar aviso" onClick={onDismiss}>×</button> : null}
    </div>
  )
}