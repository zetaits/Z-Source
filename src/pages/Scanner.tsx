import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Block, FlagChip, HourStrip, ScreenHeader, Tag } from "@/components/zs";
import { findLeagueById } from "@/config/leagues";
import type { CatalogMatch } from "@/domain/match";
import { useScannerFilters } from "@/features/scanner/hooks/useScannerFilters";
import type { StatusFilter, SortKey } from "@/features/scanner/hooks/useScannerFilters";
import { useFixturesWindow } from "@/features/fixtures/useFixturesWindow";
import { useSettings } from "@/features/settings/hooks/useSettings";
import { localDayKey } from "@/services/catalog/windowFixtures";
import { formatRelativeShort } from "@/lib/time";

interface LeagueGroup {
  leagueId: string;
  leagueName: string;
  countryCode: string;
  matches: CatalogMatch[];
}

const targetLocalDayKey = (offset: number): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return localDayKey(d);
};

const formatDayLabel = (offset: number): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "short" });
};

const groupByLeague = (matches: CatalogMatch[]): LeagueGroup[] => {
  const map = new Map<string, LeagueGroup>();
  for (const m of matches) {
    const id = String(m.leagueId);
    let g = map.get(id);
    if (!g) {
      const def = findLeagueById(id);
      g = {
        leagueId: id,
        leagueName: def?.name ?? m.leagueName ?? id,
        countryCode: def?.countryCode ?? m.countryCode ?? "—",
        matches: [],
      };
      map.set(id, g);
    }
    g.matches.push(m);
  }
  const groups = [...map.values()];
  groups.sort((a, b) => {
    const ta = findLeagueById(a.leagueId)?.tier ?? 99;
    const tb = findLeagueById(b.leagueId)?.tier ?? 99;
    if (ta !== tb) return ta - tb;
    return a.leagueName.localeCompare(b.leagueName);
  });
  for (const g of groups) {
    g.matches.sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
  }
  return groups;
};

export function Scanner() {
  const [offset, setOffset] = useState(0);
  const { data: settings } = useSettings();
  const fixtures = useFixturesWindow();
  const { filters, apply, update } = useScannerFilters();

  const dayMatches = useMemo<CatalogMatch[]>(() => {
    const target = targetLocalDayKey(offset);
    return fixtures.data.filter((m) => localDayKey(new Date(m.kickoffAt)) === target);
  }, [fixtures.data, offset]);

  const filtered = useMemo(() => apply(dayMatches), [dayMatches, apply]);
  const groups = useMemo(() => groupByLeague(filtered), [filtered]);

  const nextUp = useMemo<CatalogMatch | null>(() => {
    const now = Date.now();
    return (
      filtered
        .filter((m) => new Date(m.kickoffAt).getTime() >= now - 5 * 60_000)
        .filter((m) => m.status !== "FT" && m.status !== "CANCELLED")
        .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime())[0] ?? null
    );
  }, [filtered]);

  const enabledCount = settings?.enabledLeagueIds.length ?? 0;
  const todayLabel = useMemo(() => formatDayLabel(offset), [offset]);

  // toast for errors
  const lastErrRef = useRef<string | null>(null);
  useEffect(() => {
    const msg = fixtures.isError
      ? (fixtures.error as Error | undefined)?.message ?? "Catalog fetch failed"
      : null;
    if (msg && msg !== lastErrRef.current) {
      lastErrRef.current = msg;
      toast.error("Catalog unavailable", { description: msg });
    }
    if (!msg) lastErrRef.current = null;
  }, [fixtures.isError, fixtures.error]);

  return (
    <div style={{ padding: "28px 32px 48px" }}>
      <ScreenHeader
        bracket={`SCANNER · 72H WINDOW · ${enabledCount} LEAGUES`}
        title="FIXTURE BOARD"
        sub={`${todayLabel.toUpperCase()} · ${dayMatches.length} fixture${dayMatches.length === 1 ? "" : "s"}${
          nextUp ? ` · next whistle ${formatRelativeShort(nextUp.kickoffAt)}` : ""
        }`}
        right={
          <>
            <button
              className="zs-btn ghost"
              onClick={() => void fixtures.refetch()}
              disabled={fixtures.isFetching}
            >
              ⟲ {fixtures.isFetching ? "REFRESHING…" : "REFRESH"}
            </button>
            <Link to="/settings" className="zs-btn primary" style={{ textDecoration: "none" }}>
              LEAGUES →
            </Link>
          </>
        }
      />

      {enabledCount === 0 && (
        <div
          style={{
            border: "1px solid var(--zs-accent)",
            background: "var(--zs-accent-fill)",
            padding: "12px 16px",
            marginBottom: 16,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--zs-fg)",
          }}
        >
          <strong style={{ color: "var(--zs-accent)" }}>NO LEAGUES ENABLED</strong> — pick leagues in{" "}
          <Link to="/settings" style={{ color: "var(--zs-accent)" }}>
            Settings
          </Link>{" "}
          to populate the board.
        </div>
      )}

      <DayStrip fixtures={fixtures.data} offset={offset} onChange={setOffset} />

      <FilterBar
        status={filters.status}
        sort={filters.sort}
        onStatus={(s) => update({ status: s })}
        onSort={(s) => update({ sort: s })}
        showing={filtered.length}
      />

      {nextUp && <NextUpStrip match={nextUp} />}

      {fixtures.isLoading ? (
        <Loading />
      ) : groups.length > 0 ? (
        groups.map((g) => <LeagueBlock key={g.leagueId} group={g} />)
      ) : (
        <div
          className="zs-block"
          style={{
            padding: "26px 18px",
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--zs-fg-muted)",
          }}
        >
          NO FIXTURES ON {todayLabel.toUpperCase()} — try a different day or enable more leagues.
        </div>
      )}
    </div>
  );
}

