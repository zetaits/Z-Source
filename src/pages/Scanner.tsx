import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";
import { Block, FlagChip, HourStrip, ScreenHeader, Tag, Verdict } from "@/components/zs";
import { findLeagueById } from "@/config/leagues";
import { SPORTS, type Sport } from "@/config/sports";
import type { CatalogMatch, MatchStatus } from "@/domain/match";
import type { Verdict as VerdictKind } from "@/domain/play";
import { useScannerFilters } from "@/features/scanner/hooks/useScannerFilters";
import type { StatusFilter, SortKey } from "@/features/scanner/hooks/useScannerFilters";
import { useFixturesWindow } from "@/features/fixtures/useFixturesWindow";
import { useSettings } from "@/features/settings/hooks/useSettings";
import { useSport } from "@/features/sport/SportContext";
import { SportGlyph } from "@/features/sport/SportGlyph";
import { localDayKey } from "@/services/catalog/windowFixtures";
import { formatRelativeShort } from "@/lib/time";

// ---------------------------------------------------------------------------
// Pre-analysis signal seam. Picks/verdicts only exist AFTER analysis, so the
// board has no real edge/verdict yet — this returns nulls and the UI renders a
// graceful "—". Once the engine exposes a top-of-book projected edge keyed by
// fixture, populate this and the desk edge-counts + best-edge column light up
// with zero further UI work. See handoff §4.
interface MatchSignal {
  edge: number | null;
  verdict: VerdictKind | null;
}
const matchSignal = (_m: CatalogMatch): MatchSignal => ({ edge: null, verdict: null });

/** Fixtures the model flagged (verdict !== PASS). 0 until the engine wires it. */
const edgeCount = (matches: CatalogMatch[]): number =>
  matches.filter((m) => {
    const v = matchSignal(m).verdict;
    return v !== null && v !== "PASS";
  }).length;

interface LeagueGroup {
  leagueId: string;
  leagueName: string;
  countryCode: string;
  matches: CatalogMatch[];
}

// Sports wired to a live engine feed today. Others render in the rail and
// re-label every screen, but their board shows the "feed not yet enabled"
// empty state until a provider is keyed to them. Add an id here once its
// fixtures are fetched per sport.id from the engine.
const SPORTS_WITH_FEED = new Set<string>(["football", "baseball"]);

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
  const { sport, activeSportId, setSport, cycle } = useSport();
  const navigate = useNavigate();
  const hasFeed = SPORTS_WITH_FEED.has(sport.id);
  const fixtures = useFixturesWindow();
  const { filters, apply, update } = useScannerFilters();

  // `[` / `]` cycle enabled sports — SCOPED to the Scanner (mounted = active).
  // Lives here, not in SportContext, so the shortcut never fires from other
  // views or global chrome.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if (e.key === "[") {
        e.preventDefault();
        cycle(-1);
      } else if (e.key === "]") {
        e.preventDefault();
        cycle(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cycle]);

  // Edge counts per desk. Only the active sport's fixtures are loaded, so we
  // count those; other desks show no count until selected (and stay 0 until the
  // engine exposes pre-analysis edges). See matchSignal seam.
  const edgesById = useMemo<Record<string, number>>(
    () => ({ [activeSportId]: hasFeed ? edgeCount(fixtures.data) : 0 }),
    [activeSportId, hasFeed, fixtures.data],
  );

  const dayMatches = useMemo<CatalogMatch[]>(() => {
    const target = targetLocalDayKey(offset);
    return fixtures.data.filter((m) => localDayKey(new Date(m.kickoffAt)) === target);
  }, [fixtures.data, offset]);

  const filtered = useMemo(() => apply(dayMatches), [dayMatches, apply]);
  const groups = useMemo(() => groupByLeague(filtered), [filtered]);

  // Scale for the best-edge bars. Floor at 0.01 so an empty board never /0;
  // all edges are null today so this stays at the floor until the engine wires
  // pre-analysis projections (see matchSignal).
  const maxEdge = useMemo(
    () => Math.max(0.01, ...filtered.map((m) => matchSignal(m).edge ?? 0)),
    [filtered],
  );

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
      ? errorMessage(fixtures.error, "Catalog fetch failed")
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
        bracket={`SCANNER · ${sport.label.toUpperCase()} · 72H WINDOW`}
        title="FIXTURE BOARD"
        sub={
          hasFeed
            ? `${todayLabel.toUpperCase()} · ${dayMatches.length} ${sport.unit}${
                nextUp ? ` · ${sport.nextLabel} ${formatRelativeShort(nextUp.kickoffAt)}` : ""
              }`
            : sport.competitions
        }
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

      <DeskSelector
        activeId={activeSportId}
        edgesById={edgesById}
        onPick={setSport}
        onAdd={() => navigate("/settings")}
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

      {!hasFeed ? (
        <FeedNotEnabled sport={sport} />
      ) : (
        <>
          <div data-tour-id="scanner-list">
            <DayStrip fixtures={fixtures.data} offset={offset} onChange={setOffset} />
          </div>

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
            groups.map((g) => <LeagueBlock key={g.leagueId} group={g} sport={sport} max={maxEdge} />)
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
        </>
      )}
    </div>
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

