import { getStorage } from "@/storage";

export interface RuleConfigRow {
  ruleId: string;
  enabled: boolean;
  weight: number;
  params?: Record<string, unknown>;
}

interface DbRow {
  rule_id: string;
  enabled: number;
  weight: number;
  params_json: string | null;
}

const rowToConfig = (r: DbRow): RuleConfigRow => ({
  ruleId: r.rule_id,
  enabled: r.enabled === 1,
  weight: r.weight,
  params: r.params_json ? (JSON.parse(r.params_json) as Record<string, unknown>) : undefined,
});

export const strategyRepo = {
  async listAll(): Promise<RuleConfigRow[]> {
    const db = await getStorage();
    const rows = await db.select<DbRow>("SELECT * FROM strategy_rules_config");
    return rows.map(rowToConfig);
  },

  async upsert(row: RuleConfigRow): Promise<void> {
    const db = await getStorage();
    await db.execute(
      "INSERT INTO strategy_rules_config(rule_id, enabled, weight, params_json) VALUES(?, ?, ?, ?) " +
        "ON CONFLICT(rule_id) DO UPDATE SET enabled=excluded.enabled, weight=excluded.weight, params_json=excluded.params_json",
      [row.ruleId, row.enabled ? 1 : 0, row.weight, row.params ? JSON.stringify(row.params) : null],
    );
  },
};
