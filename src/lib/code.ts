function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

const CODE_PATTERN = /^CPA-\d{8}-\d{6}$/

// Certificado de Punto(s) de Anclaje — mismo criterio de folio que el resto
// de la familia (IL-/PT-/COT-aaaammdd-hhmmss).
export function generateCode(): string {
  const d = new Date()
  const date = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
  const time = `${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
  return `CPA-${date}-${time}`
}

export function isValidCode(code: string): boolean {
  return CODE_PATTERN.test(code)
}
