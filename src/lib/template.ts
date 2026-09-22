import type { CertificateState } from '../types'

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
    address: 'Apoquindo 5427, Las Condes, Región Metropolitana',
    certificationDate: '',
    expirationDate: '',
    validityNote:
      'Duración de 1 año calendario desde la fecha de certificación. Sujeto a inspección periódica conforme EN 365:2004.',
    deviceType: 'Tipo A — anclaje estructural fijo',
    substrate: 'Hormigón armado',
    materiality: 'Acero inoxidable A4',
    verificationTest: 'Pull-Out — tracción estática',
    testLoad: '12,5 kN (valor representativo del lote) *',
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
  return { ...initialTemplate(), ...partial }
}
