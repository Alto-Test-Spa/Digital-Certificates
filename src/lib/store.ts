import { useEffect, useRef, useState } from 'react'
import type { CertificateState } from '../types'
import { initialTemplate, normalizeCertificate } from './template'
import { generateCode, isValidCode } from './code'
import { todayDate, addOneYear } from './date'
import { fetchCertificate, saveCertificate, ApiError } from './api'
import type { SyncState } from './api'

// Mirror local de resiliencia, no fuente de datos — la nube manda (mismo
// criterio que informe_levantamiento, ver su CLAUDE.md "Nube como fuente
// de verdad").
const MIRROR_KEY = 'altotest_certificado_mirror'
const PREVIOUS_KEY = `${MIRROR_KEY}_previous`
const AUTOSAVE_DEBOUNCE_MS = 3000

function serialize(cert: CertificateState): string {
  return JSON.stringify(cert)
}

function withCodeAndDates(cert: CertificateState): CertificateState {
  const certificationDate = cert.certificationDate || todayDate()
  return {
    ...cert,
    code: cert.code && isValidCode(cert.code) ? cert.code : generateCode(),
    certificationDate,
    expirationDate: cert.expirationDate || addOneYear(certificationDate),
  }
}

function readMirror(): CertificateState | null {
  const saved = localStorage.getItem(MIRROR_KEY)
  if (!saved) return null
  try {
    return normalizeCertificate(JSON.parse(saved) as Partial<CertificateState>)
  } catch {
    return null
  }
}

function writeMirror(cert: CertificateState) {
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify(cert))
  } catch (e) {
    console.warn('No se pudo escribir la copia local del certificado:', e)
  }
}

export function useCertificateStore(onAuthExpired: () => void) {
  const [cert, setCert] = useState<CertificateState>(() => withCodeAndDates(readMirror() ?? initialTemplate()))
  const [canUndo, setCanUndo] = useState(() => !!localStorage.getItem(PREVIOUS_KEY))
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [booting, setBooting] = useState(() => !!readMirror())
  const firstChangeAfterReset = useRef(false)
  const saveSeq = useRef(0)
  const hadMirrorOnBoot = useRef(!!readMirror())
  const pristineCert = useRef(cert)
  const [initialSerialized] = useState(() => serialize(cert))
  const lastSavedRef = useRef(initialSerialized)
  const onAuthExpiredRef = useRef(onAuthExpired)
  useEffect(() => {
    onAuthExpiredRef.current = onAuthExpired
  })

  useEffect(() => {
    const mirror = readMirror()
    if (!mirror) return
    fetchCertificate(mirror.code)
      .then((fresh) => {
        setCert(fresh)
        writeMirror(fresh)
        lastSavedRef.current = serialize(fresh)
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          onAuthExpiredRef.current()
          return
        }
        if (e instanceof ApiError && e.status === 404) return
        setSyncState('offline')
      })
      .finally(() => setBooting(false))
  }, [])

  useEffect(() => {
    const isUntouched = !hadMirrorOnBoot.current && cert === pristineCert.current
    if (isUntouched) return
    const seq = ++saveSeq.current
    const t = setTimeout(async () => {
      const snapshot = serialize(cert)
      if (snapshot === lastSavedRef.current) return
      writeMirror(cert)
      setSyncState('saving')
      try {
        await saveCertificate(cert)
        if (saveSeq.current === seq) {
          lastSavedRef.current = snapshot
          setSyncState('saved')
        }
      } catch (e) {
        if (saveSeq.current !== seq) return
        if (e instanceof ApiError) {
          if (e.status === 401) {
            onAuthExpiredRef.current()
            return
          }
          setSyncState('error')
        } else {
          setSyncState('offline')
        }
      }
      if (firstChangeAfterReset.current) {
        firstChangeAfterReset.current = false
        localStorage.removeItem(PREVIOUS_KEY)
        setCanUndo(false)
      }
    }, AUTOSAVE_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [cert])

  useEffect(() => {
    const flushIfHidden = () => {
      if (document.visibilityState !== 'hidden') return
      const snapshot = serialize(cert)
      if (snapshot === lastSavedRef.current) return
      const seq = ++saveSeq.current
      writeMirror(cert)
      saveCertificate(cert)
        .then(() => {
          if (saveSeq.current === seq) lastSavedRef.current = snapshot
        })
        .catch(() => {})
    }
    document.addEventListener('visibilitychange', flushIfHidden)
    return () => document.removeEventListener('visibilitychange', flushIfHidden)
  }, [cert])

  function reset() {
    localStorage.setItem(PREVIOUS_KEY, JSON.stringify(cert))
    firstChangeAfterReset.current = true
    setCanUndo(true)
    setCert(withCodeAndDates(initialTemplate()))
  }

  function undo() {
    const saved = localStorage.getItem(PREVIOUS_KEY)
    if (!saved) return
    setCert(JSON.parse(saved))
    localStorage.removeItem(PREVIOUS_KEY)
    firstChangeAfterReset.current = false
    setCanUndo(false)
  }

  // Reemplaza el certificado activo por uno que viene del Historial —
  // a diferencia de "Deshacer" (un solo paso), esto permite volver a
  // CUALQUIER certificado guardado en el servidor.
  function loadCertificate(incoming: CertificateState) {
    setCert(incoming)
  }

  return { cert, setCert, reset, undo, canUndo, loadCertificate, syncState, booting }
}
