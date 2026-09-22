// Un solo objeto, autoguardado completo en cada cambio — mismo criterio que
// ReportState en informe_levantamiento (sin entidades separadas). "Lote" en
// vez de "por anclaje": ver spec, sección 1 — un certificado cubre N
// anclajes de un mismo recinto con resumen agregado, no una fila por
// anclaje.
export interface CertificateState {
  code: string
  title: string // título principal editable — Certificado/Informe según el camino (ver Certificate.tsx)
  clientName: string
  clientRut: string
  clientAsset: string // recinto/edificio/proyecto
  street: string // calle y número, editable libre — ver Certificate.tsx
  region: string // nombre oficial completo, ver lib/regiones.ts
  comuna: string // filtrada según `region`, ver lib/regiones.ts
  address: string // derivado de street + comuna + region, se recalcula en cada cambio — es el que viaja al Worker/site (ver api.ts, site/src/lib/verify.ts)
  certificationDate: string // dd-mm-aaaa
  expirationDate: string // dd-mm-aaaa
  validityNote: string // texto editable bajo "Vigencia", ver Certificate.tsx
  deviceType: string
  substrate: string
  materiality: string
  verificationTest: string
  testLoad: string
  installedCountLabel: string // etiqueta editable: "Cantidad instalada"/"inspeccionada"/"existente"/etc.
  installedCount: number
  certifiedCountLabel: string // etiqueta editable: "Cantidad ensayada"/etc.
  certifiedCount: number
  standards: string[] // chips "normas aplicables", editable
  description: string
}