function DayStrip({
  fixtures,
  offset,
  onChange,
}: {
  fixtures: CatalogMatch[];
  offset: number;
  onChange: (o: number) => void;
}) {
  const days = [0, 1, 2, 3].map((o) => {
    const target = targetLocalDayKey(o);
    const dayMatches = fixtures.filter((m) => localDayKey(new Date(m.kickoffAt)) === target);
    const hours = Array.from(
      new Set(dayMatches.map((m) => new Date(m.kickoffAt).getHours())),
    );
    hours.sort((a, b) => a - b);
    const range = hours.length > 0
      ? `${hours[0].toString().padStart(2, "0")}:00${
          hours.length > 1 ? `–${hours[hours.length - 1].toString().padStart(2, "0")}:00` : ""
        }`
      : null;
    const date = new Date();
    date.setDate(date.getDate() + o);
    return {
      o,
      day: date.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase(),
      dt: date.toLocaleDateString("en-GB", { day: "2-digit" }),
      n: dayMatches.length,
      hours,
      range,
    };
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
      {days.map((d) => {
        const active = d.o === offset;
        return (
          <button
            key={d.o}
            onClick={() => onChange(d.o)}
            className="zs-block"
            style={{
              textAlign: "left",
              padding: "14px 16px",
              cursor: "pointer",
              background: active ? "var(--zs-bg-elev)" : "var(--zs-bg)",
              borderColor: active ? "var(--zs-accent)" : "var(--zs-border)",
              position: "relative",
              color: "inherit",
            }}
          >
            {active && (
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "var(--zs-accent)" }} />
            )}
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: active ? "var(--zs-accent)" : "var(--zs-fg-muted)",
                letterSpacing: "0.16em",
                marginBottom: 8,
              }}
            >
              {d.day} {d.dt} · {d.o === 0 ? "TODAY" : `+${d.o}D`}
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: 38,
                color: d.n > 0 ? (active ? "var(--zs-fg)" : "var(--zs-fg-dim)") : "var(--zs-fg-faint)",
                letterSpacing: "-0.02em",
                lineHeight: 1,
                marginBottom: 10,
              }}
            >
              {d.n}
            </div>
            <div style={{ marginBottom: 8 }}>
              <HourStrip active={d.hours} />
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--zs-fg-muted)",
                letterSpacing: "0.04em",
              }}
            >
              {d.range ?? "no fixtures"}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function FilterBar({
  status,
  sort,
  onStatus,
  onSort,
  showing,
}: {
  status: StatusFilter;
  sort: SortKey;
  onStatus: (s: StatusFilter) => void;
  onSort: (s: SortKey) => void;
  showing: number;
}) {
  const statuses: StatusFilter[] = ["all", "scheduled", "live", "ft"];
  return (
    <div
      className="zs-block"
      style={{
        padding: "10px 14px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="zs-caption">STATUS</span>
        {statuses.map((s) => {
          const active = status === s;
          return (
            <button
              key={s}
              onClick={() => onStatus(s)}
              style={{
                padding: "4px 10px",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                cursor: "pointer",
                border: "1px solid",
                borderColor: active ? "var(--zs-accent)" : "var(--zs-border)",
                background: active ? "var(--zs-accent-fill)" : "transparent",
                color: active ? "var(--zs-accent)" : "var(--zs-fg-dim)",
              }}
            >
              {s}
            </button>
          );
        })}
      </div>
      <div style={{ width: 1, height: 18, background: "var(--zs-border)" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="zs-caption">SORT</span>
        <select
          className="zs-input"
          style={{ height: 24, fontSize: 10, padding: "0 8px" }}
          value={sort}
          onChange={(e) => onSort(e.target.value as SortKey)}
        >
          <option value="kickoff">KICKOFF ↑</option>
          <option value="league">LEAGUE</option>
          <option value="status">STATUS</option>
        </select>
      </div>
      <div style={{ flex: 1 }} />
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--zs-fg-muted)",
          letterSpacing: "0.08em",
        }}
      >
        SHOWING {showing}
      </div>
    </div>
  );
}

function NextUpStrip({ match }: { match: CatalogMatch }) {
  const league = findLeagueById(String(match.leagueId));
  const cc = league?.countryCode ?? match.countryCode ?? "—";
  const leagueName = league?.name ?? match.leagueName;
  const t = new Date(match.kickoffAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return (
    <div
      className="zs-block"
      style={{
        padding: "14px 18px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        gap: 18,
        borderColor: "var(--zs-accent)",
        flexWrap: "wrap",
      }}
    >
      <Tag tone="amber" solid>
        ▸ NEXT UP
      </Tag>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "var(--zs-fg)" }}>
          {match.home.name}
        </span>
        <span style={{ color: "var(--zs-fg-muted)", fontSize: 11 }}>vs</span>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "var(--zs-fg)" }}>
          {match.away.name}
        </span>
      </div>
      <div style={{ flex: 1 }} />
      <FlagChip cc={cc} />
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--zs-fg-dim)" }}>{leagueName}</span>
      <span className="tabnum" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--zs-fg)" }}>
        {t} · in {formatRelativeShort(match.kickoffAt)}
      </span>
      <Link
        to={`/match/${match.catalogId}`}
        className="zs-btn sm primary"
        style={{ textDecoration: "none" }}
      >
        ANALYSE →
      </Link>
    </div>
  );
}

