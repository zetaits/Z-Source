import type { BankrollSettings, LedgerEntry } from "@/domain/bankroll";
import type { Bet, BetStatus } from "@/domain/bet";
import { BetId, BookId, LeagueId, MatchId } from "@/domain/ids";
import type { MarketKey, Selection } from "@/domain/market";
import type { StrategyConfig } from "@/domain/strategy";

const BET_CSV_HEADER = [
  "id",
  "placed_at",
  "match_id",
  "league_id",
  "market_key",
  "side",
  "line",
  "price_decimal",
  "book",
  "stake_units",
  "stake_minor",
  "status",
  "settled_at",
  "payout_minor",
  "closing_price_decimal",
  "notes",
] as const;

const needsQuoting = (s: string): boolean =>
  /[",\r\n]/.test(s);

const escapeCsv = (raw: string | number | null | undefined): string => {
  if (raw === null || raw === undefined) return "";
  const s = String(raw);
  return needsQuoting(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const betsToCsv = (bets: Bet[]): string => {
  const lines = [BET_CSV_HEADER.join(",")];
  for (const b of bets) {
    lines.push(
      [
        b.id,
        b.placedAt,
        b.matchId,
        b.leagueId,
        b.marketKey,
        b.selection.side,
        b.selection.line ?? "",
        b.priceDecimal,
        b.book,
        b.stakeUnits,
        b.stakeMinor,
        b.status,
        b.settledAt ?? "",
        b.payoutMinor ?? "",
        b.closingPriceDecimal ?? "",
        b.notes ?? "",
      ]
        .map(escapeCsv)
        .join(","),
    );
  }
  return lines.join("\n");
};

const parseCsvLine = (line: string): string[] => {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
};

const isBetStatus = (v: string): v is BetStatus =>
  ["OPEN", "WON", "LOST", "PUSH", "VOID", "CASHOUT"].includes(v);

export interface BetCsvImportResult {
  bets: Bet[];
  errors: { line: number; message: string }[];
}

export const csvToBets = (csv: string): BetCsvImportResult => {
  const errors: BetCsvImportResult["errors"] = [];
  const bets: Bet[] = [];
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { bets, errors };
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const idx = (key: string) => header.indexOf(key);
  const required = ["id", "placed_at", "match_id", "league_id", "market_key", "side", "price_decimal", "book", "stake_units", "stake_minor", "status"];
  for (const key of required) {
    if (idx(key) === -1) {
      errors.push({ line: 1, message: `Missing required column: ${key}` });
      return { bets, errors };
    }
  }
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const get = (k: string) => cells[idx(k)] ?? "";
    try {
      const status = get("status");
      if (!isBetStatus(status)) throw new Error(`Invalid status "${status}"`);
      const priceDecimal = Number(get("price_decimal"));
      const stakeUnits = Number(get("stake_units"));
      const stakeMinor = Number(get("stake_minor"));
      if (!Number.isFinite(priceDecimal) || priceDecimal <= 1) {
        throw new Error(`Invalid price_decimal "${get("price_decimal")}"`);
      }
      if (!Number.isFinite(stakeMinor) || stakeMinor < 0) {
        throw new Error(`Invalid stake_minor "${get("stake_minor")}"`);
      }
      const lineStr = get("line");
      const line = lineStr.length > 0 ? Number(lineStr) : undefined;
      const selection: Selection = {
        marketKey: get("market_key") as MarketKey,
        side: get("side"),
        ...(line !== undefined && Number.isFinite(line) ? { line } : {}),
      };
      const payoutStr = get("payout_minor");
      const closingStr = get("closing_price_decimal");
      const settledAt = get("settled_at");
      const notes = get("notes");
      const bet: Bet = {
        id: BetId(get("id")),
        placedAt: get("placed_at"),
        matchId: MatchId(get("match_id")),
        leagueId: LeagueId(get("league_id")),
        marketKey: get("market_key") as MarketKey,
        selection,
        priceDecimal,
        book: BookId(get("book")),
        stakeUnits,
        stakeMinor,
        status,
        settledAt: settledAt.length > 0 ? settledAt : undefined,
        payoutMinor: payoutStr.length > 0 ? Number(payoutStr) : undefined,
        closingPriceDecimal: closingStr.length > 0 ? Number(closingStr) : undefined,
        notes: notes.length > 0 ? notes : undefined,
      };
      bets.push(bet);
    } catch (err) {
      errors.push({ line: i + 1, message: (err as Error).message });
    }
  }
  return { bets, errors };
};

export interface StrategyExport {
  version: 1;
  exportedAt: string;
  stakePolicy: StrategyConfig["stakePolicy"];
  legWeights: StrategyConfig["legWeights"];
  enabledMarkets: MarketKey[];
  rules: StrategyConfig["rules"];
}

export const strategyToJson = (config: StrategyConfig): string => {
  const payload: StrategyExport = {
    version: 1,
    exportedAt: new Date().toISOString(),
    stakePolicy: config.stakePolicy,
    legWeights: config.legWeights,
    enabledMarkets: config.enabledMarkets,
    rules: config.rules,
  };
  return JSON.stringify(payload, null, 2);
};

export interface LedgerExport {
  version: 1;
  exportedAt: string;
  settings: BankrollSettings;
  entries: LedgerEntry[];
}

export const ledgerToJson = (
  entries: LedgerEntry[],
  settings: BankrollSettings,
): string => {
  const payload: LedgerExport = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    entries,
  };
  return JSON.stringify(payload, null, 2);
};

export const triggerDownload = (
  filename: string,
  content: string,
  mime: string,
): void => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const readFileAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsText(file);
  });
