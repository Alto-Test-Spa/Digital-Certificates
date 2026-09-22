import type { SyncState } from '../lib/api'

const LABEL: Partial<Record<SyncState, string>> = {
  saving: 'Guardando…',
  saved: 'Guardado en la nube',
  offline: 'Sin conexión — cambios no guardados',
  error: 'Error al guardar',
}

export function SyncStatus({ state }: { state: SyncState }) {
  const label = LABEL[state]
  if (!label) return null
  return (
    <div className={`sync-status sync-status--${state} no-print`} title={label}>
      {label}
    </div>
  )
}
