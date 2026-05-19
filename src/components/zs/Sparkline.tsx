interface Props {
  points: number[];
  w?: number;
  h?: number;
  color?: string;
  fill?: boolean;
}

export function Sparkline({ points, w = 120, h = 32, color = "var(--zs-pos)", fill = false }: Props) {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = w / (points.length - 1);
  const pts = points
    .map((p, i) => `${(i * stepX).toFixed(1)},${(h - ((p - min) / range) * h).toFixed(1)}`)
    .join(" ");
  const fillPath = `0,${h} ${pts} ${w},${h}`;
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      {fill && <polygon className="zs-fade-in" points={fillPath} fill={color} opacity="0.12" />}
      <polyline className="zs-trace" pathLength="1" points={pts} fill="none" stroke={color} strokeWidth="1.4" />
    </svg>
  );
}