// ---------------------------------------------------------------------------
// ANALYSIS DESK — the sport selector. Lives INSIDE the Scanner (the only
// sport-scoped view); horizontally scrollable so it scales to any number of
// sports. Driven entirely by the SPORTS registry — append one object and a
// desk tab appears here automatically. `enabled:false` parks a sport as SOON.
// ---------------------------------------------------------------------------
function DeskSelector({
  activeId,
  edgesById,
  onPick,
  onAdd,
}: {
  activeId: string;
  edgesById: Record<string, number>;
  onPick: (id: string) => void;
  onAdd: () => void;
}) {
  const totalEdges = SPORTS.filter((s) => s.enabled).reduce(
    (a, s) => a + (edgesById[s.id] ?? 0),
    0,
  );
  const liveSports = SPORTS.filter((s) => s.enabled && s.live).length;
  return (
    <div style={{ border: "1px solid var(--zs-border)", background: "var(--zs-bg-elev)", marginBottom: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "9px 16px",
          borderBottom: "1px solid var(--zs-border)",
        }}
      >
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--zs-fg-muted)", letterSpacing: "0.18em" }}>
          ANALYSIS DESK
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--zs-fg-dim)",
            letterSpacing: "0.06em",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span className="zs-pulse" aria-hidden style={{ width: 5, height: 5, background: "var(--zs-pos)" }} />
          <span style={{ color: "var(--zs-accent)", fontWeight: 700 }}>{totalEdges}</span> live edges
          <span style={{ color: "var(--zs-fg-faint)" }}>·</span>
          {liveSports} sports active
        </span>
      </div>
      <div className="zs-scroll" style={{ display: "flex", overflowX: "auto" }}>
        {SPORTS.map((s) => {
          const active = s.id === activeId;
          const disabled = !s.enabled;
          const edges = edgesById[s.id] ?? 0;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => !disabled && onPick(s.id)}
              disabled={disabled}
              title={disabled ? `${s.label} — coming soon` : `${s.label} desk`}
              data-active={active ? "1" : undefined}
              style={{
                position: "relative",
                flex: "0 0 auto",
                display: "flex",
                alignItems: "center",
                gap: 13,
                padding: "15px 22px",
                borderRight: "1px solid var(--zs-border)",
                borderTop: "2px solid",
                borderTopColor: active ? "var(--zs-accent)" : "transparent",
                background: active ? "var(--zs-surface)" : "transparent",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.4 : 1,
                transition: "background 140ms var(--ease-snap)",
              }}
            >
              <SportGlyph sport={s} size={38} iconSize={23} active={active} />
              <span style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 3 }}>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 15,
                    letterSpacing: "-0.01em",
                    textTransform: "uppercase",
                    lineHeight: 1,
                    whiteSpace: "nowrap",
                    color: active ? "var(--zs-accent)" : "var(--zs-fg)",
                  }}
                >
                  {s.label}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: "0.06em",
                    whiteSpace: "nowrap",
                    color: "var(--zs-fg-muted)",
                  }}
                >
                  {disabled ? (
                    `${s.code} · SOON`
                  ) : (
                    <>
                      {s.code}
                      {edges > 0 && (
                        <>
                          {" · "}
                          <span style={{ color: "var(--zs-pos)", fontWeight: 600 }}>
                            {edges} edge{edges === 1 ? "" : "s"}
                          </span>
                        </>
                      )}
                    </>
                  )}
                </span>
              </span>
              {s.live && s.enabled && (
                <span
                  className={active ? "zs-pulse" : ""}
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 11,
                    right: 12,
                    width: 5,
                    height: 5,
                    background: active ? "var(--zs-accent)" : "var(--zs-pos)",
                  }}
                />
              )}
            </button>
          );
        })}
        <button
          type="button"
          title="Add sport"
          aria-label="Add sport"
          onClick={onAdd}
          style={{
            flex: "0 0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            padding: "0 22px",
            minWidth: 86,
            background: "transparent",
            border: "none",
            borderTop: "2px solid transparent",
            cursor: "pointer",
            color: "var(--zs-fg-muted)",
          }}
        >
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 20, lineHeight: 1 }}>+</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.10em" }}>ADD</span>
        </button>
      </div>
    </div>
  );
}

