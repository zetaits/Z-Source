import { useState, useSyncExternalStore } from "react";
import { Block, FlagChip, Tag } from "@/components/zs";
import { LEAGUES, type LeagueDef } from "@/config/leagues";
import {
  getDiscovered,
  discoveredVersion,
  subscribeDiscovered,
} from "@/services/catalog/discoveredLeagues";
import type { AppSettings } from "@/services/settings/settingsStore";

interface Props {
  settings: AppSettings;
  onUpdate(patch: Partial<AppSettings>): Promise<void>;
}

const tierLabelFor = (tier: number): string =>
  tier === 0 ? "INTL" : tier === 1 ? "TOP" : `T${tier}`;

export function LeaguesPicker({ settings, onUpdate }: Props) {
  const enabled = new Set(settings.enabledLeagueIds);
  const [filter, setFilter] = useState("");

  // Re-render when discovery hydrates the registry.
  useSyncExternalStore(subscribeDiscovered, discoveredVersion);
  const discovered = getDiscovered();

  const q = filter.trim().toLowerCase();
  const matches = (l: LeagueDef): boolean =>
    !q || l.name.toLowerCase().includes(q) || l.countryCode.toLowerCase().includes(q);

  const curated = LEAGUES.filter(matches);

  // Discovered set is large (~370); only surface entries that are enabled or
  // match an active search, so the default view stays the curated shortlist.
  const discoveredVisible = discovered.filter((l) =>
    q ? matches(l) : enabled.has(String(l.id)),
  );

  const onCount = [...LEAGUES, ...discovered].filter((l) =>
    enabled.has(String(l.id)),
  ).length;

  const toggle = async (leagueId: string, on: boolean) => {
    const next = new Set(enabled);
    if (on) next.add(leagueId);
    else next.delete(leagueId);
    await onUpdate({ enabledLeagueIds: [...next] });
  };

  const renderRow = (league: LeagueDef) => {
    const id = String(league.id);
    const on = enabled.has(id);
    const tierLabel = tierLabelFor(league.tier);
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
        {league.discovered && league.eventsCount !== undefined && (
          <span
            style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--zs-fg-muted)" }}
          >
            {league.eventsCount}ev
          </span>
        )}
        <Tag tone={tierLabel === "TOP" || tierLabel === "INTL" ? "amber" : "default"}>
          {tierLabel}
        </Tag>
      </div>
    );
  };

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: 8,
  } as const;

  const subhead = (text: string) => (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.08em",
        color: "var(--zs-fg-muted)",
        margin: "12px 0 4px",
      }}
    >
      {text}
    </div>
  );

  return (
    <Block
      head={`LEAGUES · ${onCount} ON`}
      headRight={
        <input
          className="zs-input"
          placeholder="search all competitions…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ height: 24, fontSize: 10, width: 200 }}
        />
      }
    >
      <div style={gridStyle}>{curated.map(renderRow)}</div>

      {discoveredVisible.length > 0 && (
        <>
          {subhead(`DISCOVERED · odds-api.io${q ? "" : " (enabled)"}`)}
          <div style={gridStyle}>{discoveredVisible.map(renderRow)}</div>
        </>
      )}

      {!q && discovered.length > 0 && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--zs-fg-muted)",
            marginTop: 10,
          }}
        >
          + {discovered.length} more priceable competitions — search to enable any.
        </div>
      )}

      {curated.length === 0 && discoveredVisible.length === 0 && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--zs-fg-muted)",
            padding: 12,
          }}
        >
          — NO LEAGUES MATCH FILTER —
        </div>
      )}
    </Block>
  );
}
