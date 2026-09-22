// Un solo objeto, autoguardado completo en cada cambio — mismo criterio que
// ReportState en informe_levantamiento (sin entidades separadas). "Lote" en
// vez de "por anclaje": ver spec, sección 1 — un certificado cubre N
// anclajes de un mismo recinto con resumen agregado, no una fila por
// anclaje.
export interface CertificateState {
  code: string
  clientName: string
  clientRut: string
  clientAsset: string // recinto/edificio/proyecto
  address: string
  certificationDate: string // dd-mm-aaaa
  expirationDate: string // dd-mm-aaaa
  validityNote: string // texto editable bajo "Vigencia", ver Certificate.tsx
  deviceType: string
  substrate: string
  materiality: string
  verificationTest: string
  testLoad: string
  installedCount: number
  certifiedCount: number
  standards: string[] // chips "normas aplicables", editable
  description: string
}