// Best-edge cell: small magnitude bar + +x.xx% (green). Pre-analysis projection;
// renders "—" when there's no edge or the fixture is settled. See handoff §4.
function EdgeMeter({ match, max }: { match: CatalogMatch; max: number }) {
  const { edge } = matchSignal(match);
  const settled = match.status === "FT" || match.status === "CANCELLED";
  if (settled || edge === null || edge <= 0) {
    return <span style={{ color: "var(--zs-fg-faint)" }}>—</span>;
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      <span style={{ width: 50, height: 4, background: "var(--zs-surface-2)", position: "relative", overflow: "hidden" }}>
        <span
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${(edge / max) * 100}%`,
            background: "var(--zs-pos)",
          }}
        />
      </span>
      <span style={{ color: "var(--zs-pos)", fontWeight: 700, fontFamily: "var(--font-mono)", fontSize: 12, minWidth: 50 }}>
        +{edge.toFixed(2)}%
      </span>
    </span>
  );
}

function StatusTag({ status }: { status: MatchStatus }) {
  const tone =
    status === "LIVE" ? "var(--zs-pos)" : status === "FT" ? "var(--zs-fg-muted)" : "var(--zs-fg-dim)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.10em",
        color: tone,
      }}
    >
      {status === "LIVE" && <span className="zs-pulse" aria-hidden style={{ width: 5, height: 5, background: "var(--zs-pos)" }} />}
      {status}
    </span>
  );
}

function FeedNotEnabled({ sport }: { sport: { unit: string; label: string } }) {
  return (
    <div
      className="zs-block"
      style={{
        padding: "44px 18px",
        textAlign: "center",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        color: "var(--zs-fg-muted)",
        letterSpacing: "0.06em",
      }}
    >
      ── no {sport.unit} in window · {sport.label} feed not yet enabled ──
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

const shortCode = (name: string): string =>
  (name.split(" ").pop() ?? name).slice(0, 3).toUpperCase();

function LeagueBlock({ group, sport, max }: { group: LeagueGroup; sport: Sport; max: number }) {
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
            {group.matches.length} {sport.unit.toUpperCase()} · {range}
          </span>
          <Tag>{group.matches.length}</Tag>
        </>
      }
      pad={false}
      style={{ marginBottom: 14 }}
    >
      {group.matches.map((m, i, arr) => {
        const settled = m.status === "FT" || m.status === "CANCELLED";
        const { verdict } = matchSignal(m);
        return (
          <Link
            key={m.catalogId}
            to={`/match/${m.catalogId}`}
            className="zs-match-row"
            style={{
              display: "grid",
              gridTemplateColumns: "84px 1fr 150px 92px 88px auto",
              gap: 16,
              alignItems: "center",
              padding: "12px 16px",
              borderBottom: i < arr.length - 1 ? "1px solid var(--zs-rule)" : "none",
              textDecoration: "none",
              color: "inherit",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              opacity: settled ? 0.5 : 1,
            }}
          >
            {/* time + countdown */}
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
              <div
                style={{
                  color: m.status === "LIVE" ? "var(--zs-pos)" : "var(--zs-fg-muted)",
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  marginTop: 2,
                }}
              >
                {m.status === "LIVE" ? "LIVE NOW" : settled ? "FINAL" : `IN ${formatRelativeShort(m.kickoffAt).toUpperCase()}`}
              </div>
            </div>
            {/* matchup w/ code badges */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ color: "var(--zs-fg-muted)", border: "1px solid var(--zs-border-bright)", padding: "1px 4px", fontSize: 10 }}>
                {shortCode(m.home.name)}
              </span>
              <span style={{ color: "var(--zs-fg)", fontWeight: 600 }}>{m.home.name}</span>
              <span style={{ color: "var(--zs-fg-faint)" }}>vs</span>
              <span style={{ color: "var(--zs-fg)", fontWeight: 600 }}>{m.away.name}</span>
              <span style={{ color: "var(--zs-fg-muted)", border: "1px solid var(--zs-border-bright)", padding: "1px 4px", fontSize: 10 }}>
                {shortCode(m.away.name)}
              </span>
            </div>
            {/* best edge */}
            <div style={{ textAlign: "right" }}>
              <EdgeMeter match={m} max={max} />
            </div>
            {/* verdict */}
            <div>
              {settled ? (
                <span style={{ color: "var(--zs-fg-muted)", fontSize: 10, letterSpacing: "0.08em" }}>SETTLED</span>
              ) : verdict ? (
                <Verdict v={verdict} />
              ) : (
                <span style={{ color: "var(--zs-fg-faint)" }}>—</span>
              )}
            </div>
            {/* status */}
            <div>
              <StatusTag status={m.status} />
            </div>
            {/* analyse */}
            <button className="zs-btn sm" style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>
              ANALYSE →
            </button>
          </Link>
        );
      })}
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
