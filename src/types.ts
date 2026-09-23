// Un solo objeto, autoguardado completo en cada cambio — mismo criterio que
// ReportState en informe_levantamiento (sin entidades separadas). "Lote" en
// vez de "por anclaje": ver spec, sección 1 — un certificado cubre N
// anclajes de un mismo recinto con resumen agregado, no una fila por
// anclaje.
// Una fila = un tipo/configuración de anclaje del lote (ver CLAUDE.md,
// "Varios tipos de anclaje en un mismo lote") — un mismo certificado puede
// cubrir, por ejemplo, anclajes mecánicos a metal y químicos a hormigón en
// la misma instalación, cada uno con su propia ficha técnica.
export interface BatchItem {
  deviceType: string
  substrate: string
  verificationTest: string
  testLoad: string
  installedCount: number
  certifiedCount: number
  extra: string[] // valores de las filas adicionales — extra[j] corresponde a CertificateState.extraSpecFields[j], mismo índice en todas las filas del lote (ver Certificate.tsx)
}

export interface CertificateState {
  code: string
  title: string // título principal editable — Certificado/Informe según el camino (ver Certificate.tsx)
  clientName: string
  clientRut: string
  clientAsset: string // recinto/edificio/proyecto
  address: string // texto libre, editable directo — es el que viaja al Worker/site (ver api.ts, site/src/lib/verify.ts)
  certificationDate: string // dd-mm-aaaa
  expirationDate: string // dd-mm-aaaa
  validityNote: string // texto editable bajo "Vigencia", ver Certificate.tsx
  installedCountLabel: string // etiqueta editable: "Cantidad instalada"/"inspeccionada"/"existente"/etc. — también encabezado de columna en la ficha técnica
  installedCount: number // DERIVADO: suma de batchItems[].installedCount, se recalcula en Certificate.tsx (mismo criterio que `address`) — es el que viaja al Worker/site
  certifiedCountLabel: string // etiqueta editable: "Cantidad ensayada"/etc.
  certifiedCount: number // DERIVADO: suma de batchItems[].certifiedCount
  batchItems: BatchItem[] // una fila por tipo/configuración de anclaje del lote, ver Certificate.tsx
  extraSpecFields: string[] // etiquetas de filas adicionales de la ficha técnica, agregadas a mano con "+ agregar propiedad" — ver Certificate.tsx
  standards: string[] // chips "normas aplicables", editable
  description: string
}
