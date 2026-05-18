import { useMemo, useState } from "react";
import type { MarketKey, Selection } from "@/domain/market";
import { selectionKey } from "@/domain/market";
import type { BookOffer, LineSnapshot } from "@/domain/odds";
import type { PlayCandidate } from "@/domain/play";
import type { SyntheticPrice } from "@/engine/synthetic";
import { marketByKey } from "@/config/markets";

interface Props {
  lines: Partial<Record<MarketKey, LineSnapshot>>;
  openers?: Partial<Record<MarketKey, LineSnapshot>>;
  synthetic?: Partial<Record<MarketKey, SyntheticPrice[]>>;
  candidates: PlayCandidate[];
  picks: PlayCandidate[];
  marketOrder?: MarketKey[];
  homeName?: string;
  awayName?: string;
  defaultMarket?: MarketKey;
}

const MARKET_RAIL_ORDER: MarketKey[] = [
  "ML_1X2",
  "OU_GOALS",
  "AH",
  "BTTS",
  "DNB",
  "ML_HT",
  "CORNERS_TOTAL",
  "CORNERS_TEAM",
  "CARDS_TOTAL",
  "SHOTS_TOTAL",
  "SOT_TOTAL",
  "SAVES_GK",
  "TACKLES_TOTAL",
  "THROWINS_OU",
];

const TRI_MARKETS = new Set<MarketKey>(["ML_1X2", "ML_HT"]);
const BINARY_NOLINE_MARKETS = new Set<MarketKey>(["BTTS", "DNB"]);

const PAIRED_SIDES: Partial<Record<MarketKey, [string, string]>> = {
  OU_GOALS: ["over", "under"],
  CORNERS_TOTAL: ["over", "under"],
  CORNERS_TEAM: ["over", "under"],
  CARDS_TOTAL: ["over", "under"],
  SHOTS_TOTAL: ["over", "under"],
  SOT_TOTAL: ["over", "under"],
  SAVES_GK: ["over", "under"],
  TACKLES_TOTAL: ["over", "under"],
  THROWINS_OU: ["over", "under"],
  AH: ["home", "away"],
};

const NOLINE_SIDE_ORDER: Record<string, number> = {
  home: 0,
  draw: 1,
  away: 2,
  yes: 0,
  no: 1,
};

const ALT_COUNT = 3;

// Markets that show every paired line (real + synthetic) in a scroll list.
// Other paired markets keep the compact pivot ± ALT_COUNT slice.
const FULL_LADDER_MARKETS = new Set<MarketKey>(["AH", "OU_GOALS"]);

// Rail badge text overrides — keeps MarketKey enum stable while letting
// the UI use friendlier labels.
const RAIL_LABEL_OVERRIDES: Partial<Record<MarketKey, string>> = {
  OU_GOALS: "TOTALS",
};

const formatLine = (n: number): string => (n > 0 ? `+${n}` : `${n}`);

const formatDecimal = (n: number): string => n.toFixed(2);

const formatImplied = (decimal: number): string =>
  decimal > 0 ? `${((1 / decimal) * 100).toFixed(1)}%` : "—";

interface ResolvedOffer {
  decimal: number;
  book: string;
  isFallback: boolean;
}

const resolveOffer = (offers: BookOffer[]): ResolvedOffer | null => {
  if (offers.length === 0) return null;
  const bet365 = offers.find((o) => String(o.book).toLowerCase() === "bet365");
  if (bet365) return { decimal: bet365.decimal, book: "Bet365", isFallback: false };
  const pinnacle = offers.find(
    (o) => String(o.book).toLowerCase() === "pinnacle",
  );
  if (pinnacle) return { decimal: pinnacle.decimal, book: "Pinnacle", isFallback: true };
  const first = offers[0];
  return { decimal: first.decimal, book: String(first.book), isFallback: true };
};

