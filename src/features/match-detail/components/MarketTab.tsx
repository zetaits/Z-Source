import type { MatchId } from "@/domain/ids";
import type { MarketKey } from "@/domain/market";
import type { LineSnapshot } from "@/domain/odds";
import type { SplitData, Splits } from "@/domain/splits";
import { Block, Tag } from "@/components/zs";
import { marketByKey } from "@/config/markets";
import { LineHistoryPanel } from "./LineHistoryPanel";

interface Props {
  splits: Partial<Record<MarketKey, Splits>>;
  lines: Partial<Record<MarketKey, LineSnapshot>>;
  homeName: string;
  awayName: string;
  matchId: MatchId | null;
}

interface DivergenceTop {
  marketKey: MarketKey;
  sideLabel: string;
  oppositeLabel: string;
  deltaPp: number;
  sharpLeansHome: boolean | null;
}

const formatSelectionLabel = (
  marketKey: MarketKey,
  row: SplitData,
  homeName: string,
  awayName: string,
): string => {
  const { side, line } = row.selection;
  let base: string;
  if (side === "home") base = homeName;
  else if (side === "away") base = awayName;
  else if (side === "draw") base = "Draw";
  else if (side === "yes") base = marketKey === "BTTS" ? "BTTS Yes" : "Yes";
  else if (side === "no") base = marketKey === "BTTS" ? "BTTS No" : "No";
  else if (side === "over") base = "Over";
  else if (side === "under") base = "Under";
  else base = side;
  if (line !== undefined) {
    const sign = line > 0 ? "+" : "";
    base += ` ${sign}${line}`;
  }
  return base;
};

const computeTopDivergence = (
  splits: Partial<Record<MarketKey, Splits>>,
  homeName: string,
  awayName: string,
): DivergenceTop | null => {
  let best: DivergenceTop | null = null;
  for (const [marketKey, group] of Object.entries(splits) as [MarketKey, Splits][]) {
    for (const row of group.rows) {
      if (typeof row.betsPct !== "number" || typeof row.moneyPct !== "number") continue;
      const delta = row.moneyPct - row.betsPct;
      if (!best || Math.abs(delta) > Math.abs(best.deltaPp)) {
        const sideLabel = formatSelectionLabel(marketKey, row, homeName, awayName);
        // pick a paired opposite for narrative
        const opposite = group.rows.find(
          (r) => r.selection.side !== row.selection.side,
        );
        const oppositeLabel = opposite
          ? formatSelectionLabel(marketKey, opposite, homeName, awayName)
          : "public";
        const sharpHome =
          row.selection.side === "home"
            ? delta > 0
            : row.selection.side === "away"
              ? delta < 0
              : null;
        best = {
          marketKey,
          sideLabel,
          oppositeLabel,
          deltaPp: Math.round(delta),
          sharpLeansHome: sharpHome,
        };
      }
    }
  }
  return best;
};

interface SplitRowVM {
  label: string;
  betsPct?: number;
  moneyPct?: number;
  deltaPp: number | null;
  selectedSide: string;
}

const buildSplitRows = (
  marketKey: MarketKey,
  group: Splits,
  homeName: string,
  awayName: string,
): SplitRowVM[] =>
  group.rows.map((row) => {
    const hasBoth =
      typeof row.betsPct === "number" && typeof row.moneyPct === "number";
    return {
      label: formatSelectionLabel(marketKey, row, homeName, awayName),
      betsPct: row.betsPct,
      moneyPct: row.moneyPct,
      deltaPp: hasBoth ? Math.round(row.moneyPct! - row.betsPct!) : null,
      selectedSide: row.selection.side,
    };
  });

export function MarketTab({ splits, homeName, awayName, matchId }: Props) {
  const splitEntries = Object.entries(splits) as [MarketKey, Splits][];
  const top = computeTopDivergence(splits, homeName, awayName);

  const totalSplitsRows = splitEntries.reduce(
    (acc, [, group]) => acc + group.rows.length,
    0,
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {top && <SignalHero top={top} />}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: splitEntries.length > 0 ? "1.4fr 1fr" : "1fr",
          gap: 18,
        }}
      >
        {splitEntries.length > 0 && (
          <Block
            head="CROWD vs SHARP · BY MARKET"
            headRight={
              <>
                <Tag>{splitEntries.length}</Tag>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--zs-fg-muted)",
                    letterSpacing: "0.10em",
                  }}
                >
                  {totalSplitsRows} ROWS
                </span>
              </>
            }
            pad={false}
          >
            <div>
              {splitEntries.map(([marketKey, group], i) => (
                <SplitsMarketBlock
                  key={marketKey}
                  marketKey={marketKey}
                  rows={buildSplitRows(marketKey, group, homeName, awayName)}
                  source={group.source}
                  bookId={group.bookId}
                  last={i === splitEntries.length - 1}
                />
              ))}
            </div>
          </Block>
        )}

        <Block
          head="LINE MOVEMENT · 24H"
          headRight={
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--zs-fg-muted)",
                letterSpacing: "0.10em",
              }}
            >
              PRICE ▾ · PUBLIC% ▸
            </span>
          }
        >
          <LineHistoryPanel matchId={matchId} />
        </Block>
      </div>

      {splitEntries.length === 0 && (
        <div className="rounded-lg border border-dashed bg-card p-6 text-center text-xs text-muted-foreground">
          No crowd/sharp splits available for this fixture. Run analysis once odds resolve.
        </div>
      )}
    </div>
  );
}

