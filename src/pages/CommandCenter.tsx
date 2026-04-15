import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { Activity, ArrowRight, CalendarClock, ListChecks, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KickoffBadge } from "@/components/domain/KickoffBadge";
import { findLeagueById } from "@/config/leagues";
import type { CatalogMatch } from "@/domain/match";
import { clvPct, profitMinor } from "@/domain/bet";
import { BankrollSummary } from "@/features/bankroll/components/BankrollSummary";
import {
  useBankrollSettings,
  useCurrentBalance,
} from "@/features/bankroll/hooks/useBankroll";
import { useBets, useOpenExposure } from "@/features/bankroll/hooks/useBets";
import { sofaScoreCatalogProvider } from "@/services/impl/sofaScoreCatalogProvider";
import { settingsStore } from "@/services/settings/settingsStore";
import { LeagueId } from "@/domain/ids";
import { isPersistentStorage } from "@/storage";
import { matchesCacheRepo } from "@/storage/repos/matchesCacheRepo";
import { formatMoney, formatSignedMoney } from "@/lib/money";

const CACHE_TTL_MS = 5 * 60_000;

const buildRange = (dayOffset: number) => {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() + dayOffset);
  const to = new Date(from);
  to.setHours(23, 59, 59, 999);
  return { from, to };
};

const fetchFixturesForOffset = async (offset: number): Promise<CatalogMatch[]> => {
  const settings = await settingsStore.load();
  const leagueIds = settings.enabledLeagueIds.map((id) => LeagueId(id));
  if (leagueIds.length === 0) return [];
  const { from, to } = buildRange(offset);

  if (isPersistentStorage()) {
    const cached = await matchesCacheRepo.listInRange({
      leagueIds,
      from,
      to,
      maxAgeMs: CACHE_TTL_MS,
    });
    if (cached) return cached;
  }

  const fresh = await sofaScoreCatalogProvider.listFixtures({ leagueIds, from, to });
  if (isPersistentStorage() && fresh.length > 0) {
    void matchesCacheRepo.upsert(fresh).catch(() => {});
  }
  return fresh;
};

const useMultiDayFixtures = () =>
  useQueries({
    queries: [0, 1, 2, 3].map((offset) => ({
      queryKey: ["scanner", "fixtures", "rollup", offset] as const,
      queryFn: () => fetchFixturesForOffset(offset),
      staleTime: CACHE_TTL_MS,
      gcTime: 30 * 60_000,
    })),
  });

