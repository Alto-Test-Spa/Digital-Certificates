import type { CertificateState } from '../types'
import { normalizeCertificate } from './template'

const BASE_URL = import.meta.env.VITE_REPORTS_ENDPOINT
const ACCESS_KEY_STORAGE = 'altotest_certificado_access_key'
// `fetch` no tiene timeout propio: si la red falla de una forma que no
// rechaza la promesa (se cae en silencio a mitad de camino, un proxy que no
// responde, etc.), la llamada queda colgada para siempre y el autoguardado
// se ve pegado en "Guardando..." sin ningún error. AbortSignal.timeout()
// fuerza un límite razonable para que siempre termine en éxito o error.
const REQUEST_TIMEOUT_MS = 15_000

// Worker compartido con informe_levantamiento/propuesta_tecnica/propuesta_economica
// (ver altotest-documentos/src/index.ts) — "certificado" es el tipo de documento
// de esta app, parte de la ruta (/reports/certificado/:code).
const KIND = 'certificado'

export type SyncState = 'idle' | 'saving' | 'saved' | 'offline' | 'error'

export function getStoredAccessKey(): string {
  return localStorage.getItem(ACCESS_KEY_STORAGE) ?? ''
}
export function setStoredAccessKey(key: string) {
  localStorage.setItem(ACCESS_KEY_STORAGE, key)
}
export function clearStoredAccessKey() {
  localStorage.removeItem(ACCESS_KEY_STORAGE)
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const key = getStoredAccessKey()
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
      Authorization: `Bearer ${key}`,
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ApiError(res.status, text || res.statusText)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export interface CertificateSummary {
  code: string
  client: string
  date: string
  updatedAt: number
}

interface CertificateEnvelope {
  code: string
  kind: string
  client: string
  date: string
  updatedAt: number
  doc: CertificateState
}

export async function verifyAccessKey(key: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/reports/${KIND}`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  return res.ok
}

export function listCertificates(): Promise<CertificateSummary[]> {
  return request<CertificateSummary[]>(`/reports/${KIND}`)
}

export async function fetchCertificate(code: string): Promise<CertificateState> {
  const envelope = await request<CertificateEnvelope>(`/reports/${KIND}/${encodeURIComponent(code)}`)
  return normalizeCertificate(envelope.doc)
}

export function saveCertificate(cert: CertificateState): Promise<{ ok: boolean; updatedAt: number }> {
  const client = [cert.clientName, cert.clientAsset].filter(Boolean).join(' — ')
  return request(`/reports/${KIND}/${encodeURIComponent(cert.code)}`, {
    method: 'PUT',
    body: JSON.stringify({ code: cert.code, client, date: cert.certificationDate, doc: cert }),
  })
}

export function deleteCertificate(code: string): Promise<{ ok: boolean }> {
  return request(`/reports/${KIND}/${encodeURIComponent(code)}`, { method: 'DELETE' })
}
