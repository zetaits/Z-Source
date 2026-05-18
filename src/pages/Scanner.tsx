import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LeagueAccordion } from "@/components/domain/LeagueAccordion";
import { DayKpiRow } from "@/features/scanner/components/DayKpiRow";
import { NextUpStrip } from "@/features/scanner/components/NextUpStrip";
import { FilterBar } from "@/features/scanner/components/FilterBar";
import { LookAheadFooter } from "@/features/scanner/components/LookAheadFooter";
import { useScannerFilters } from "@/features/scanner/hooks/useScannerFilters";
import { useFixturesWindow } from "@/features/fixtures/useFixturesWindow";
import { useSettings } from "@/features/settings/hooks/useSettings";
import { findLeagueById } from "@/config/leagues";
import { localDayKey } from "@/services/catalog/windowFixtures";
import type { CatalogMatch } from "@/domain/match";

interface LeagueGroup {
  leagueId: string;
  leagueName: string;
  countryCode: string;
  matches: CatalogMatch[];
}

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
  // Sort groups: tier (top first), then by name. Sort matches within group by kickoff.
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
  return d.toLocaleDateString(undefined, { weekday: "long", day: "2-digit", month: "short" });
};

const formatRelativeShort = (iso: string): string => {
  const diffMin = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (diffMin < 0) return "kickoff passed";
  if (diffMin < 60) return `in ${diffMin}m`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  if (h < 24) return `in ${h}h ${m.toString().padStart(2, "0")}m`;
  const days = Math.round(h / 24);
  return `in ${days}d`;
};

