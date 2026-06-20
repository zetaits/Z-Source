// Baseball Savant discipline leaderboards (Statcast) — pitcher and batter K%,
// whiff%, CSW%, and swing rates. CRITICAL: this feed returns CSV, not JSON, so
// we res.text() and parse it ourselves. The leaderboard returns ALL rows (the
// player_id query param does NOT filter server-side), so callers fetch the full
// board once (cache per day) and filter client-side. Savant has no DataDome, so
// default tauriFetch is fine — do NOT set preferBrowserFetch here.
//
// Percent columns arrive as percentages (16.7) and are stored as 0..1 (0.167),
// consistent with the statsapi-derived rates. csw_percent / o_swing_percent are
// frequently empty -> the field stays undefined (never throws).

import type { SavantPitcherProfile } from "@/domain/baseball";
import { httpRequest } from "@/services/http/httpClient";

const SAVANT_BASE = "https://baseballsavant.mlb.com/leaderboard/custom";
const SAVANT_RPS = 1;

const currentSeason = () => new Date().getFullYear();

/** Discipline row used for both pitchers and batters. */
export interface SavantDisciplineRow {
  playerId: number;
  kPct?: number;
  whiffPct?: number;
  cswPct?: number;
  oSwingPct?: number;
  zSwingPct?: number;
}

// ---------------------------------------------------------------------------
// Minimal quote-aware CSV parser. Handles double-quoted fields containing
// commas (e.g. "last_name, first_name"). No escaped-quote handling is needed
// for this feed. Returns an array of header->value records.
// ---------------------------------------------------------------------------
const splitCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
};

const parseCsv = (text: string): Record<string, string>[] => {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) row[headers[c]] = cells[c] ?? "";
    rows.push(row);
  }
  return rows;
};

// Percent cell -> 0..1, or undefined when empty / non-numeric.
const pct = (v: string | undefined): number | undefined => {
  if (v == null || v.trim() === "") return undefined;
  const n = parseFloat(v);
  return Number.isNaN(n) ? undefined : n / 100;
};

// Read columns by header NAME (order can vary). Rows missing player_id are dropped.
const rowToDiscipline = (r: Record<string, string>): SavantDisciplineRow | null => {
  const id = parseInt(r["player_id"] ?? "", 10);
  if (Number.isNaN(id)) return null;
  return {
    playerId: id,
    kPct: pct(r["k_percent"]),
    whiffPct: pct(r["whiff_percent"]),
    cswPct: pct(r["csw_percent"]),
    oSwingPct: pct(r["o_swing_percent"]),
    zSwingPct: pct(r["z_swing_percent"]),
  };
};

const parseSavantCsv = (text: string): SavantDisciplineRow[] => {
  const out: SavantDisciplineRow[] = [];
  for (const r of parseCsv(text)) {
    const row = rowToDiscipline(r);
    if (row) out.push(row);
  }
  return out;
};

const fetchLeaderboard = async (
  type: "pitcher" | "batter",
  season: number,
  signal?: AbortSignal,
): Promise<SavantDisciplineRow[]> => {
  const selections =
    type === "pitcher"
      ? "k_percent,whiff_percent,csw_percent,o_swing_percent,z_swing_percent"
      : "k_percent,whiff_percent,o_swing_percent,z_swing_percent";
  const url =
    `${SAVANT_BASE}?year=${season}&type=${type}&filter=&min=1` +
    `&selections=${selections}&chart=false&csv=true`;
  try {
    const res = await httpRequest({ url, rps: SAVANT_RPS, signal });
    return parseSavantCsv(await res.text());
  } catch (err) {
    console.warn(`[savant] ${type} leaderboard fetch failed`, err);
    return [];
  }
};

/** Full pitcher discipline leaderboard (cache per day in the caller / React Query). */
export const fetchPitcherSavantLeaderboard = (
  season: number = currentSeason(),
  signal?: AbortSignal,
): Promise<SavantDisciplineRow[]> => fetchLeaderboard("pitcher", season, signal);

/** Full batter discipline leaderboard (cache per day in the caller / React Query). */
export const fetchBatterSavantLeaderboard = (
  season: number = currentSeason(),
  signal?: AbortSignal,
): Promise<SavantDisciplineRow[]> => fetchLeaderboard("batter", season, signal);

/** Single pitcher profile — fetches the board and filters by id. */
export const getPitcherSavant = async (
  playerId: number,
  season: number = currentSeason(),
  signal?: AbortSignal,
): Promise<SavantPitcherProfile | undefined> => {
  const board = await fetchPitcherSavantLeaderboard(season, signal);
  const row = board.find((r) => r.playerId === playerId);
  if (!row) return undefined;
  return {
    playerId,
    season,
    kPct: row.kPct,
    whiffPct: row.whiffPct,
    cswPct: row.cswPct,
    oSwingPct: row.oSwingPct,
    zSwingPct: row.zSwingPct,
  };
};

/** Single batter discipline row — fetches the board and filters by id. */
export const getBatterSavant = async (
  playerId: number,
  season: number = currentSeason(),
  signal?: AbortSignal,
): Promise<SavantDisciplineRow | undefined> => {
  const board = await fetchBatterSavantLeaderboard(season, signal);
  return board.find((r) => r.playerId === playerId);
};

// Pure mappers exported for unit tests (no HTTP), per providers.ts convention.
export { parseSavantCsv as _parseSavantCsv, parseCsv as _parseCsv };
