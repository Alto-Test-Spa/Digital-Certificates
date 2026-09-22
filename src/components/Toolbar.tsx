import { Wordmark } from './Wordmark'
import { HistoryMenu } from './HistoryMenu'
import { SyncStatus } from './SyncStatus'
import type { CertificateState } from '../types'
import type { SyncState } from '../lib/api'

interface Props {
  cert: CertificateState
  syncState: SyncState
  canUndo: boolean
  onNew: () => void
  onUndo: () => void
  onOpen: (cert: CertificateState) => void
}

export function Toolbar({ cert, syncState, canUndo, onNew, onUndo, onOpen }: Props) {
  return (
    <div className="toolbar no-print">
      <Wordmark tone="steel" textClassName="text-[14px]" />
      <div className="toolbar-actions">
        <SyncStatus state={syncState} />
        <HistoryMenu currentCode={cert.code} onOpen={onOpen} />
        {canUndo && (
          <button type="button" className="toolbar-btn toolbar-btn--ghost" onClick={onUndo}>
            Deshacer
          </button>
        )}
        <button type="button" className="toolbar-btn toolbar-btn--ghost" onClick={onNew}>
          Nuevo
        </button>
        <button type="button" className="toolbar-btn" onClick={() => window.print()}>
          Imprimir / PDF
        </button>
      </div>
    </div>
  )
}
