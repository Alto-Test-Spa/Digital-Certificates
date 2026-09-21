function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

// Formato con GUIONES (dd-mm-aaaa), no barras — así quedó aprobado en el
// mockup del certificado (distinto del dd/mm/aaaa que usa informe_levantamiento;
// es una convención propia de este documento, no un error de copiar/pegar).
export function todayDate(): string {
  const d = new Date()
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`
}

export function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean)
  return parts.join('-')
}

function parseDateParts(value: string): { day: number; month: number; year: number } | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value)
  if (!m) return null
  return { day: Number(m[1]), month: Number(m[2]), year: Number(m[3]) }
}

export function isValidDate(value: string): boolean {
  const parts = parseDateParts(value)
  if (!parts) return false
  const d = new Date(parts.year, parts.month - 1, parts.day)
  return d.getFullYear() === parts.year && d.getMonth() === parts.month - 1 && d.getDate() === parts.day
}

// Vigencia por defecto del certificado: 1 año calendario desde la fecha de
// certificación (ver spec, "Vigencia"). Devuelve '' si `from` no es una
// fecha válida, en vez de fabricar una fecha basura.
export function addOneYear(from: string): string {
  const parts = parseDateParts(from)
  if (!parts) return ''
  const d = new Date(parts.year + 1, parts.month - 1, parts.day)
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`
}

// Usado tanto por CertificateEditor (mostrar "vigente"/"vencido" en la
// barra) como, más adelante, por site/'s Verify.tsx (duplicado a propósito,
// mismo criterio que la validación del formulario de contacto de site/ —
// ver ese CLAUDE.md, "Validación duplicada a propósito").
export function isStillValid(expirationDate: string): boolean {
  const parts = parseDateParts(expirationDate)
  if (!parts) return false
  const target = new Date(parts.year, parts.month - 1, parts.day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today.getTime() <= target.getTime()
}