interface Cell {
  decimal?: number;
  book?: string;
  bookFallback?: boolean;
  isSynthetic?: boolean;
  synConfPct?: number;
  isPicked: boolean;
}

const emptyCell = (): Cell => ({ isPicked: false });

const buildOffersByKey = (snap: LineSnapshot): Map<string, BookOffer[]> => {
  const m = new Map<string, BookOffer[]>();
  for (const o of snap.offers) {
    const k = selectionKey(o.selection);
    const arr = m.get(k) ?? [];
    arr.push(o);
    m.set(k, arr);
  }
  return m;
};

const cellFromOffers = (
  offers: BookOffer[] | undefined,
  isPicked: boolean,
): Cell => {
  const r = offers ? resolveOffer(offers) : null;
  if (!r) return { isPicked };
  return {
    decimal: r.decimal,
    book: r.book,
    bookFallback: r.isFallback,
    isPicked,
  };
};

const cellFromSynthetic = (s: SyntheticPrice, isPicked: boolean): Cell => ({
  decimal: s.decimal,
  isSynthetic: true,
  synConfPct: s.confidencePct,
  isPicked,
});

interface PivotResult {
  pivot: number | null;
  lines: number[];
}

const pickPivot = (
  pairedLines: Array<{ line: number; aDec?: number; bDec?: number }>,
): number | null => {
  let bestLine: number | null = null;
  let bestScore = Infinity;
  for (const e of pairedLines) {
    if (e.aDec === undefined || e.bDec === undefined) continue;
    const mean = (e.aDec + e.bDec) / 2;
    if (mean < 1.55 || mean > 2.4) continue;
    const score = Math.abs(e.aDec - e.bDec) + Math.abs(mean - 1.9);
    if (score < bestScore) {
      bestScore = score;
      bestLine = e.line;
    }
  }
  return bestLine;
};

const sliceAroundPivot = (
  allLines: number[],
  pivot: number,
  count: number,
): number[] => {
  const idx = allLines.indexOf(pivot);
  if (idx < 0) return allLines;
  const start = Math.max(0, idx - count);
  const end = Math.min(allLines.length, idx + count + 1);
  return allLines.slice(start, end);
};

interface PairedRow {
  line: number;
  a: Cell;
  b: Cell;
}

const buildPairedRows = (
  snap: LineSnapshot,
  syn: SyntheticPrice[],
  sides: [string, string],
  marketKey: MarketKey,
  pickedKeys: Set<string>,
): { rows: PairedRow[]; pivot: number | null } => {
  const byKey = buildOffersByKey(snap);
  const lineSet = new Set<number>();
  for (const o of snap.offers) {
    if (o.selection.line !== undefined) lineSet.add(o.selection.line);
  }
  for (const s of syn) lineSet.add(s.line);

  const allLines = [...lineSet].sort((x, y) => x - y);
  const [sideA, sideB] = sides;

  const buildCellForLine = (line: number, side: string): Cell => {
    const sel: Selection = { marketKey, side, line };
    const key = selectionKey(sel);
    const offers = byKey.get(key);
    const isPicked = pickedKeys.has(key);
    if (offers && offers.length > 0) {
      return cellFromOffers(offers, isPicked);
    }
    const synMatch = syn.find((s) => s.side === side && s.line === line);
    if (synMatch) return cellFromSynthetic(synMatch, isPicked);
    return { ...emptyCell(), isPicked };
  };

  const fullRows: PairedRow[] = allLines.map((line) => ({
    line,
    a: buildCellForLine(line, sideA),
    b: buildCellForLine(line, sideB),
  }));

  const pivotInput = fullRows.map((r) => ({
    line: r.line,
    aDec: r.a.isSynthetic ? undefined : r.a.decimal,
    bDec: r.b.isSynthetic ? undefined : r.b.decimal,
  }));
  let pivot = pickPivot(pivotInput);
  if (pivot === null && fullRows.length > 0) {
    pivot = fullRows[Math.floor(fullRows.length / 2)].line;
  }

  const showFullLadder = FULL_LADDER_MARKETS.has(marketKey);
  const visibleLines =
    !showFullLadder && pivot !== null
      ? sliceAroundPivot(allLines, pivot, ALT_COUNT)
      : allLines;
  const visibleSet = new Set(visibleLines);
  const rows = fullRows.filter((r) => visibleSet.has(r.line));

  return { rows, pivot };
};

