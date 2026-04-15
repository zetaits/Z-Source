import type { BankrollSettings, LedgerEntry, LedgerKind } from "@/domain/bankroll";
import type { BetId } from "@/domain/ids";
import { getStorage } from "@/storage";

interface LedgerRow {
  id: number;
  occurred_at: string;
  kind: LedgerKind;
  amount_minor: number;
  balance_after_minor: number;
  bet_id: string | null;
  note: string | null;
}

const rowToEntry = (r: LedgerRow): LedgerEntry => ({
  id: r.id,
  occurredAt: r.occurred_at,
  kind: r.kind,
  amountMinor: r.amount_minor,
  balanceAfterMinor: r.balance_after_minor,
  betId: r.bet_id ? (r.bet_id as BetId) : undefined,
  note: r.note ?? undefined,
});

const SETTINGS_KEY = "bankroll";
const DEFAULTS: BankrollSettings = {
  currency: "USD",
  unitValueMinor: 10_000,
  startingBankrollMinor: 100_000,
};

export const bankrollRepo = {
  async loadSettings(): Promise<BankrollSettings> {
    const db = await getStorage();
    const rows = await db.select<{ value_json: string }>(
      "SELECT value_json FROM settings WHERE key = ?",
      [SETTINGS_KEY],
    );
    if (!rows[0]) return DEFAULTS;
    try {
      const parsed = JSON.parse(rows[0].value_json) as Partial<BankrollSettings>;
      return { ...DEFAULTS, ...parsed };
    } catch {
      return DEFAULTS;
    }
  },

  async saveSettings(next: BankrollSettings): Promise<void> {
    const db = await getStorage();
    await db.execute(
      "INSERT INTO settings(key, value_json, updated_at) VALUES(?, ?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at",
      [SETTINGS_KEY, JSON.stringify(next), new Date().toISOString()],
    );
  },

  async currentBalanceMinor(): Promise<number> {
    const db = await getStorage();
    const rows = await db.select<{ balance_after_minor: number }>(
      "SELECT balance_after_minor FROM bankroll_ledger ORDER BY id DESC LIMIT 1",
    );
    if (rows[0]) return rows[0].balance_after_minor;
    const settings = await this.loadSettings();
    return settings.startingBankrollMinor;
  },

  async openExposureMinor(): Promise<number> {
    const db = await getStorage();
    const rows = await db.select<{ total: number | null }>(
      "SELECT COALESCE(SUM(stake_minor), 0) as total FROM bets WHERE status = 'OPEN'",
    );
    return rows[0]?.total ?? 0;
  },

  async listLedger(limit = 500): Promise<LedgerEntry[]> {
    const db = await getStorage();
    const rows = await db.select<LedgerRow>(
      "SELECT * FROM bankroll_ledger ORDER BY id DESC LIMIT ?",
      [limit],
    );
    return rows.map(rowToEntry);
  },

  async append(opts: {
    kind: LedgerKind;
    amountMinor: number;
    betId?: BetId;
    note?: string;
    occurredAt?: string;
  }): Promise<LedgerEntry> {
    const db = await getStorage();
    const occurredAt = opts.occurredAt ?? new Date().toISOString();
    const balance = await this.currentBalanceMinor();
    const nextBalance = balance + opts.amountMinor;
    const result = await db.execute(
      "INSERT INTO bankroll_ledger(occurred_at, kind, amount_minor, balance_after_minor, bet_id, note) VALUES(?, ?, ?, ?, ?, ?)",
      [occurredAt, opts.kind, opts.amountMinor, nextBalance, opts.betId ?? null, opts.note ?? null],
    );
    return {
      id: result.lastInsertId ?? -1,
      occurredAt,
      kind: opts.kind,
      amountMinor: opts.amountMinor,
      balanceAfterMinor: nextBalance,
      betId: opts.betId,
      note: opts.note,
    };
  },

  async reset(startingMinor: number): Promise<void> {
    const db = await getStorage();
    await db.execute("DELETE FROM bankroll_ledger");
    await db.execute(
      "INSERT INTO bankroll_ledger(occurred_at, kind, amount_minor, balance_after_minor, bet_id, note) VALUES(?, ?, ?, ?, ?, ?)",
      [new Date().toISOString(), "DEPOSIT", startingMinor, startingMinor, null, "Starting bankroll"],
    );
  },

  async recomputeBalances(): Promise<void> {
    const db = await getStorage();
    const rows = await db.select<{
      id: number;
      amount_minor: number;
      balance_after_minor: number;
    }>(
      "SELECT id, amount_minor, balance_after_minor FROM bankroll_ledger ORDER BY id ASC",
    );
    if (rows.length === 0) return;
    const base = rows[0].balance_after_minor - rows[0].amount_minor;
    let running = base;
    for (const r of rows) {
      running += r.amount_minor;
      if (running !== r.balance_after_minor) {
        await db.execute(
          "UPDATE bankroll_ledger SET balance_after_minor = ? WHERE id = ?",
          [running, r.id],
        );
      }
    }
  },

  async deleteForBet(betId: BetId): Promise<void> {
    const db = await getStorage();
    await db.execute("DELETE FROM bankroll_ledger WHERE bet_id = ?", [betId]);
    await this.recomputeBalances();
  },
};
