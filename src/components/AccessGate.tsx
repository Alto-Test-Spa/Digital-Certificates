import { useState } from 'react'
import type { FormEvent } from 'react'
import { Wordmark } from './Wordmark'

interface Props {
  onSubmit: (key: string) => Promise<boolean>
}

// Portón de acceso: clave compartida del equipo (la MISMA que usan
// informe_levantamiento/propuesta_tecnica/propuesta_economica), no una
// cuenta por persona — ver spec, sección 4.
export function AccessGate({ onSubmit }: Props) {
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!key.trim() || busy) return
    setBusy(true)
    setError('')
    const ok = await onSubmit(key.trim())
    setBusy(false)
    if (!ok) setError('Clave incorrecta, o no hay conexión con el servidor.')
  }

  return (
    <div className="access-gate">
      <form className="access-gate-card" onSubmit={handleSubmit}>
        <Wordmark tone="signal" textClassName="text-[17px] text-paper" />
        <p className="access-gate-title">Clave de acceso del equipo</p>
        <p className="access-gate-hint">
          Los certificados se guardan en el servidor de Alto Test, no en este navegador. Pídele la clave a quien
          administre el equipo si no la tienes.
        </p>
        <input
          className="access-gate-input"
          type="password"
          autoFocus
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Clave de acceso"
        />
        {error && <p className="access-gate-error">{error}</p>}
        <button type="submit" className="toolbar-btn" disabled={busy}>
          {busy ? 'Verificando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
