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
  private nextLedgerId = 1;

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

    if (s.startsWith("DELETE FROM BANKROLL_LEDGER")) {
      const removed = this.ledger.length;
      this.ledger = [];
      this.nextLedgerId = 1;
      return { rowsAffected: removed };
    }

    throw new Error(`InMemoryAdapter: unsupported EXECUTE — ${sql}`);
  }
}
