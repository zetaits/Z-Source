import type { MatchId } from "@/domain/ids";
import type { MarketKey, Selection } from "@/domain/market";
import type { Splits } from "@/domain/splits";
import type {
  SplitProvider,
  SplitProviderCapabilities,
  SplitProviderQuery,
} from "@/services/providers/SplitProvider";
import { mulberry32, randomBetween, seedFromString, type Prng } from "./mockSeed";

const SUPPORTED: MarketKey[] = ["ML_1X2", "DNB", "BTTS", "OU_GOALS", "AH", "CORNERS_TOTAL"];

const CAPS: SplitProviderCapabilities = {
  markets: SUPPORTED,
  hasHandle: false,
  hasMoneyPct: true,
};

const normalizePcts = (raw: number[]): number[] => {
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum <= 0) return raw.map(() => 100 / raw.length);
  return raw.map((v) => (v / sum) * 100);
};

const roundTo1 = (n: number): number => Math.round(n * 10) / 10;

const distributePcts = (prng: Prng, weights: number[]): number[] => {
  const jittered = weights.map((w) => Math.max(0.5, w + randomBetween(prng, -0.1, 0.1) * w));
  return normalizePcts(jittered).map(roundTo1);
};

type Row = { selection: Selection; betsPct: number; moneyPct: number };

const buildPairedRows = (
  prng: Prng,
  market: MarketKey,
  line: number | undefined,
  sideA: string,
  sideB: string,
  baseLeanA: number,
  sharpBiasRange: number,
): Row[] => {
  const leanA = baseLeanA;
  const bets = distributePcts(prng, [leanA, 1 - leanA]);
  const sharpBias = randomBetween(prng, -sharpBiasRange, sharpBiasRange);
  const money = distributePcts(prng, [leanA - sharpBias, 1 - leanA + sharpBias]);
  const lineFrag = line !== undefined ? { line } : {};
  return [
    {
      selection: { marketKey: market, side: sideA, ...lineFrag },
      betsPct: bets[0],
      moneyPct: money[0],
    },
    {
      selection: { marketKey: market, side: sideB, ...lineFrag },
      betsPct: bets[1],
      moneyPct: money[1],
    },
  ];
};

const buildRowsForMarket = (
  prng: Prng,
  market: MarketKey,
  line?: number,
): Row[] => {
  if (market === "ML_1X2") {
    const homeLean = randomBetween(prng, 0.35, 0.65);
    const awayLean = randomBetween(prng, 0.15, 0.4);
    const drawLean = Math.max(0.05, 1 - homeLean - awayLean);
    const bets = distributePcts(prng, [homeLean, drawLean, awayLean]);
    const sharpBias = randomBetween(prng, -0.25, 0.25);
    const moneyRaw = [
      Math.max(5, homeLean - sharpBias * 0.4),
      Math.max(3, drawLean + sharpBias * 0.1),
      Math.max(5, awayLean + sharpBias * 0.5),
    ];
    const money = distributePcts(prng, moneyRaw);
    return [
      { selection: { marketKey: "ML_1X2", side: "home" }, betsPct: bets[0], moneyPct: money[0] },
      { selection: { marketKey: "ML_1X2", side: "draw" }, betsPct: bets[1], moneyPct: money[1] },
      { selection: { marketKey: "ML_1X2", side: "away" }, betsPct: bets[2], moneyPct: money[2] },
    ];
  }
  if (market === "DNB") {
    return buildPairedRows(prng, "DNB", undefined, "home", "away", randomBetween(prng, 0.4, 0.7), 0.25);
  }
  if (market === "BTTS") {
    return buildPairedRows(prng, "BTTS", undefined, "yes", "no", randomBetween(prng, 0.4, 0.7), 0.2);
  }
  if (market === "OU_GOALS" && line !== undefined) {
    const overLean = randomBetween(prng, 0.55, 0.75);
    return buildPairedRows(prng, "OU_GOALS", line, "over", "under", overLean, 0.22);
  }
  if (market === "CORNERS_TOTAL" && line !== undefined) {
    const overLean = randomBetween(prng, 0.5, 0.72);
    return buildPairedRows(prng, "CORNERS_TOTAL", line, "over", "under", overLean, 0.2);
  }
  if (market === "AH" && line !== undefined) {
    const homeLean = randomBetween(prng, 0.38, 0.68);
    return buildPairedRows(prng, "AH", line, "home", "away", homeLean, 0.22);
  }
  return [];
};

export const createMockSplitProvider = (): SplitProvider => ({
  name: "Mock (deterministic)",
  capabilities: CAPS,
  async getSplits(
    matchId: MatchId,
    markets: MarketKey[],
    query?: SplitProviderQuery,
  ): Promise<Splits[] | null> {
    const supported = markets.filter((m) => SUPPORTED.includes(m));
    if (supported.length === 0) return [];
    const takenAt = new Date().toISOString();
    const out: Splits[] = [];

    for (const market of supported) {
      if (market === "OU_GOALS" || market === "AH" || market === "CORNERS_TOTAL") {
        const lines = query?.linesByMarket?.[market] ?? [];
        for (const line of lines) {
          const prng = mulberry32(seedFromString(`${matchId}|${market}|${line}|splits`));
          const rows = buildRowsForMarket(prng, market, line);
          if (rows.length === 0) continue;
          out.push({ matchId, marketKey: market, rows, source: "mock", takenAt });
        }
        continue;
      }
      const prng = mulberry32(seedFromString(`${matchId}|${market}|splits`));
      const rows = buildRowsForMarket(prng, market);
      if (rows.length === 0) continue;
      out.push({ matchId, marketKey: market, rows, source: "mock", takenAt });
    }
    return out;
  },
});