export function CommandCenter() {
  const persistent = isPersistentStorage();
  const fixtures = useMultiDayFixtures();
  const settingsQ = useBankrollSettings();
  const balanceQ = useCurrentBalance();
  const exposureQ = useOpenExposure();
  const openBetsQ = useBets({ status: "OPEN", limit: 20 });
  const recentBetsQ = useBets({ limit: 100 });

  const upcoming = useMemo<CatalogMatch[]>(() => {
    const all: CatalogMatch[] = [];
    const now = Date.now();
    for (const q of fixtures) {
      if (q.data) all.push(...q.data);
    }
    return all
      .filter((m) => new Date(m.kickoffAt).getTime() >= now - 3 * 3_600_000)
      .filter((m) => m.status !== "FT" && m.status !== "CANCELLED")
      .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))
      .slice(0, 10);
  }, [fixtures]);

  const isLoadingFixtures = fixtures.some((q) => q.isLoading);
  const fixtureError = fixtures.find((q) => q.isError)?.error as Error | undefined;

  const clvSummary = useMemo(() => {
    const bets = recentBetsQ.data ?? [];
    const with30dCutoff = Date.now() - 30 * 24 * 3_600_000;
    const relevant = bets.filter((b) => {
      if (b.status === "OPEN") return false;
      if (b.closingPriceDecimal === undefined) return false;
      const settledAt = b.settledAt ? new Date(b.settledAt).getTime() : 0;
      return settledAt >= with30dCutoff;
    });
    if (relevant.length === 0) return null;
    const values = relevant.map((b) => clvPct(b) ?? 0);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const positive = values.filter((v) => v > 0).length;
    return { avg, count: values.length, positive };
  }, [recentBetsQ.data]);

  const recentSettled = useMemo(() => {
    return (recentBetsQ.data ?? [])
      .filter((b) => b.status !== "OPEN")
      .slice(0, 5);
  }, [recentBetsQ.data]);

  return (
    <div className="flex h-full flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          M8 · command center
        </span>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Command Center</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Today plus the next three days. Bankroll snapshot and the nearest fixtures to get ahead of.
            </p>
          </div>
          <Button asChild size="sm">
            <Link to="/scanner">
              Open Scanner <ArrowRight className="ml-1.5 size-3.5" />
            </Link>
          </Button>
        </div>
      </header>

      {!persistent && (
        <Alert>
          <AlertTitle>Limited mode</AlertTitle>
          <AlertDescription>
            Bankroll metrics live in SQLite — run via <code className="font-mono text-xs">npm run tauri:dev</code> to activate.
          </AlertDescription>
        </Alert>
      )}

      {persistent && settingsQ.data && balanceQ.data !== undefined && exposureQ.data !== undefined ? (
        <BankrollSummary
          balanceMinor={balanceQ.data}
          exposureMinor={exposureQ.data}
          openBetCount={openBetsQ.data?.length ?? 0}
          settings={settingsQ.data}
        />
      ) : persistent ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : null}

      <div className="grid flex-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SectionHeader
            icon={<CalendarClock className="size-4" />}
            title="Upcoming fixtures"
            action={
              <Badge variant="outline" className="font-mono text-[10px]">
                Today · +3d
              </Badge>
            }
          />
          {fixtureError ? (
            <Alert variant="destructive" className="mt-3">
              <AlertTitle>Catalog unavailable</AlertTitle>
              <AlertDescription>{fixtureError.message}</AlertDescription>
            </Alert>
          ) : isLoadingFixtures && upcoming.length === 0 ? (
            <div className="mt-3 flex flex-col gap-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : upcoming.length === 0 ? (
            <EmptyState
              title="Nothing scheduled"
              hint="Enable leagues in Settings or try the Scanner for a wider window."
              cta={{ label: "Go to Settings", to: "/settings" }}
            />
          ) : (
            <ul className="mt-3 flex flex-col gap-1.5">
              {upcoming.map((m) => (
                <UpcomingRow key={m.catalogId} match={m} />
              ))}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-6">
          <section>
            <SectionHeader icon={<Target className="size-4" />} title="CLV (30d)" />
            {persistent ? (
              clvSummary ? (
                <Card className="mt-3">
                  <CardContent className="flex flex-col gap-1.5 p-4">
                    <span
                      className={`font-mono text-2xl font-semibold tabular-nums ${clvSummary.avg >= 0 ? "text-[hsl(var(--success))]" : "text-destructive"}`}
                    >
                      {clvSummary.avg >= 0 ? "+" : ""}
                      {(clvSummary.avg * 100).toFixed(2)}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Avg across {clvSummary.count} settled · {clvSummary.positive} beat the close
                    </span>
                  </CardContent>
                </Card>
              ) : (
                <Card className="mt-3 border-dashed">
                  <CardContent className="p-4 text-xs text-muted-foreground">
                    No settled bets with a closing snapshot yet. CLV fills in as you settle bets with cached odds.
                  </CardContent>
                </Card>
              )
            ) : null}
          </section>

          <section>
            <SectionHeader
              icon={<ListChecks className="size-4" />}
              title="Open bets"
              action={
                <Link
                  to="/bankroll"
                  className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary"
                >
                  View all
                </Link>
              }
            />
            {persistent && settingsQ.data ? (
              (openBetsQ.data ?? []).length === 0 ? (
                <Card className="mt-3 border-dashed">
                  <CardContent className="p-4 text-xs text-muted-foreground">
                    No open bets.
                  </CardContent>
                </Card>
              ) : (
                <ul className="mt-3 flex flex-col gap-1.5">
                  {(openBetsQ.data ?? []).slice(0, 5).map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center justify-between rounded-md border border-border bg-card/40 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium capitalize">
                          {b.selection.side}
                          {b.selection.line !== undefined ? ` ${b.selection.line}` : ""}
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {b.marketKey} · {b.book}
                        </div>
                      </div>
                      <div className="ml-3 text-right font-mono tabular-nums">
                        <div>{b.priceDecimal.toFixed(2)}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {formatMoney(b.stakeMinor, settingsQ.data.currency)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </section>

          <section>
            <SectionHeader icon={<Activity className="size-4" />} title="Recent activity" />
            {persistent && settingsQ.data ? (
              recentSettled.length === 0 ? (
                <Card className="mt-3 border-dashed">
                  <CardContent className="p-4 text-xs text-muted-foreground">
                    No settled bets yet.
                  </CardContent>
                </Card>
              ) : (
                <ul className="mt-3 flex flex-col gap-1.5">
                  {recentSettled.map((b) => {
                    const pnl = profitMinor(b);
                    const tone =
                      pnl > 0
                        ? "text-[hsl(var(--success))]"
                        : pnl < 0
                          ? "text-destructive"
                          : "text-muted-foreground";
                    return (
                      <li
                        key={b.id}
                        className="flex items-center justify-between rounded-md border border-border bg-card/40 px-3 py-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate capitalize">
                            {b.selection.side}
                            {b.selection.line !== undefined ? ` ${b.selection.line}` : ""}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {b.status} · {new Date(b.settledAt ?? b.placedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className={`ml-3 font-mono tabular-nums ${tone}`}>
                          {formatSignedMoney(pnl, settingsQ.data.currency)}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function EmptyState({
  title,
  hint,
  cta,
}: {
  title: string;
  hint: string;
  cta?: { label: string; to: string };
}) {
  return (
    <div className="mt-3 flex flex-col items-start gap-2 rounded-md border border-dashed border-border bg-card/20 p-5">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {cta ? (
        <Button asChild size="sm" variant="outline">
          <Link to={cta.to}>{cta.label}</Link>
        </Button>
      ) : null}
    </div>
  );
}

function UpcomingRow({ match }: { match: CatalogMatch }) {
  const league = findLeagueById(String(match.leagueId));
  const leagueName = league?.name ?? match.leagueName ?? String(match.leagueId);
  return (
    <li>
      <Link
        to={`/match/${match.catalogId}`}
        className="group flex min-h-[44px] items-center gap-4 rounded-md border border-transparent px-3 py-2 transition-colors hover:border-border hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <KickoffBadge kickoffAt={match.kickoffAt} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm">{match.home.name}</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              vs
            </span>
            <span className="truncate text-sm">{match.away.name}</span>
          </div>
          <div className="truncate text-[11px] text-muted-foreground">{leagueName}</div>
        </div>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </li>
  );
}