export function Scanner() {
  const [offset, setOffset] = useState(0);
  const { data: settings } = useSettings();
  const fixtures = useFixturesWindow();
  const { filters, apply } = useScannerFilters();

  const allFixtures = fixtures.data;

  const dayMatches = useMemo<CatalogMatch[]>(() => {
    const target = targetLocalDayKey(offset);
    return allFixtures.filter((m) => localDayKey(new Date(m.kickoffAt)) === target);
  }, [allFixtures, offset]);

  const filteredDayMatches = useMemo(() => apply(dayMatches), [dayMatches, apply]);
  const groups = useMemo(() => groupByLeague(filteredDayMatches), [filteredDayMatches]);

  // Next-up: next SCHEDULED in selected day (fall back to any non-final).
  const nextUp = useMemo<CatalogMatch | null>(() => {
    const now = Date.now();
    const future = filteredDayMatches
      .filter((m) => new Date(m.kickoffAt).getTime() >= now - 5 * 60_000)
      .filter((m) => m.status !== "FT" && m.status !== "CANCELLED")
      .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
    return future[0] ?? null;
  }, [filteredDayMatches]);

  // Look-ahead: when current day is thin (≤2), find next offset within +3d that has ≥ current+1.
  const lookAhead = useMemo(() => {
    if (dayMatches.length > 2) return null;
    let best: { offset: number; count: number; leagues: number } | null = null;
    for (let o = 0; o <= 3; o++) {
      if (o === offset) continue;
      const key = targetLocalDayKey(o);
      const day = allFixtures.filter((m) => localDayKey(new Date(m.kickoffAt)) === key);
      if (day.length <= dayMatches.length) continue;
      const leagues = new Set(day.map((m) => String(m.leagueId))).size;
      if (!best || day.length > best.count) {
        best = { offset: o, count: day.length, leagues };
      }
    }
    if (!best) return null;
    return {
      offset: best.offset,
      weekday: formatDayLabel(best.offset).split(" ")[0],
      dayLabel: formatDayLabel(best.offset),
      count: best.count,
      leagueCount: best.leagues,
    };
  }, [allFixtures, dayMatches.length, offset]);

  const enabledCount = settings?.enabledLeagueIds.length ?? 0;

  // Window summary (all fixtures inside the +3d window)
  const windowLeagueCount = useMemo(
    () => new Set(allFixtures.map((m) => String(m.leagueId))).size,
    [allFixtures],
  );
  const windowNextKickoff = useMemo(() => {
    const now = Date.now();
    const upcoming = allFixtures
      .filter((m) => new Date(m.kickoffAt).getTime() >= now)
      .filter((m) => m.status !== "FT" && m.status !== "CANCELLED")
      .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
    return upcoming[0]?.kickoffAt;
  }, [allFixtures]);

  const todayLabel = useMemo(() => formatDayLabel(offset), [offset]);

  const lastErrorRef = useRef<string | null>(null);
  useEffect(() => {
    const message = fixtures.isError
      ? (fixtures.error as Error | undefined)?.message ?? "Catalog fetch failed"
      : null;
    if (message && message !== lastErrorRef.current) {
      lastErrorRef.current = message;
      toast.error("Catalog unavailable", { description: message });
    }
    if (!message) lastErrorRef.current = null;
  }, [fixtures.isError, fixtures.error]);

  const dayKicker = `${todayLabel.toUpperCase()} · WINDOW NOW+72H`;

  const filtersActive =
    filters.status !== "all" || filters.leagues.length > 0 || filters.sort !== "kickoff";

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-8" style={{ background: "var(--zs-bg)" }}>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-1">
        <div className="kicker">{dayKicker}</div>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[30px] leading-[1.1] text-fg-dim">
              <span className="text-fg">{fixtures.isLoading ? "…" : dayMatches.length}</span>{" "}
              {dayMatches.length === 1 ? "fixture" : "fixtures"} on {todayLabel}
              {" · "}
              <span className="text-fg">{windowLeagueCount}</span> {windowLeagueCount === 1 ? "league" : "leagues"} live in window
              {windowNextKickoff && (
                <>
                  {" · next kickoff "}
                  <span className="text-fg">{formatRelativeShort(windowNextKickoff)}</span>
                </>
              )}
            </h1>
            <p className="mt-1.5 text-[13px] text-fg-dim">
              OddsAPI quota untouched · click a match to run analysis on demand
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fixtures.refetch()}
            disabled={fixtures.isFetching}
          >
            <RefreshCcw className={`mr-2 size-3.5 ${fixtures.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      {enabledCount === 0 && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>No leagues enabled</AlertTitle>
          <AlertDescription>
            Pick the leagues you want to scan in{" "}
            <Link className="text-primary hover:underline" to="/settings">Settings</Link>.
          </AlertDescription>
        </Alert>
      )}

      {fixtures.isError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Catalog unavailable</AlertTitle>
          <AlertDescription>
            {(fixtures.error as Error)?.message ?? "Unknown error"}
          </AlertDescription>
        </Alert>
      )}

      {/* ── Day KPI row (replaces DateTabs) ───────────────────────── */}
      <DayKpiRow fixtures={allFixtures} offset={offset} onChange={setOffset} />

      {/* ── Next-up strip ────────────────────────────────────────── */}
      <NextUpStrip match={nextUp} />

      {/* ── Filter bar ───────────────────────────────────────────── */}
      <FilterBar dayMatches={dayMatches} />

      {/* ── League list ──────────────────────────────────────────── */}
      {fixtures.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : groups.length > 0 ? (
        <LeagueAccordion groups={groups} />
      ) : (
        <div className="rounded-lg border border-dashed border-zs p-8 text-center" style={{ background: "var(--zs-bg-elev)" }}>
          <p className="kicker">
            {filtersActive ? "no matches under active filters" : `no fixtures on ${todayLabel}`}
          </p>
          <p className="mt-2 text-[13px] text-fg-dim">
            {filtersActive
              ? "Loosen the filter set or pick a different day."
              : "Enable more leagues in Settings or pick another day above."}
          </p>
        </div>
      )}

      {/* ── Look-ahead footer ────────────────────────────────────── */}
      <LookAheadFooter target={lookAhead} onJump={setOffset} />
    </div>
  );
}
