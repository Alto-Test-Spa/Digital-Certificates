import { Certificate } from './components/Certificate'
import { initialTemplate } from './lib/template'
import { useState } from 'react'
import type { CertificateState } from './types'

export default function CertificateEditor(_: { onAuthExpired?: () => void }) {
  const [cert, setCert] = useState<CertificateState>(initialTemplate())
  return <Certificate cert={cert} onChange={(patch) => setCert((c) => ({ ...c, ...patch }))} />
}
