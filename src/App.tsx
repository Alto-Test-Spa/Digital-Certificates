import { useEffect, useState } from 'react'
import { getStoredAccessKey, setStoredAccessKey, clearStoredAccessKey, verifyAccessKey } from './lib/api'
import { AccessGate } from './components/AccessGate'
import CertificateEditor from './CertificateEditor'

export default function App() {
  const [authorized, setAuthorized] = useState(() => !!getStoredAccessKey())
  const [checking, setChecking] = useState(() => !!getStoredAccessKey())

  useEffect(() => {
    const key = getStoredAccessKey()
    if (!key) return
    verifyAccessKey(key).then((ok) => {
      if (!ok) {
        clearStoredAccessKey()
        setAuthorized(false)
      }
      setChecking(false)
    })
  }, [])

  function handleAuthExpired() {
    clearStoredAccessKey()
    setAuthorized(false)
  }

  async function handleAccessSubmit(key: string): Promise<boolean> {
    const ok = await verifyAccessKey(key)
    if (ok) {
      setStoredAccessKey(key)
      setAuthorized(true)
    }
    return ok
  }

  if (checking) return <div className="boot-screen">Cargando…</div>
  if (!authorized) return <AccessGate onSubmit={handleAccessSubmit} />

  return <CertificateEditor onAuthExpired={handleAuthExpired} />
}
