import { useMemo, useState } from "react";
import { Block, FlagChip, Tag } from "@/components/zs";
import { LEAGUES } from "@/config/leagues";
import type { AppSettings } from "@/services/settings/settingsStore";

interface Props {
  settings: AppSettings;
  onUpdate(patch: Partial<AppSettings>): Promise<void>;
}

export function LeaguesPicker({ settings, onUpdate }: Props) {
  const enabled = new Set(settings.enabledLeagueIds);
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return LEAGUES;
    return LEAGUES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.countryCode.toLowerCase().includes(q),
    );
  }, [filter]);

  const onCount = LEAGUES.filter((l) => enabled.has(String(l.id))).length;

  const toggle = async (leagueId: string, on: boolean) => {
    const next = new Set(enabled);
    if (on) next.add(leagueId);
    else next.delete(leagueId);
    await onUpdate({ enabledLeagueIds: [...next] });
  };

  return (
    <Block
      head={`LEAGUES · ${onCount}/${LEAGUES.length} ON`}
      headRight={
        <input
          className="zs-input"
          placeholder="filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ height: 24, fontSize: 10, width: 160 }}
        />
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 8 }}>
        {filtered.map((league) => {
          const id = String(league.id);
          const on = enabled.has(id);
          const tierLabel = league.tier === 0 ? "INTL" : league.tier === 1 ? "TOP" : `T${league.tier}`;
          return (
            <div
              key={id}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                padding: "8px 12px",
                border: "1px solid var(--zs-border)",
                background: "var(--zs-bg)",
              }}
            >
              <span
                role="switch"
                aria-checked={on}
                aria-label={league.name}
                className={`zs-toggle ${on ? "on" : ""}`}
                onClick={() => void toggle(id, !on)}
              />
              <FlagChip cc={league.countryCode} />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: on ? "var(--zs-fg)" : "var(--zs-fg-muted)",
                  flex: 1,
                }}
              >
                {league.name}
              </span>
              <Tag tone={tierLabel === "TOP" || tierLabel === "INTL" ? "amber" : "default"}>{tierLabel}</Tag>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--zs-fg-muted)", padding: 12 }}>
            — NO LEAGUES MATCH FILTER —
          </div>
        )}
      </div>
    </Block>
  );
}
