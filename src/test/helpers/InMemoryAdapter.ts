import type { SqlParam, StorageAdapter } from "@/storage/StorageAdapter";

interface LedgerRow {
  id: number;
  occurred_at: string;
  kind: string;
  amount_minor: number;
  balance_after_minor: number;
  bet_id: string | null;
  note: string | null;
}

interface BetRow {
  id: string;
  status: string;
  stake_minor: number;
}

interface SnapshotRow {
  id: number;
  match_id: string;
  market_key: string;
  selection_key: string;
  price_decimal: number;
  book: string;
  taken_at: string;
  is_opener: number;
}

const normalize = (sql: string): string => sql.replace(/\s+/g, " ").trim().toUpperCase();

/**
 * Hand-rolled in-memory adapter for repo unit tests.
 * Only handles the SQL shapes used by repos under test — throws on anything else
 * to keep coverage honest.
 */
export class InMemoryAdapter implements StorageAdapter {
  readonly kind = "web-local" as const;

  private settings = new Map<string, string>();
  private ledger: LedgerRow[] = [];
  private bets: BetRow[] = [];
  private snapshots: SnapshotRow[] = [];
  private nextLedgerId = 1;
  private nextSnapshotId = 1;

  async init(): Promise<void> {}

  seedBet(bet: BetRow): void {
    this.bets.push(bet);
  }

  ledgerRows(): readonly LedgerRow[] {
    return this.ledger;
  }

  async select<T = Record<string, unknown>>(sql: string, params: SqlParam[] = []): Promise<T[]> {
    const s = normalize(sql);

    if (s.startsWith("SELECT VALUE_JSON FROM SETTINGS")) {
      const key = params[0] as string;
      const v = this.settings.get(key);
      return (v ? [{ value_json: v }] : []) as T[];
    }

    if (s.startsWith("SELECT BALANCE_AFTER_MINOR FROM BANKROLL_LEDGER")) {
      const last = this.ledger[this.ledger.length - 1];
      return (last ? [{ balance_after_minor: last.balance_after_minor }] : []) as T[];
    }

    if (s.includes("SUM(STAKE_MINOR)") && s.includes("STATUS = 'OPEN'")) {
      const total = this.bets
        .filter((b) => b.status === "OPEN")
        .reduce((sum, b) => sum + b.stake_minor, 0);
      return [{ total }] as T[];
    }

    if (s.startsWith("SELECT * FROM BANKROLL_LEDGER")) {
      const limit = (params[0] as number | undefined) ?? this.ledger.length;
      return [...this.ledger].reverse().slice(0, limit) as unknown as T[];
    }

    // odds_snapshots: latestFor — most specific, must come first.
    // SELECT * ... WHERE match_id = ? AND market_key = ? AND selection_key = ? AND is_opener = 0 ORDER BY taken_at DESC LIMIT 1
    if (s.startsWith("SELECT * FROM ODDS_SNAPSHOTS") && s.includes("SELECTION_KEY") && s.includes("IS_OPENER = 0")) {
      const matchId = params[0] as string;
      const marketKey = params[1] as string;
      const selKey = params[2] as string;
      const filtered = this.snapshots
        .filter(
          (r) =>
            r.match_id === matchId &&
            r.market_key === marketKey &&
            r.selection_key === selKey &&
            r.is_opener === 0,
        )
        .sort((a, b) => b.taken_at.localeCompare(a.taken_at));
      return (filtered.length > 0 ? [filtered[0]] : []) as T[];
    }

    // odds_snapshots: SELECT COUNT(*) as c ... WHERE match_id = ? AND is_opener = 1
    if (s.includes("COUNT(*)") && s.includes("ODDS_SNAPSHOTS") && s.includes("IS_OPENER")) {
      const matchId = params[0] as string;
      const c = this.snapshots.filter(
        (r) => r.match_id === matchId && r.is_opener === 1,
      ).length;
      return [{ c }] as T[];
    }

    // odds_snapshots: SELECT * ... WHERE match_id = ? AND market_key = ? ORDER BY taken_at ASC
    if (s.startsWith("SELECT * FROM ODDS_SNAPSHOTS") && s.includes("MARKET_KEY")) {
      const matchId = params[0] as string;
      const marketKey = params[1] as string;
      return this.snapshots
        .filter((r) => r.match_id === matchId && r.market_key === marketKey)
        .sort((a, b) => a.taken_at.localeCompare(b.taken_at)) as unknown as T[];
    }

    // odds_snapshots: SELECT * ... WHERE match_id = ? ORDER BY taken_at ASC
    if (s.startsWith("SELECT * FROM ODDS_SNAPSHOTS") && s.includes("MATCH_ID")) {
      const matchId = params[0] as string;
      return this.snapshots
        .filter((r) => r.match_id === matchId)
        .sort((a, b) => a.taken_at.localeCompare(b.taken_at)) as unknown as T[];
    }

    throw new Error(`InMemoryAdapter: unsupported SELECT — ${sql}`);
  }

  async execute(
    sql: string,
    params: SqlParam[] = [],
  ): Promise<{ rowsAffected: number; lastInsertId?: number }> {
    const s = normalize(sql);

    if (s.startsWith("INSERT INTO SETTINGS")) {
      const [key, value_json] = params as [string, string, string];
      this.settings.set(key, value_json);
      return { rowsAffected: 1 };
    }

    if (s.startsWith("INSERT INTO BANKROLL_LEDGER")) {
      const [occurred_at, kind, amount_minor, balance_after_minor, bet_id, note] = params as [
        string,
        string,
        number,
        number,
        string | null,
        string | null,
      ];
      const id = this.nextLedgerId++;
      this.ledger.push({
        id,
        occurred_at,
        kind,
        amount_minor,
        balance_after_minor,
        bet_id,
        note,
      });
      return { rowsAffected: 1, lastInsertId: id };
    }

    if (s.startsWith("INSERT INTO ODDS_SNAPSHOTS")) {
      const [match_id, market_key, selection_key, price_decimal, book, taken_at, is_opener] =
        params as [string, string, string, number, string, string, number];
      const id = this.nextSnapshotId++;
      this.snapshots.push({
        id,
        match_id,
        market_key,
        selection_key,
        price_decimal,
        book,
        taken_at,
        is_opener,
      });
      return { rowsAffected: 1, lastInsertId: id };
    }

    if (s.startsWith("DELETE FROM BANKROLL_LEDGER")) {
      const removed = this.ledger.length;
      this.ledger = [];
      this.nextLedgerId = 1;
      return { rowsAffected: removed };
    }

    throw new Error(`InMemoryAdapter: unsupported EXECUTE — ${sql}`);
  }
}