function SignalHero({ top }: { top: DivergenceTop }) {
  const sharpFill = "color-mix(in oklch, var(--zs-info) 8%, transparent)";
  const sharpColor =
    Math.abs(top.deltaPp) >= 15 ? "var(--zs-info)" : "var(--zs-fg-muted)";
  const signal =
    Math.abs(top.deltaPp) >= 15
      ? "SHARP DIVERGENCE"
      : Math.abs(top.deltaPp) >= 5
        ? "MILD DIVERGENCE"
        : "FLAT";

  const descriptor = marketByKey(top.marketKey)?.label ?? top.marketKey;

  return (
    <div className="zs-block" style={{ padding: 0, borderColor: sharpColor }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) repeat(2, minmax(0, 1fr))",
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            padding: "18px 22px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 8,
            background: sharpFill,
            borderRight: "1px solid var(--zs-border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                color: sharpColor,
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.18em",
              }}
            >
              ◆ {signal}
            </span>
            <Tag tone={Math.abs(top.deltaPp) >= 15 ? "info" : undefined}>
              {descriptor}
            </Tag>
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 16,
              color: "var(--zs-fg)",
              lineHeight: 1.4,
              letterSpacing: "-0.005em",
            }}
          >
            Money is on{" "}
            <strong style={{ color: "var(--zs-info)" }}>{top.sideLabel}</strong>{" "}
            while public sits on{" "}
            <strong style={{ color: "var(--zs-warn)" }}>{top.oppositeLabel}</strong>.
          </div>
        </div>
        <KpiCell
          k="DIVERGENCE"
          v={`${top.deltaPp > 0 ? "+" : ""}${top.deltaPp}pp`}
          sub="money − tickets"
          tone={sharpColor}
          border
        />
        <KpiCell
          k="MARKET"
          v={top.marketKey.replace("_", " ")}
          sub="largest signal"
          tone="var(--zs-fg)"
          border
        />
      </div>
    </div>
  );
}

function KpiCell({
  k,
  v,
  sub,
  tone,
  border,
}: {
  k: string;
  v: string;
  sub: string;
  tone: string;
  border?: boolean;
}) {
  return (
    <div
      style={{
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 6,
        borderLeft: border ? "1px solid var(--zs-border)" : "none",
      }}
    >
      <div className="zs-caption" style={{ fontSize: 9 }}>
        {k}
      </div>
      <div
        className="zs-bignum"
        style={{
          fontSize: 26,
          color: tone,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {v}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--zs-fg-dim)",
          letterSpacing: "0.04em",
        }}
      >
        {sub}
      </div>
    </div>
  );
}

function SplitsMarketBlock({
  marketKey,
  rows,
  source,
  bookId,
  last,
}: {
  marketKey: MarketKey;
  rows: SplitRowVM[];
  source: string;
  bookId?: string;
  last: boolean;
}) {
  const descriptor = marketByKey(marketKey);
  return (
    <div
      style={{
        padding: "16px 18px",
        borderBottom: last ? "none" : "1px solid var(--zs-border)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 700,
            color: "var(--zs-fg)",
            letterSpacing: "0.14em",
          }}
        >
          ▸ {descriptor?.label ?? marketKey}
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: "var(--zs-fg-muted)",
            letterSpacing: "0.08em",
          }}
        >
          <span>{source}</span>
          {bookId && <span>· {bookId}</span>}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((r, i) => (
          <SplitRowView key={`${r.label}:${i}`} row={r} />
        ))}
      </div>
    </div>
  );
}

function SplitRowView({ row }: { row: SplitRowVM }) {
  const accent =
    row.deltaPp === null
      ? "var(--zs-fg-muted)"
      : row.deltaPp <= -5
        ? "var(--zs-warn)"
        : row.deltaPp >= 5
          ? "var(--zs-info)"
          : "var(--zs-fg-muted)";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr 90px",
        gap: 14,
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--zs-fg)",
          letterSpacing: "0.04em",
        }}
      >
        {row.label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <SplitBar label="TICKETS" pct={row.betsPct} color="var(--zs-warn)" />
        <SplitBar label="MONEY" pct={row.moneyPct} color="var(--zs-info)" />
      </div>
      <div style={{ textAlign: "right" }}>
        <div
          className="zs-caption"
          style={{ fontSize: 9, color: accent, marginBottom: 2 }}
        >
          Δ M−T
        </div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 18,
            color: accent,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {row.deltaPp === null
            ? "—"
            : `${row.deltaPp > 0 ? "+" : ""}${row.deltaPp}`}
          {row.deltaPp !== null && <span style={{ fontSize: 10 }}>pp</span>}
        </div>
      </div>
    </div>
  );
}

function SplitBar({
  label,
  pct,
  color,
}: {
  label: string;
  pct: number | undefined;
  color: string;
}) {
  const v = typeof pct === "number" ? Math.max(0, Math.min(100, pct)) : 0;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "60px 1fr 70px",
        gap: 10,
        alignItems: "center",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "var(--zs-fg-muted)",
          letterSpacing: "0.14em",
        }}
      >
        {label}
      </span>
      <div
        style={{
          position: "relative",
          height: 12,
          background: "var(--zs-bg)",
          border: "1px solid var(--zs-border)",
        }}
      >
        {pct !== undefined && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              width: `${v}%`,
              background: color,
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            top: -3,
            bottom: -3,
            left: "50%",
            width: 1,
            background: "var(--zs-fg-muted)",
            opacity: 0.6,
          }}
        />
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--zs-fg)",
          fontVariantNumeric: "tabular-nums",
          textAlign: "right",
        }}
      >
        {pct === undefined ? "—" : `${Math.round(v)}%`}
      </div>
    </div>
  );
}
