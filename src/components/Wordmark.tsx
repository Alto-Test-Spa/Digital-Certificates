type Tone = "signal" | "steel" | "paper" | "ink"

const STROKE: Record<Tone, string> = {
  signal: "#C2491F",
  steel: "#4C6B7A",
  paper: "#F4F5F2",
  ink: "#10151E",
}

const ANCHOR: Record<Tone, string> = {
  signal: "#10151E",
  steel: "#10151E",
  paper: "#F4F5F2",
  ink: "#10151E",
}

export function Wordmark({
  tone = "steel",
  textClassName = "text-[15px]",
}: {
  tone?: Tone
  textClassName?: string
}) {
  return (
    <span className="inline-flex flex-col items-center">
      <span
        className={`font-mono font-semibold tracking-[0.03em] ${textClassName}`}
      >
        ALTO TEST
      </span>
      <svg
        viewBox="0 0 100 16"
        preserveAspectRatio="none"
        className="mt-1 h-3.5 w-full"
        aria-hidden="true"
      >
        <path
          d="M2,5 Q50,15 98,5"
          stroke={STROKE[tone]}
          strokeWidth={2.2}
          vectorEffect="non-scaling-stroke"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx={2} cy={5} r={2.6} fill={ANCHOR[tone]} />
        <circle cx={98} cy={5} r={2.6} fill={ANCHOR[tone]} />
      </svg>
    </span>
  )
}
