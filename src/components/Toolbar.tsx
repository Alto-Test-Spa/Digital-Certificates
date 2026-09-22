import FilePlus from 'reicon-react/icons/FilePlus'
import Undo from 'reicon-react/icons/Undo'
import Printer from 'reicon-react/icons/Printer'
import { Logomark } from './Logomark'
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
      <span className="toolbar-brand">
        <Logomark tone="signal" width={26} height={11} />
        ALTO&nbsp;TEST
      </span>

      <div className="toolbar-spacer" />

      <SyncStatus state={syncState} />
      <HistoryMenu currentCode={cert.code} onOpen={onOpen} />

      <button type="button" className="toolbar-btn toolbar-btn--ghost" onClick={onNew}>
        <FilePlus size={14} strokeWidth={2} className="icon" />
        Nuevo
      </button>
      {canUndo && (
        <button type="button" className="toolbar-btn toolbar-btn--ghost" onClick={onUndo}>
          <Undo size={14} strokeWidth={2} className="icon" />
          Deshacer
        </button>
      )}
      <button type="button" className="toolbar-btn" onClick={() => window.print()}>
        <Printer size={14} strokeWidth={2} className="icon" />
        Imprimir / PDF
      </button>
    </div>
  )
}
