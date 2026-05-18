/**
 * Football-Data.co.uk CSV scraper for historical match results + Pinnacle
 * closing odds. Top-5 leagues, free, bulk CSV per league-season.
 *
 * URL pattern: https://www.football-data.co.uk/mmz4281/{SEASON}/{LEAGUE}.csv
 *   SEASON: "2324" for 2023-24, "2425" for 2024-25
 *   LEAGUE: E0=Premier, SP1=La Liga, I1=Serie A, D1=Bundesliga, F1=Ligue 1
 *
 * Columns consumed (notes.txt):
 *   Date, HomeTeam, AwayTeam, FTHG, FTAG
 *   PSCH/PSCD/PSCA  — Pinnacle closing 1X2
 *   PAHH/PAHA + AHh — Pinnacle closing Asian Handicap (home/away + line)
 *   P>2.5/P<2.5     — Pinnacle Over/Under 2.5
 */
import { httpRequest } from "@/services/http/httpClient";
import {
  historicalOddsRepo,
  type HistoricalMatch,
  type HistoricalOffer,
} from "@/storage/repos/historicalOddsRepo";

export type FdLeague = "E0" | "SP1" | "I1" | "D1" | "F1";

export const FD_LEAGUE_LABELS: Record<FdLeague, string> = {
  E0: "Premier League",
  SP1: "La Liga",
  I1: "Serie A",
  D1: "Bundesliga",
  F1: "Ligue 1",
};

const FD_BASE = "https://www.football-data.co.uk/mmz4281";

const csvUrl = (season: string, league: FdLeague): string =>
  `${FD_BASE}/${season}/${league}.csv`;

const parseCsvLine = (line: string): string[] => {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
};

const parseCsv = (text: string): Array<Record<string, string>> => {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) {
      row[header[i]] = cells[i] ?? "";
    }
    return row;
  });
};

// Parse "DD/MM/YY" or "DD/MM/YYYY" to ISO "YYYY-MM-DD"
const parseDate = (s: string): string | null => {
  if (!s) return null;
  const parts = s.split("/");
  if (parts.length !== 3) return null;
  const [dd, mm, yyRaw] = parts;
  const yy = yyRaw.length === 2 ? `20${yyRaw}` : yyRaw;
  if (!/^\d{4}$/.test(yy)) return null;
  return `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
};

const num = (s: string | undefined): number | null => {
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

const seasonLabel = (s: string): string =>
  s.length === 4
    ? `20${s.slice(0, 2)}-20${s.slice(2, 4)}`
    : s;

export interface IngestResult {
  league: FdLeague;
  season: string;
  matchesIngested: number;
  offersIngested: number;
  rowsSkipped: number;
}

const buildMatchId = (
  season: string,
  league: FdLeague,
  date: string,
  home: string,
  away: string,
): string => `${league}:${season}:${date}:${home}:${away}`;

export const fetchAndIngestSeason = async (
  league: FdLeague,
  season: string,
  onProgress?: (done: number, total: number) => void,
): Promise<IngestResult> => {
  const url = csvUrl(season, league);
  const res = await httpRequest({ url, rps: 1, preferBrowserFetch: true });
  if (res.status !== 200) {
    throw new Error(`football-data ${league} ${season}: HTTP ${res.status}`);
  }
  const text = await res.text();
  const rows = parseCsv(text);
  const seasonStr = seasonLabel(season);

  let matchesIngested = 0;
  let offersIngested = 0;
  let rowsSkipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const isoDate = parseDate(r["Date"]);
    if (!isoDate) {
      rowsSkipped++;
      continue;
    }
    const home = r["HomeTeam"];
    const away = r["AwayTeam"];
    const fthg = num(r["FTHG"]);
    const ftag = num(r["FTAG"]);
    if (!home || !away || fthg === null || ftag === null) {
      rowsSkipped++;
      continue;
    }

    const id = buildMatchId(season, league, isoDate, home, away);
    const match: HistoricalMatch = {
      id,
      league,
      season: seasonStr,
      date: isoDate,
      homeTeam: home,
      awayTeam: away,
      fthg,
      ftag,
    };
    await historicalOddsRepo.upsertMatch(match);
    matchesIngested++;

    const offers: HistoricalOffer[] = [];

    // ML_1X2 — Pinnacle closing
    const psch = num(r["PSCH"]);
    const pscd = num(r["PSCD"]);
    const psca = num(r["PSCA"]);
    if (psch && pscd && psca) {
      offers.push(
        { matchId: id, marketKey: "ML_1X2", selectionSide: "home", line: null, decimal: psch, book: "Pinnacle" },
        { matchId: id, marketKey: "ML_1X2", selectionSide: "draw", line: null, decimal: pscd, book: "Pinnacle" },
        { matchId: id, marketKey: "ML_1X2", selectionSide: "away", line: null, decimal: psca, book: "Pinnacle" },
      );
    }

    // AH — Pinnacle closing
    const pahh = num(r["PAHH"]);
    const paha = num(r["PAHA"]);
    const ahh = num(r["AHh"] ?? r["PAHh"]);
    if (pahh && paha && ahh !== null) {
      offers.push(
        { matchId: id, marketKey: "AH", selectionSide: "home", line: ahh, decimal: pahh, book: "Pinnacle" },
        { matchId: id, marketKey: "AH", selectionSide: "away", line: -ahh, decimal: paha, book: "Pinnacle" },
      );
    }

    // OU 2.5 — Pinnacle closing
    const pOver = num(r["P>2.5"]);
    const pUnder = num(r["P<2.5"]);
    if (pOver && pUnder) {
      offers.push(
        { matchId: id, marketKey: "OU_GOALS", selectionSide: "over", line: 2.5, decimal: pOver, book: "Pinnacle" },
        { matchId: id, marketKey: "OU_GOALS", selectionSide: "under", line: 2.5, decimal: pUnder, book: "Pinnacle" },
      );
    }

    for (const o of offers) {
      await historicalOddsRepo.upsertOffer(o);
      offersIngested++;
    }

    if (onProgress && i % 25 === 0) onProgress(i + 1, rows.length);
  }

  if (onProgress) onProgress(rows.length, rows.length);

  return { league, season: seasonStr, matchesIngested, offersIngested, rowsSkipped };
};
