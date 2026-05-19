interface Props {
  points: number[];
  height?: number;
  formatLabel?: (value: number) => string;
}

export function EquityChart({ points, height = 220, formatLabel }: Props) {
  if (!points || points.length < 2) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--zs-fg-muted)",
          letterSpacing: "0.08em",
        }}
      >
        — INSUFFICIENT DATA —
      </div>
    );
  }

  const w = 1200;
  const h = height;
  const padL = 56;
  const padB = 24;
  const padT = 12;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = (w - padL - 24) / (points.length - 1);

  const ptsArr = points.map((p, i) => [
    padL + i * stepX,
    padT + (h - padT - padB) - ((p - min) / range) * (h - padT - padB),
  ]);
  const pts = ptsArr.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const fillPath = `${padL},${h - padB} ${pts} ${(padL + (points.length - 1) * stepX).toFixed(1)},${h - padB}`;

  const ticks = 5;
  const labels = Array.from({ length: ticks }, (_, i) => {
    const val = min + (range * i) / (ticks - 1);
    const y = padT + (h - padT - padB) - ((val - min) / range) * (h - padT - padB);
    return { v: val, y };
  });

  const fmt = formatLabel ?? ((v: number) => Math.round(v).toLocaleString());

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block", width: "100%", height: h }}>
      {labels.map((l, i) => (
        <g key={i}>
          <line
            x1={padL}
            y1={l.y}
            x2={w - 24}
            y2={l.y}
            stroke="var(--zs-rule)"
            strokeWidth="0.5"
            strokeDasharray="2 4"
          />
          <text
            x={padL - 8}
            y={l.y + 3}
            fontFamily="var(--font-mono)"
            fontSize="9"
            fill="var(--zs-fg-muted)"
            textAnchor="end"
          >
            {fmt(l.v)}
          </text>
        </g>
      ))}
      <polygon points={fillPath} fill="var(--zs-accent)" opacity="0.10" />
      <polyline points={pts} fill="none" stroke="var(--zs-accent)" strokeWidth="1.4" />
      {ptsArr.map(([x, y], i) =>
        i % Math.max(1, Math.floor(points.length / 16)) === 0 ? (
          <circle key={i} cx={x} cy={y} r="1.5" fill="var(--zs-accent)" />
        ) : null,
      )}
    </svg>
  );
}
