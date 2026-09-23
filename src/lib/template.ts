import type { CertificateState } from '../types'

// Forma de CertificateState antes de "varios tipos de anclaje en un mismo
// lote" (ver CLAUDE.md) — certificados guardados con esta forma no traen
// `batchItems`, solo estos 5 campos sueltos a nivel raíz. Sólo para migrar
// en normalizeCertificate(), no es parte del modelo vigente.
interface LegacyBatchFields {
  deviceType?: string
  substrate?: string
  verificationTest?: string
  testLoad?: string
}

// Certificado en blanco con datos de ejemplo ya escritos — se abre lleno,
// no vacío (ver Certificate.tsx: los valores puntuales se marcan como
// ilustrativos con un asterisco, igual que el mockup aprobado). Los campos
// reales (tipo de dispositivo, ensayo, normas) son datos de dominio de
// verdad, no inventados — ver spec, sección 1.
export function initialTemplate(): CertificateState {
  return {
    code: '',
    title: 'Certificado de Conformidad Técnica de Instalación',
    clientName: 'CBRE',
    clientRut: '76.754.016-7',
    clientAsset: 'Edificio Costanera Norte — Torre B',
    address: 'Apoquindo 5427, Las Condes, Región Metropolitana de Santiago',
    certificationDate: '',
    expirationDate: '',
    validityNote:
      'Duración de 12 meses desde la fecha de validación, sujeta al plan de inspección y mantenimiento y a que no existan modificaciones, impactos, eventos de caída o intervenciones que puedan alterar las condiciones del sistema.',
    installedCountLabel: 'Cantidad instalada',
    installedCount: 46,
    certifiedCountLabel: 'Cantidad ensayada',
    certifiedCount: 46,
    batchItems: [
      {
        deviceType: 'Tipo A — anclaje estructural fijo',
        substrate: 'Hormigón armado',
        verificationTest: 'Pull-Out — tracción estática',
        testLoad: '6 kN',
        installedCount: 46,
        certifiedCount: 46,
        extra: [],
      },
    ],
    extraSpecFields: [],
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
  let merged: CertificateState = { ...base, ...partial }

  // `address` viajó siempre completo y correcto al Worker/site en TODA
  // forma anterior de este certificado (texto libre original, y luego
  // también durante la cascada Región/Comuna que se probó y se descartó —
  // ver CLAUDE.md) — el spread de arriba ya lo preserva tal cual sin
  // necesitar una migración especial acá.

  // Certificados guardados antes de "varios tipos de anclaje en un mismo
  // lote" (ver CLAUDE.md): no traen `batchItems`, sólo los 5 campos sueltos
  // de antes a nivel raíz. Se arma una sola fila con esos valores reales —
  // nunca con el ejemplo de la plantilla, mismo criterio que arriba — y se
  // deja `installedCount`/`certifiedCount` tal como venían guardados (ya
  // migran solos por el spread de más arriba, no dependen de esta fila).
  if (partial.batchItems === undefined) {
    const legacy = partial as LegacyBatchFields
    merged = {
      ...merged,
      batchItems: [
        {
          deviceType: legacy.deviceType ?? '',
          substrate: legacy.substrate ?? '',
          verificationTest: legacy.verificationTest ?? '',
          testLoad: legacy.testLoad ?? '',
          installedCount: partial.installedCount ?? 0,
          certifiedCount: partial.certifiedCount ?? 0,
          extra: [],
        },
      ],
    }
  }

  // Certificados guardados entre que existió `batchItems` y que existieron
  // las propiedades adicionales (`extraSpecFields`, ver Certificate.tsx):
  // sus filas no traen `extra`. Se normaliza siempre (no sólo acá arriba)
  // para que `item.extra` tenga el mismo largo que `extraSpecFields` en
  // cualquier certificado, sin volver a chequear `?? []` en la UI.
  merged = {
    ...merged,
    batchItems: merged.batchItems.map((item) => ({
      ...item,
      extra: merged.extraSpecFields.map((_, j) => item.extra?.[j] ?? ''),
    })),
  }

  return merged
}