function LeagueBlock({ group }: { group: LeagueGroup }) {
  const first = group.matches[0];
  const last = group.matches[group.matches.length - 1];
  const tFirst = new Date(first.kickoffAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const tLast = new Date(last.kickoffAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const range = group.matches.length > 1 ? `${tFirst}–${tLast}` : tFirst;

  return (
    <Block
      head={
        <>
          <FlagChip cc={group.countryCode} />{" "}
          <strong style={{ color: "var(--zs-fg)" }}>{group.leagueName}</strong>
        </>
      }
      headRight={
        <>
          <span style={{ fontSize: 10, color: "var(--zs-fg-muted)" }}>
            {group.matches.length} fixt · {range}
          </span>
          <Tag>{group.matches.length}</Tag>
        </>
      }
      pad={false}
      style={{ marginBottom: 14 }}
    >
      {group.matches.map((m, i, arr) => (
        <Link
          key={m.catalogId}
          to={`/match/${m.catalogId}`}
          style={{
            display: "grid",
            gridTemplateColumns: "70px 1fr 120px 90px 80px",
            gap: 14,
            alignItems: "center",
            padding: "12px 16px",
            borderBottom: i < arr.length - 1 ? "1px solid var(--zs-rule)" : "none",
            textDecoration: "none",
            color: "inherit",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        >
          <div>
            <div
              style={{
                color: "var(--zs-fg)",
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                fontFamily: "var(--font-display)",
              }}
            >
              {new Date(m.kickoffAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div style={{ color: "var(--zs-fg-muted)", fontSize: 9, letterSpacing: "0.08em" }}>
              IN {formatRelativeShort(m.kickoffAt).toUpperCase()}
            </div>
          </div>
          <div>
            <div style={{ color: "var(--zs-fg)", fontSize: 13, fontWeight: 600 }}>
              {m.home.name} <span style={{ color: "var(--zs-fg-muted)", fontWeight: 400 }}>vs</span> {m.away.name}
            </div>
            <div
              style={{
                color: "var(--zs-fg-muted)",
                fontSize: 10,
                marginTop: 2,
                letterSpacing: "0.06em",
              }}
            >
              {new Date(m.kickoffAt).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }).toUpperCase()}
            </div>
          </div>
          <div>
            <span className="zs-caption" style={{ fontSize: 9 }}>STATUS</span>
            <div style={{ color: "var(--zs-fg-dim)", fontSize: 12, fontWeight: 600, marginTop: 2 }}>
              {m.status}
            </div>
          </div>
          <Tag>{m.source.toUpperCase()}</Tag>
          <button className="zs-btn sm" style={{ marginLeft: "auto" }}>
            ANALYSE →
          </button>
        </Link>
      ))}
    </Block>
  );
}

function Loading() {
  return (
    <div className="zs-block" style={{ padding: 18 }}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="shimmer"
          style={{
            height: 40,
            marginBottom: 6,
            borderTop: "1px solid var(--zs-rule)",
            borderBottom: "1px solid var(--zs-rule)",
          }}
        />
      ))}
    </div>
  );
}
