interface Props {
  rows?: number;
}

const ROW_KICKER = ["TOP MARKET", "TOP MARKET", "VALUE", "ALT-LINE"];

export function PicksSkeleton({ rows = 4 }: Props) {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonCard key={i} kicker={ROW_KICKER[i] ?? "MARKET"} delayMs={i * 120} />
      ))}
    </div>
  );
}

function SkeletonCard({ kicker, delayMs }: { kicker: string; delayMs: number }) {
  return (
    <div
      className="grid items-center gap-4 rounded-lg border border-zs p-4"
      style={{
        gridTemplateColumns: "1fr 110px 110px 120px",
        background: "var(--zs-bg-elev)",
        animationDelay: `${delayMs}ms`,
      }}
    >
      {/* Left: kicker + placeholder lines */}
      <div className="flex flex-col gap-2">
        <span className="kicker">{kicker}</span>
        <div className="flex items-center gap-2">
          <SkeletonBar width={140} height={14} />
          <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">vs</span>
          <SkeletonBar width={140} height={14} />
        </div>
        <SkeletonBar width={220} height={10} />
      </div>

      {/* Edge cell */}
      <div className="flex flex-col gap-2">
        <SkeletonBar width={70} height={10} />
        <div className="edge-bar edge-bar-pulse" style={{ animationDelay: `${delayMs}ms` }}>
          <span
            style={{
              width: "100%",
              background: "var(--zs-info)",
              animationDelay: `${delayMs}ms`,
            }}
          />
        </div>
      </div>

      {/* Price cell */}
      <div className="flex flex-col gap-2">
        <SkeletonBar width={60} height={10} />
        <SkeletonBar width={80} height={16} />
      </div>

      {/* Stake cell — dashes that shimmer */}
      <div className="flex flex-col items-end gap-2">
        <span className="kicker">Stake</span>
        <span className="shimmer font-mono text-[14px] tabular-nums text-fg-muted">—.—%</span>
      </div>
    </div>
  );
}

function SkeletonBar({ width, height }: { width: number; height: number }) {
  return (
    <span
      className="shimmer block rounded-sm"
      style={{
        width,
        height,
        background: "var(--zs-surface)",
      }}
    />
  );
}
