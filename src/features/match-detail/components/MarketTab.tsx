import type { MatchId } from "@/domain/ids";
import type { MarketKey, Selection } from "@/domain/market";
import type { LineSnapshot } from "@/domain/odds";
import type { PlayCandidate } from "@/domain/play";
import type { Splits } from "@/domain/splits";
import { Block, Tag } from "@/components/zs";
import { marketByKey } from "@/config/markets";
import {
  extractMarketSignals,
  topPublicLean,
  type MarketSignal,
  type PublicLean,
} from "../marketSignals";
import { LineHistoryPanel } from "./LineHistoryPanel";

interface Props {
  splits: Partial<Record<MarketKey, Splits>>;
  lines: Partial<Record<MarketKey, LineSnapshot>>;
  allCandidates: PlayCandidate[];
  homeName: string;
  awayName: string;
  matchId: MatchId | null;
}

const formatSelectionLabel = (
  marketKey: MarketKey,
  selection: Selection,
  homeName: string,
  awayName: string,
): string => {
  // Player props (e.g. baseball pitcher strikeouts) carry a player + propLabel.
  if (selection.player) {
    const side =
      selection.side === "over"
        ? "Over"
        : selection.side === "under"
          ? "Under"
          : selection.side;
    return `${selection.player} ${selection.propLabel ?? selection.marketKey} ${side} ${selection.line ?? ""}`.trim();
  }
  const { side, line } = selection;
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
      label: formatSelectionLabel(marketKey, row.selection, homeName, awayName),
      betsPct: row.betsPct,
      moneyPct: row.moneyPct,
      deltaPp: hasBoth ? Math.round(row.moneyPct! - row.betsPct!) : null,
      selectedSide: row.selection.side,
    };
  });

export function MarketTab({ splits, allCandidates, homeName, awayName, matchId }: Props) {
  const splitEntries = Object.entries(splits) as [MarketKey, Splits][];
  const { top } = extractMarketSignals(allCandidates);
  const publicLean = topPublicLean(splits);

  const totalSplitsRows = splitEntries.reduce(
    (acc, [, group]) => acc + group.rows.length,
    0,
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {splitEntries.length > 0 && (
        <SignalHero
          signal={top}
          publicLean={publicLean}
          homeName={homeName}
          awayName={awayName}
        />
      )}

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

/** Short pattern label + tone for each engine pattern. */
const PATTERN_META: Record<
  MarketSignal["pattern"],
  { label: string; lead: string }
> = {
  SHARP_MONEY_DIVERGENCE: { label: "MONEY DIVERGENCE", lead: "Sharp money on" },
  REVERSE_LINE_MOVEMENT: { label: "REVERSE LINE MOVE", lead: "Sharp money on" },
  PUBLIC_DOG_TRAP_CONFIRMED: { label: "DOG TRAP", lead: "Public trap on" },
  PURE_FADE_PUBLIC: { label: "PUBLIC FADE", lead: "Heavy public on" },
  FLAT: { label: "FLAT", lead: "" },
};

function SignalHero({
  signal,
  publicLean,
  homeName,
  awayName,
}: {
  signal: MarketSignal | null;
  publicLean: PublicLean | null;
  homeName: string;
  awayName: string;
}) {
  // SUPPORT = be on this side (sharp). AGAINST = fade this side (public/square).
  const isSharp = signal?.verdict === "SUPPORT";
  const isFade = signal?.verdict === "AGAINST";
  const accent = isSharp
    ? "var(--zs-info)"
    : isFade
      ? "var(--zs-warn)"
      : "var(--zs-fg-muted)";
  const fill = `color-mix(in oklch, ${accent} 8%, transparent)`;

  const badge = isSharp ? "SHARP MONEY" : isFade ? "FADE PUBLIC" : "FLAT";
  const meta = PATTERN_META[signal?.pattern ?? "FLAT"];
  const market = signal ? signal.marketKey : publicLean?.marketKey ?? null;
  const descriptor = market ? marketByKey(market)?.label ?? market : "MATCH";

  const sideLabel = signal
    ? formatSelectionLabel(signal.marketKey, signal.selection, homeName, awayName)
    : null;
  const deltaPp =
    signal && signal.moneyPct !== undefined && signal.betsPct !== undefined
      ? Math.round(signal.moneyPct - signal.betsPct)
      : null;

  const leanLabel = publicLean
    ? formatSelectionLabel(publicLean.marketKey, publicLean.selection, homeName, awayName)
    : null;

  return (
    <div className="zs-block" style={{ padding: 0, borderColor: accent }}>
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
            background: fill,
            borderRight: "1px solid var(--zs-border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                color: accent,
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.18em",
              }}
            >
              ◆ {badge}
            </span>
            <Tag tone={isSharp ? "info" : isFade ? "amber" : undefined}>
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
            {signal && sideLabel ? (
              <>
                {meta.lead}{" "}
                <strong style={{ color: accent }}>{sideLabel}</strong>.{" "}
                {isFade ? "Sharps are fading the crowd here." : "Line confirms the move."}
              </>
            ) : leanLabel ? (
              <>
                Money tracks the public — no sharp divergence. Crowd &amp; cash both
                on <strong style={{ color: "var(--zs-fg)" }}>{leanLabel}</strong>.
              </>
            ) : (
              <>No crowd-vs-sharp divergence detected.</>
            )}
          </div>
        </div>
        {signal ? (
          <KpiCell
            k="DIVERGENCE"
            v={deltaPp === null ? "—" : `${deltaPp > 0 ? "+" : ""}${deltaPp}pp`}
            sub="money − tickets"
            tone={accent}
            border
          />
        ) : (
          <KpiCell
            k="SPLIT"
            v={
              publicLean
                ? `${Math.round(publicLean.betsPct)}/${
                    publicLean.moneyPct !== undefined
                      ? Math.round(publicLean.moneyPct)
                      : "—"
                  }`
                : "—"
            }
            sub="tickets / money"
            tone="var(--zs-fg-muted)"
            border
          />
        )}
        <KpiCell
          k="PATTERN"
          v={meta.label}
          sub={signal ? "engine verdict" : "no divergence"}
          tone={accent}
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