interface FlatRow {
  selection: Selection;
  label: string;
  cell: Cell;
}

const SIDE_LABELS: Record<string, string> = {
  draw: "Draw",
  yes: "Yes",
  no: "No",
  over: "Over",
  under: "Under",
};

const sideLabel = (
  side: string,
  homeName?: string,
  awayName?: string,
): string => {
  if (side === "home" && homeName) return homeName;
  if (side === "away" && awayName) return awayName;
  return SIDE_LABELS[side] ?? side;
};

const buildFlatRows = (
  snap: LineSnapshot,
  pickedKeys: Set<string>,
  marketKey: MarketKey,
  homeName?: string,
  awayName?: string,
): FlatRow[] => {
  const byKey = buildOffersByKey(snap);
  const seen = new Map<string, FlatRow>();
  for (const o of snap.offers) {
    const key = selectionKey(o.selection);
    if (seen.has(key)) continue;
    const offers = byKey.get(key);
    seen.set(key, {
      selection: o.selection,
      label: sideLabel(o.selection.side, homeName, awayName),
      cell: cellFromOffers(offers, pickedKeys.has(key)),
    });
  }
  const arr = [...seen.values()];
  arr.sort((x, y) => {
    const xo = NOLINE_SIDE_ORDER[x.selection.side] ?? 99;
    const yo = NOLINE_SIDE_ORDER[y.selection.side] ?? 99;
    return xo - yo;
  });
  // Discard markets that should not display under this market key (defensive).
  return arr.filter((r) => r.selection.marketKey === marketKey);
};

