type Tone = "signal" | "steel" | "paper"

const STROKE: Record<Tone, string> = {
  signal: "#C2491F",
  steel: "#4C6B7A",
  paper: "#F4F5F2",
}

const ANCHOR: Record<Tone, string> = {
  signal: "#10151E",
  steel: "#10151E",
  paper: "#10151E",
}

export function Logomark({
  tone = "steel",
  width = 34,
  height = 14,
}: {
  tone?: Tone
  width?: number
  height?: number
}) {
  return (
    <svg width={width} height={height} viewBox="0 0 34 14" aria-hidden="true">
      <path
        d="M2,7 Q17,13 32,7"
        stroke={STROKE[tone]}
        strokeWidth={2}
        fill="none"
      />
      <circle cx={2} cy={7} r={2.2} fill={ANCHOR[tone]} />
      <circle cx={32} cy={7} r={2.2} fill={ANCHOR[tone]} />
    </svg>
  )
}
