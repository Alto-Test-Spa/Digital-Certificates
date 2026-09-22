import type { CertificateState } from '../types'

const DEFAULT_STREET = 'Apoquindo 5427'
const DEFAULT_COMUNA = 'Las Condes'
const DEFAULT_REGION = 'Región Metropolitana de Santiago'

// Certificado en blanco con datos de ejemplo ya escritos — se abre lleno,
// no vacío (ver Certificate.tsx: los valores puntuales se marcan como
// ilustrativos con un asterisco, igual que el mockup aprobado). Los campos
// reales (tipo de dispositivo, ensayo, normas) son datos de dominio de
// verdad, no inventados — ver spec, sección 1.
export function initialTemplate(): CertificateState {
  return {
    code: '',
    clientName: 'CBRE',
    clientRut: '76.754.016-7',
    clientAsset: 'Edificio Costanera Norte — Torre B',
    street: DEFAULT_STREET,
    comuna: DEFAULT_COMUNA,
    region: DEFAULT_REGION,
    address: [DEFAULT_STREET, DEFAULT_COMUNA, DEFAULT_REGION].join(', '),
    certificationDate: '',
    expirationDate: '',
    validityNote:
      'Duración de 1 año calendario desde la fecha de certificación. Sujeto a inspección periódica conforme EN 365:2004.',
    deviceType: 'Tipo A — anclaje estructural fijo',
    substrate: 'Hormigón armado',
    materiality: 'Acero inoxidable A4',
    verificationTest: 'Pull-Out — tracción estática',
    testLoad: '12,5 kN (valor representativo del lote)',
    installedCount: 46,
    certifiedCount: 46,
    standards: ['EN 795:2012 – Tipo A', 'BS 8610:2017', 'ACI 355.2 + ETA / documentación fabricante'],
    description: 'Certificado de lote, trazable al levantamiento técnico N° IL-20260615-093000, Alto Test.',
  }
}

// Fusiona un documento leído del Worker sobre la plantilla en blanco — si se
// agrega un campo nuevo a CertificateState más adelante, un certificado
// viejo guardado sin ese campo no rompe la UI (mismo patrón que
// normalizeReport en informe_levantamiento/src/lib/template.ts).
export function normalizeCertificate(partial: Partial<CertificateState>): CertificateState {
  const base = initialTemplate()
  // Certificados guardados antes de que existieran region/comuna (ver
  // Certificate.tsx): no rellenar con los valores de ejemplo de la
  // plantilla, o se pisaría la dirección real. Toda la dirección vieja
  // queda tal cual en `street`, y region/comuna quedan vacías para que se
  // completen a mano — `address` no se toca, sigue mostrando lo guardado.
  if (partial.region === undefined && partial.comuna === undefined && partial.address) {
    return { ...base, ...partial, street: partial.address, region: '', comuna: '' }
  }
  return { ...base, ...partial }
}
