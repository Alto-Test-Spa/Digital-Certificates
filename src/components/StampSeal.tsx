const R = 17.5

function ringPath(id: string, startDeg: number, sweep: 0 | 1) {
  const rad = (startDeg * Math.PI) / 180
  const x = R * Math.sin(rad)
  const y = sweep === 1 ? R * Math.cos(rad) : -R * Math.cos(rad)
  // The arc's sweep-flag is the complement of `sweep` (not `sweep` itself):
  // `sweep` picks the y-sign (top vs. bottom half via the ternary above), but
  // per the SVG arc endpoint-to-center parameterization, landing the minor
  // arc on this same origin-centered ring (rather than on the other,
  // off-center circle of radius R that also passes through the two
  // endpoints) requires the opposite sweep-flag value in the path command.
  return { id, d: `M ${-x},${y} A ${R},${R} 0 0 ${1 - sweep} ${x},${y}` }
}

// Timbre institucional — trazado geométricamente (no una imagen), portado
// del <script> del mockup aprobado a JSX declarativo. Mismo cálculo
// trigonométrico: dos arcos de texto (arriba/abajo) sobre un anillo doble,
// con el nombre y la norma centrados.
export function StampSeal() {
  const top = ringPath('stamp-top', 50, 0)
  const bot = ringPath('stamp-bot', 72, 1)

  return (
    <svg width={176} height={176} viewBox="-24 -24 48 48">
      <defs>
        <path id={top.id} d={top.d} fill="none" />
        <path id={bot.id} d={bot.d} fill="none" />
      </defs>
      <circle cx={0} cy={0} r={R} fill="none" stroke="#10151E" strokeWidth={6.5} />
      <circle cx={0} cy={0} r={R - 4.1} fill="none" stroke="#10151E" strokeWidth={0.35} />
      <text textAnchor="middle" fontFamily="IBM Plex Sans, sans-serif" fontWeight={700} fontSize={3.3} fill="#F4F5F2" letterSpacing="0.06em">
        <textPath href={`#${top.id}`} startOffset="50%">
          CERTIFICADO
        </textPath>
      </text>
      <text textAnchor="middle" fontFamily="IBM Plex Sans, sans-serif" fontWeight={700} fontSize={2.5} fill="#F4F5F2" letterSpacing="0.02em">
        {/* @ts-expect-error — `side` is SVG2, not yet in React's SVGTextPathElement typings */}
        <textPath href={`#${bot.id}`} startOffset="50%" side="right">
          PUNTOS DE ANCLAJE
        </textPath>
      </text>
      <text x={0} y={-1} textAnchor="middle" fontFamily="IBM Plex Sans, sans-serif" fontWeight={700} fontSize={4.4} fill="#10151E">
        ALTO TEST
      </text>
      <text x={0} y={4.8} textAnchor="middle" fontFamily="IBM Plex Sans, sans-serif" fontWeight={600} fontSize={2.9} fill="#10151E">
        EN 795:2012
      </text>
    </svg>
  )
}
