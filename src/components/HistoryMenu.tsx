import { useEffect, useRef, useState } from 'react'
import type { CertificateState } from '../types'
import { listCertificates, deleteCertificate, fetchCertificate, type CertificateSummary } from '../lib/api'

interface Props {
  currentCode: string
  onOpen: (cert: CertificateState) => void
}

export function HistoryMenu({ currentCode, onOpen }: Props) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<CertificateSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [openingCode, setOpeningCode] = useState<string | null>(null)
  const [error, setError] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      setItems(await listCertificates())
    } catch {
      setError('No se pudo cargar el historial.')
    } finally {
      setLoading(false)
    }
  }

  function toggle() {
    if (!open) refresh()
    setOpen((v) => !v)
  }

  async function openItem(code: string) {
    setOpeningCode(code)
    try {
      onOpen(await fetchCertificate(code))
      setOpen(false)
    } catch {
      setError('No se pudo abrir ese certificado.')
    } finally {
      setOpeningCode(null)
    }
  }

  async function removeItem(code: string) {
    try {
      await deleteCertificate(code)
      setItems((prev) => prev.filter((i) => i.code !== code))
    } catch {
      setError('No se pudo quitar ese certificado.')
    }
  }

  return (
    <div className="history-menu no-print" ref={ref}>
      <button type="button" className="toolbar-btn toolbar-btn--ghost" onClick={toggle}>
        Historial
      </button>
      {open && (
        <div className="history-dropdown">
          {loading && <p className="history-empty">Cargando…</p>}
          {!loading && error && <p className="history-empty">{error}</p>}
          {!loading && !error && items.length === 0 && <p className="history-empty">Todavía no hay certificados guardados.</p>}
          {!loading &&
            !error &&
            items.map((item) => (
              <div key={item.code} className={`history-item ${item.code === currentCode ? 'is-current' : ''}`}>
                <button type="button" className="history-item-open" disabled={openingCode !== null} onClick={() => openItem(item.code)}>
                  <p className="history-item-code">
                    {item.code}
                    {item.code === currentCode && <span className="history-item-tag"> · actual</span>}
                  </p>
                  <p className="history-item-client">{item.client || 'Sin cliente'}</p>
                  <p className="history-item-date">{item.date || 'sin fecha'}</p>
                </button>
                <button type="button" className="history-item-remove" onClick={() => removeItem(item.code)}>
                  ×
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
