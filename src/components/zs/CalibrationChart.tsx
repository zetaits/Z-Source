export interface CalibrationBin {
  pred: number;
  real: number;
  n: number;
}

interface Props {
  data: CalibrationBin[];
  height?: number;
}

export function CalibrationChart({ data, height = 240 }: Props) {
  const w = 360;
  const h = height;
  const pad = 32;
  const sx = (v: number) => pad + v * (w - pad * 2);
  const sy = (v: number) => h - pad - v * (h - pad * 2);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", width: "100%", maxHeight: `${h}px` }}
    >
      {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t, i) => (
        <g key={i}>
          <line x1={sx(t)} y1={pad} x2={sx(t)} y2={h - pad}
            stroke="var(--zs-rule)" strokeWidth="0.5" strokeDasharray="2 4" />
          <line x1={pad} y1={sy(t)} x2={w - pad} y2={sy(t)}
            stroke="var(--zs-rule)" strokeWidth="0.5" strokeDasharray="2 4" />
          <text x={sx(t)} y={h - pad + 12} fontFamily="var(--font-mono)" fontSize="8"
            fill="var(--zs-fg-muted)" textAnchor="middle">{Math.round(t * 100)}</text>
          <text x={pad - 6} y={sy(t) + 3} fontFamily="var(--font-mono)" fontSize="8"
            fill="var(--zs-fg-muted)" textAnchor="end">{Math.round(t * 100)}</text>
        </g>
      ))}
      <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(1)}
        stroke="var(--zs-accent)" strokeWidth="1" strokeDasharray="3 3" opacity="0.55" />
      {data.map((d, i) => {
        const r = 3 + Math.log2(Math.max(2, d.n)) * 0.7;
        const off = d.real - d.pred;
        const color = Math.abs(off) < 0.04 ? "var(--zs-pos)" : "var(--zs-accent)";
        return (
          <g key={i}>
            <circle cx={sx(d.pred)} cy={sy(d.real)} r={r} fill={color} opacity="0.18" />
            <circle cx={sx(d.pred)} cy={sy(d.real)} r="2" fill={color} />
          </g>
        );
      })}
      <text x={w / 2} y={h - 4} fontFamily="var(--font-mono)" fontSize="9"
        fill="var(--zs-fg-dim)" textAnchor="middle" letterSpacing="0.1em">PREDICTED %</text>
      <text x={10} y={h / 2} fontFamily="var(--font-mono)" fontSize="9"
        fill="var(--zs-fg-dim)" textAnchor="middle" letterSpacing="0.1em"
        transform={`rotate(-90 10 ${h / 2})`}>REALISED %</text>
    </svg>
  );
}
