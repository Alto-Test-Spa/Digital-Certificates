import { useCertificateStore } from './lib/store'
import { Certificate } from './components/Certificate'
import { Toolbar } from './components/Toolbar'

export default function CertificateEditor({ onAuthExpired }: { onAuthExpired: () => void }) {
  const { cert, setCert, reset, undo, canUndo, loadCertificate, syncState, booting } = useCertificateStore(onAuthExpired)

  if (booting) return <div className="boot-screen">Cargando…</div>

  return (
    <div className="editor-shell">
      <Toolbar cert={cert} syncState={syncState} canUndo={canUndo} onNew={reset} onUndo={undo} onOpen={loadCertificate} />
      <Certificate cert={cert} onChange={(patch) => setCert((c) => ({ ...c, ...patch }))} />
    </div>
  )
}
