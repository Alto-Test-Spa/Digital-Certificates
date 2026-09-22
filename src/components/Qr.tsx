import { create } from 'qrcode'

interface Props {
  value: string
}

// Ojos "finder" circulares (mismo tratamiento estético que el mockup:
// anillo oscuro / claro / punto oscuro), pero ahora dibujados según la
// posición real que exige la especificación QR (7 módulos, en las 3
// esquinas, sin importar el tamaño total de la matriz) — no una posición
// fija asumiendo 21x21.
function FinderEye({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={3.5} fill="#10151E" />
      <circle cx={cx} cy={cy} r={2.4} fill="#F4F5F2" />
      <circle cx={cx} cy={cy} r={1.35} fill="#10151E" />
    </g>
  )
}

export function Qr({ value }: Props) {
  // Nivel de corrección alto ('H', ~30% recuperable): necesario para poder
  // tapar el centro con "ALTO TEST" sin romper el escaneo. `create()` elige
  // automáticamente la versión (tamaño de matriz) mínima que entra a ese
  // nivel — nunca asumir un tamaño fijo, una URL más larga necesita más
  // módulos.
  const qr = create(value, { errorCorrectionLevel: 'H' })
  const { size } = qr.modules
  const mid = size / 2
  // Radio del hueco central para el logo, en módulos — calibrado para
  // quedar bajo el ~30% de tolerancia de 'H' sumado al margen que ya
  // consumen las formas circulares en vez de cuadradas exactas (ver Step 2
  // de verificación: se prueba con el decoder real, no se asume).
  const logoRadius = Math.max(3.2, size * 0.14)

  const isFinderZone = (x: number, y: number) =>
    (x < 8 && y < 8) || (x > size - 9 && y < 8) || (x < 8 && y > size - 9)

  const dots: { x: number; y: number }[] = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (isFinderZone(x, y)) continue
      const dx = x + 0.5 - mid
      const dy = y + 0.5 - mid
      if (Math.sqrt(dx * dx + dy * dy) < logoRadius) continue
      // .get(row, col) — método público de BitMatrix, más seguro que indexar
      // su array interno a mano (no está garantizado en los tipos de @types/qrcode).
      if (qr.modules.get(y, x)) dots.push({ x, y })
    }
  }

  return (
    <svg width={96} height={96} viewBox={`0 0 ${size} ${size}`}>
      <rect x={0} y={0} width={size} height={size} fill="#F4F5F2" />
      {dots.map((d, i) => (
        // r=0.46: casi todo el módulo (pitch=1), a propósito — un punto
        // chico como el del mockup decorativo (r=0.36, mucho hueco entre
        // puntos) no tiene suficiente "oscuridad" por módulo para que un
        // lector real lo distinga de fondo. Ver verificación con jsQR.
        <circle key={i} cx={d.x + 0.5} cy={d.y + 0.5} r={0.46} fill="#10151E" />
      ))}
      <FinderEye cx={3.5} cy={3.5} />
      <FinderEye cx={size - 3.5} cy={3.5} />
      <FinderEye cx={3.5} cy={size - 3.5} />
      <circle cx={mid} cy={mid} r={logoRadius} fill="#F4F5F2" />
      <circle cx={mid} cy={mid} r={logoRadius} fill="none" stroke="#10151E" strokeWidth={0.25} />
      <text x={mid} y={mid - 0.55} textAnchor="middle" fontFamily="IBM Plex Sans, sans-serif" fontWeight={700} fontSize={2.1} fill="#10151E">
        ALTO
      </text>
      <text x={mid} y={mid + 1.8} textAnchor="middle" fontFamily="IBM Plex Sans, sans-serif" fontWeight={700} fontSize={2.1} fill="#10151E">
        TEST
      </text>
    </svg>
  )
}
