import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export type KpiTone = "pos" | "neg" | "info" | "warn";

interface Props {
  label: string;
  main: string;
  sub?: string;
  tone?: KpiTone;
  spark?: number[];
  hourStrip?: boolean[];
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

const toneVar = (tone?: KpiTone) =>
  tone === "pos" ? "var(--zs-pos)"
  : tone === "neg" ? "var(--zs-neg)"
  : tone === "info" ? "var(--zs-info)"
  : tone === "warn" ? "var(--zs-warn)"
  : "var(--zs-fg-muted)";

export const KpiCard = forwardRef<HTMLButtonElement | HTMLDivElement, Props>(
  function KpiCard(
    { label, main, sub, tone, spark, hourStrip, active, onClick, className },
    ref,
  ) {
    const interactive = typeof onClick === "function";
    const Wrapper: "button" | "div" = interactive ? "button" : "div";
    const subColor = toneVar(tone);

    const style: React.CSSProperties = {
      background: active ? "var(--zs-info-fill)" : "var(--zs-bg-elev)",
      borderColor: active
        ? "color-mix(in oklch, var(--zs-info) 50%, transparent)"
        : "var(--zs-border)",
    };

    return (
      <Wrapper
        ref={ref as never}
        type={interactive ? "button" : undefined}
        onClick={onClick}
        aria-pressed={interactive ? !!active : undefined}
        className={cn(
          "relative overflow-hidden rounded-lg border p-4 text-left transition-colors",
          interactive && "hover:bg-zs-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
        style={style}
      >
        <div className="kicker mb-1">{label}</div>
        <div className="flex items-end gap-2">
          <span
            className="font-mono text-2xl font-semibold tabular-nums"
            style={{ color: active ? "var(--zs-info)" : "var(--zs-fg)" }}
          >
            {main}
          </span>
          {spark && spark.length > 2 && <MiniSpark pts={spark} className="mb-0.5 ml-auto" />}
        </div>
        {hourStrip && hourStrip.length === 24 && (
          <div className="hour-strip mt-2" aria-hidden>
            {hourStrip.map((lit, i) => (
              <span key={i} className={cn("hour-dot", lit && "lit")} />
            ))}
          </div>
        )}
        {sub && (
          <div className="mt-1 font-mono text-[11px] tabular-nums" style={{ color: subColor }}>
            {sub}
          </div>
        )}
      </Wrapper>
    );
  },
);

function MiniSpark({ pts, className }: { pts: number[]; className?: string }) {
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const W = 60;
  const H = 22;
  const points = pts
    .map((p, i) => `${(i / (pts.length - 1)) * W},${H - ((p - min) / range) * (H - 2) - 1}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className={className}>
      <polyline
        className="zs-trace"
        pathLength="1"
        points={points}
        fill="none"
        stroke="var(--zs-pos)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