export function OddsBoard({
  lines,
  synthetic,
  picks,
  marketOrder,
  homeName,
  awayName,
  defaultMarket,
}: Props) {
  const availableKeys = useMemo<MarketKey[]>(() => {
    const present = (Object.keys(lines) as MarketKey[]).filter(
      (k) => (lines[k]?.offers.length ?? 0) > 0,
    );
    const order = marketOrder ?? MARKET_RAIL_ORDER;
    const idx = new Map(order.map((k, i) => [k, i]));
    present.sort((a, b) => (idx.get(a) ?? 99) - (idx.get(b) ?? 99));
    return present;
  }, [lines, marketOrder]);

  const initialKey =
    defaultMarket && availableKeys.includes(defaultMarket)
      ? defaultMarket
      : availableKeys[0];
  const [marketKey, setMarketKey] = useState<MarketKey | undefined>(initialKey);
  const activeKey =
    marketKey && availableKeys.includes(marketKey) ? marketKey : initialKey;

  const pickedKeys = useMemo(
    () => new Set(picks.map((p) => selectionKey(p.selection))),
    [picks],
  );

  const picksByMarket = useMemo(() => {
    const m = new Map<MarketKey, number>();
    for (const p of picks) {
      const k = p.selection.marketKey;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [picks]);

  if (!activeKey) {
    return (
      <p className="font-mono text-[11px] text-fg-muted">
        Odds board unavailable — no offers loaded for this fixture.
      </p>
    );
  }

  const snap = lines[activeKey]!;
  const synForActive = synthetic?.[activeKey] ?? [];
  const desc = marketByKey(activeKey);

  const pairedSides = PAIRED_SIDES[activeKey];
  const isPaired = pairedSides !== undefined && (desc?.hasLine ?? false);
  const isTri = TRI_MARKETS.has(activeKey);
  const isBinary = BINARY_NOLINE_MARKETS.has(activeKey);

  const pickHere = picksByMarket.get(activeKey) ?? 0;

  return (
    <div
      className="overflow-hidden rounded-lg border border-zs"
      style={{ background: "var(--zs-bg-elev)" }}
    >
      <div className="flex items-center justify-between border-b border-zs px-4 py-2.5">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[13px] font-semibold text-fg">Odds board</span>
          <span className="kicker">
            {desc?.label ?? activeKey} · Bet365
            {pickHere > 0 && (
              <>
                {" "}·{" "}
                <span style={{ color: "var(--zs-pos)" }}>
                  {pickHere} pick{pickHere === 1 ? "" : "s"}
                </span>
              </>
            )}
          </span>
        </div>
      </div>

      <div
        className="grid"
        style={{
          gridTemplateColumns: "152px 1fr",
          minHeight: 0,
        }}
      >
        <MarketRail
          availableKeys={availableKeys}
          lines={lines}
          activeKey={activeKey}
          picksByMarket={picksByMarket}
          onSelect={setMarketKey}
        />

        <div className="zs-scroll" style={{ overflow: "auto", maxHeight: 320 }}>
          {isPaired && pairedSides && (
            <PairedTable
              snap={snap}
              syn={synForActive}
              sides={pairedSides}
              marketKey={activeKey}
              pickedKeys={pickedKeys}
              homeName={homeName}
              awayName={awayName}
            />
          )}
          {(isTri || isBinary || (!isPaired && !isTri && !isBinary)) && (
            <FlatTable
              snap={snap}
              marketKey={activeKey}
              pickedKeys={pickedKeys}
              homeName={homeName}
              awayName={awayName}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function MarketRail({
  availableKeys,
  lines,
  activeKey,
  picksByMarket,
  onSelect,
}: {
  availableKeys: MarketKey[];
  lines: Partial<Record<MarketKey, LineSnapshot>>;
  activeKey: MarketKey;
  picksByMarket: Map<MarketKey, number>;
  onSelect: (k: MarketKey) => void;
}) {
  return (
    <div
      className="zs-scroll border-r border-zs py-2"
      style={{ background: "var(--zs-bg)", overflowY: "auto" }}
    >
      {availableKeys.map((k) => {
        const active = k === activeKey;
        const md = marketByKey(k);
        const lineSet = new Set<string>();
        for (const o of lines[k]!.offers) {
          lineSet.add(
            md?.hasLine
              ? `${o.selection.side}@${o.selection.line}`
              : o.selection.side,
          );
        }
        const distinctLines = lineSet.size;
        const picksHere = picksByMarket.get(k) ?? 0;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onSelect(k)}
            className="flex w-full flex-col gap-0.5"
            style={{
              border: "none",
              textAlign: "left",
              cursor: "pointer",
              background: active ? "var(--zs-bg-elev)" : "transparent",
              borderLeft: `2px solid ${
                active ? "var(--zs-info)" : "transparent"
              }`,
              padding: "8px 12px",
            }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                color: active ? "var(--zs-fg)" : "var(--zs-fg-dim)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {RAIL_LABEL_OVERRIDES[k] ?? k}
            </span>
            <span
              className="flex items-center gap-1.5"
              style={{ fontSize: 11, color: "var(--zs-fg-muted)" }}
            >
              {distinctLines} {distinctLines === 1 ? "line" : "lines"}
              {picksHere > 0 && (
                <span
                  className="inline-flex items-center gap-1 font-mono"
                  style={{ color: "var(--zs-pos)" }}
                >
                  ·
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 99,
                      background: "var(--zs-pos)",
                      display: "inline-block",
                    }}
                  />
                  {picksHere} pick
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PairedTable({
  snap,
  syn,
  sides,
  marketKey,
  pickedKeys,
  homeName,
  awayName,
}: {
  snap: LineSnapshot;
  syn: SyntheticPrice[];
  sides: [string, string];
  marketKey: MarketKey;
  pickedKeys: Set<string>;
  homeName?: string;
  awayName?: string;
}) {
  const { rows, pivot } = buildPairedRows(
    snap,
    syn,
    sides,
    marketKey,
    pickedKeys,
  );

  const [sideA, sideB] = sides;
  const labelA = sideLabel(sideA, homeName, awayName);
  const labelB = sideLabel(sideB, homeName, awayName);

  return (
    <table
      className="font-mono"
      style={{
        width: "100%",
        borderCollapse: "separate",
        borderSpacing: 0,
        fontSize: 12,
      }}
    >
      <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
        <tr style={{ background: "var(--zs-bg)" }}>
          <Th width={120}>Line</Th>
          <Th>{labelA}</Th>
          <Th align="right" width={80}>Imp%</Th>
          <Th leftDivider>{labelB}</Th>
          <Th align="right" width={80}>Imp%</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td
              colSpan={5}
              style={{
                padding: "16px 12px",
                color: "var(--zs-fg-muted)",
                textAlign: "center",
              }}
            >
              No lines available.
            </td>
          </tr>
        )}
        {rows.map((r) => {
          const isPivot = r.line === pivot;
          const rowBg = isPivot
            ? "color-mix(in oklch, var(--zs-info) 6%, transparent)"
            : "transparent";
          return (
            <tr
              key={r.line}
              style={{
                background: rowBg,
                borderLeft: isPivot
                  ? "2px solid var(--zs-info)"
                  : "2px solid transparent",
              }}
            >
              <Td
                style={{
                  whiteSpace: "nowrap",
                  borderLeft: isPivot
                    ? "2px solid var(--zs-info)"
                    : "2px solid transparent",
                }}
              >
                <span
                  style={{
                    color: "var(--zs-fg)",
                    fontWeight: isPivot ? 600 : 500,
                  }}
                >
                  {formatLine(r.line)}
                </span>
                {isPivot && (
                  <span
                    className="ml-2 inline-flex items-center rounded font-mono"
                    style={{
                      height: 16,
                      fontSize: 9,
                      padding: "0 6px",
                      color: "var(--zs-info)",
                      background:
                        "color-mix(in oklch, var(--zs-info) 16%, transparent)",
                      letterSpacing: "0.08em",
                    }}
                  >
                    PIVOT
                  </span>
                )}
              </Td>
              <CellTd cell={r.a} isPivot={isPivot} />
              <ImpTd cell={r.a} />
              <CellTd cell={r.b} isPivot={isPivot} leftDivider rightAccent={isPivot} />
              <ImpTd cell={r.b} rightAccent={isPivot} />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function FlatTable({
  snap,
  marketKey,
  pickedKeys,
  homeName,
  awayName,
}: {
  snap: LineSnapshot;
  marketKey: MarketKey;
  pickedKeys: Set<string>;
  homeName?: string;
  awayName?: string;
}) {
  const rows = buildFlatRows(snap, pickedKeys, marketKey, homeName, awayName);
  return (
    <table
      className="font-mono"
      style={{
        width: "100%",
        borderCollapse: "separate",
        borderSpacing: 0,
        fontSize: 12,
      }}
    >
      <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
        <tr style={{ background: "var(--zs-bg)" }}>
          <Th>Selection</Th>
          <Th align="right" width={120}>Price</Th>
          <Th align="right" width={100}>Imp%</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td
              colSpan={3}
              style={{
                padding: "16px 12px",
                color: "var(--zs-fg-muted)",
                textAlign: "center",
              }}
            >
              No offers available.
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={selectionKey(r.selection)}>
            <Td style={{ whiteSpace: "nowrap" }}>
              <span
                style={{
                  color: "var(--zs-fg)",
                  fontFamily: "var(--font-ui)",
                  fontSize: 12.5,
                }}
              >
                {r.label}
              </span>
              {r.cell.isPicked && (
                <span
                  className="pill pill-pos ml-2"
                  style={{ height: 16, fontSize: 9, padding: "0 6px" }}
                >
                  PICK
                </span>
              )}
            </Td>
            <Td align="right" style={{ whiteSpace: "nowrap" }}>
              {r.cell.decimal !== undefined ? (
                <>
                  <span style={{ color: "var(--zs-fg)", fontWeight: 600 }}>
                    {formatDecimal(r.cell.decimal)}
                  </span>
                  {r.cell.bookFallback && r.cell.book && (
                    <BookChip book={r.cell.book} />
                  )}
                </>
              ) : (
                <span style={{ color: "var(--zs-fg-muted)" }}>—</span>
              )}
            </Td>
            <Td align="right" style={{ color: "var(--zs-fg-muted)" }}>
              {r.cell.decimal !== undefined ? formatImplied(r.cell.decimal) : "—"}
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CellTd({
  cell,
  isPivot,
  leftDivider,
  rightAccent,
}: {
  cell: Cell;
  isPivot: boolean;
  leftDivider?: boolean;
  rightAccent?: boolean;
}) {
  const empty = cell.decimal === undefined;
  return (
    <Td
      style={{
        whiteSpace: "nowrap",
        position: "relative",
      }}
      leftDivider={leftDivider}
      rightAccent={rightAccent}
    >
      {cell.isPicked && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: leftDivider ? 1 : 0,
            top: 0,
            bottom: 0,
            width: 2,
            background: "var(--zs-pos)",
          }}
        />
      )}
      {empty ? (
        <span style={{ color: "var(--zs-fg-muted)" }}>—</span>
      ) : (
        <>
          <span
            style={{
              color: "var(--zs-fg)",
              fontWeight: isPivot ? 700 : 600,
            }}
          >
            {formatDecimal(cell.decimal!)}
          </span>
          {cell.bookFallback && cell.book && <BookChip book={cell.book} />}
          {cell.isPicked && (
            <span
              className="pill pill-pos ml-2"
              style={{ height: 16, fontSize: 9, padding: "0 6px" }}
            >
              PICK
            </span>
          )}
        </>
      )}
    </Td>
  );
}

function ImpTd({ cell, rightAccent }: { cell: Cell; rightAccent?: boolean }) {
  return (
    <Td
      align="right"
      style={{ color: "var(--zs-fg-muted)" }}
      rightAccent={rightAccent}
    >
      {cell.decimal !== undefined ? formatImplied(cell.decimal) : "—"}
    </Td>
  );
}

function BookChip({ book }: { book: string }) {
  return (
    <span
      title={`Bet365 unavailable — showing ${book}`}
      style={{
        marginLeft: 6,
        fontSize: 9,
        color: "var(--zs-fg-muted)",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      {book.slice(0, 3)}
    </span>
  );
}

function Th({
  children,
  align = "left",
  leftDivider,
  width,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  leftDivider?: boolean;
  width?: number;
}) {
  return (
    <th
      style={{
        textAlign: align,
        padding: "8px 12px",
        fontWeight: 500,
        color: "var(--zs-fg-muted)",
        fontSize: 10,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        background: "var(--zs-bg)",
        boxShadow: "inset 0 -1px 0 var(--zs-border)",
        whiteSpace: "nowrap",
        ...(leftDivider ? { borderLeft: "1px solid var(--zs-border)" } : {}),
        ...(width ? { width } : {}),
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  leftDivider,
  rightAccent,
  style,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  leftDivider?: boolean;
  rightAccent?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <td
      style={{
        padding: "9px 12px",
        textAlign: align,
        borderBottom:
          "1px solid color-mix(in oklch, var(--zs-border) 50%, transparent)",
        ...(leftDivider ? { borderLeft: "1px solid var(--zs-border)" } : {}),
        ...(rightAccent ? { borderRight: "2px solid var(--zs-info)" } : {}),
        ...style,
      }}
    >
      {children}
    </td>
  );
}
