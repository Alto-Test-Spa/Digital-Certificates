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
    // Si onSubmit lanza (red caída, CORS, endpoint mal configurado) en vez de
    // resolver a false, sin este try/finally el botón quedaba pegado en
    // "Verificando..." para siempre — nunca se volvía a habilitar ni se
    // mostraba ningún error.
    try {
      const ok = await onSubmit(key.trim())
      if (!ok) setError('Clave incorrecta, o no hay conexión con el servidor.')
    } catch {
      setError('Clave incorrecta, o no hay conexión con el servidor.')
    } finally {
      setBusy(false)
    }
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
