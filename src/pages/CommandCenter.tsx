import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KickoffBadge } from "@/components/domain/KickoffBadge";
import { findLeagueById } from "@/config/leagues";
import type { CatalogMatch } from "@/domain/match";
import { clvPct, profitMinor } from "@/domain/bet";
import {
  useBankrollSettings,
  useCurrentBalance,
  useLedger,
} from "@/features/bankroll/hooks/useBankroll";
import { useBets, useOpenExposure } from "@/features/bankroll/hooks/useBets";
import { useEquityCurve } from "@/features/bankroll/hooks/useEquityCurve";
import {
  WINDOW_FIXTURES_TTL_MS,
  fetchWindowFixtures,
  windowFixturesQueryKey,
} from "@/services/catalog/windowFixtures";
import { useSettings } from "@/features/settings/hooks/useSettings";
import { resolveProviders } from "@/services/providers/factory";
import { isPersistentStorage } from "@/storage";
import { formatMoney, formatSignedMoney } from "@/lib/money";

const useWindowFixtures = () =>
  useQuery({
    queryKey: windowFixturesQueryKey,
    queryFn: fetchWindowFixtures,
    staleTime: WINDOW_FIXTURES_TTL_MS,
    gcTime: 30 * 60_000,
  });

export function CommandCenter() {
  const persistent = isPersistentStorage();
  const fixtures = useWindowFixtures();
  const settingsQ = useBankrollSettings();
  const balanceQ = useCurrentBalance();
  const exposureQ = useOpenExposure();
  const openBetsQ = useBets({ status: "OPEN", limit: 20 });
  const recentBetsQ = useBets({ limit: 100 });
  const ledgerQ = useLedger(60);
  const { data: appSettings } = useSettings();

  const upcoming = useMemo<CatalogMatch[]>(() => {
    const data = fixtures.data ?? [];
    const now = Date.now();
    return data
      .filter((m) => new Date(m.kickoffAt).getTime() >= now - 3 * 3_600_000)
      .filter((m) => m.status !== "FT" && m.status !== "CANCELLED")
      .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))
      .slice(0, 10);
  }, [fixtures.data]);

  const bookCount = useMemo(() => {
    if (!appSettings) return 0;
    const { oddsComponents } = resolveProviders(appSettings);
    return oddsComponents.filter((c) => c.configured).length;
  }, [appSettings]);

  const currency = settingsQ.data?.currency ?? "USD";

  const clvSummary = useMemo(() => {
    const bets = recentBetsQ.data ?? [];
    const cutoff = Date.now() - 30 * 24 * 3_600_000;
    const relevant = bets.filter((b) => {
      if (b.status === "OPEN") return false;
      if (b.closingPriceDecimal === undefined) return false;
      const t = b.settledAt ? new Date(b.settledAt).getTime() : 0;
      return t >= cutoff;
    });
    if (relevant.length === 0) return null;
    const values = relevant.map((b) => clvPct(b) ?? 0);
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    const positive = values.filter((v) => v > 0).length;
    return { avg, count: values.length, positive };
  }, [recentBetsQ.data]);

  const yieldSummary = useMemo(() => {
    const bets = (recentBetsQ.data ?? []).filter((b) => b.status !== "OPEN");
    if (bets.length === 0) return null;
    const totalStake = bets.reduce((s, b) => s + b.stakeMinor, 0);
    if (totalStake === 0) return null;
    const totalPnl = bets.reduce((s, b) => s + profitMinor(b), 0);
    return { pct: totalPnl / totalStake, count: bets.length };
  }, [recentBetsQ.data]);

  const equityPts = useEquityCurve(ledgerQ.data);

  const pnlMinor = useMemo(() => {
    if (balanceQ.data === undefined || !settingsQ.data) return null;
    return balanceQ.data - settingsQ.data.startingBankrollMinor;
  }, [balanceQ.data, settingsQ.data]);

  const fixtureError = fixtures.error as Error | undefined;
  const isLoadingFixtures = fixtures.isLoading;

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-8" style={{ background: "var(--zs-bg)" }}>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-1">
        <div className="kicker">
          {new Date().toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })}
          {" · "}window: today + 72h
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4 mt-1">
          <div>
            <h1 className="font-display text-[34px] leading-[1.05] text-fg">
              <span style={{ color: "var(--zs-fg)" }}>
                {fixtures.isLoading ? "…" : (fixtures.data?.length ?? 0)}
              </span>{" "}
              fixtures in window
              {bookCount > 0 && (
                <>, <span style={{ color: "var(--zs-fg)" }}>{bookCount}</span> {bookCount === 1 ? "book" : "books"} live</>
              )}
              . Pick a match to analyze.
            </h1>
            <p className="mt-1.5 text-[13px] text-fg-dim">
              OddsAPI quota untouched · analysis runs on demand
            </p>
          </div>
          <Button asChild size="sm" style={{ background: "var(--zs-info-fill)", borderColor: "color-mix(in oklch, var(--zs-info) 40%, transparent)", color: "var(--zs-info)" }} variant="outline">
            <Link to="/scanner">
              Open Scanner <ArrowRight className="ml-1.5 size-3.5" />
            </Link>
          </Button>
        </div>
      </header>

      {/* ── KPI row ──────────────────────────────────────────────── */}
      {persistent ? (
        settingsQ.data && balanceQ.data !== undefined && exposureQ.data !== undefined ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Bankroll"
              main={formatMoney(balanceQ.data, currency)}
              sub={pnlMinor !== null ? `${pnlMinor >= 0 ? "+" : ""}${formatMoney(pnlMinor, currency)} vs start` : undefined}
              tone={pnlMinor !== null ? (pnlMinor >= 0 ? "pos" : "neg") : undefined}
              spark={equityPts.map((p) => p.balanceMinor)}
            />
            <KpiCard
              label="Open exposure"
              main={formatMoney(exposureQ.data, currency)}
              sub={`${openBetsQ.data?.length ?? 0} open bets`}
              tone="info"
            />
            <KpiCard
              label="CLV · 30d"
              main={clvSummary ? `${clvSummary.avg >= 0 ? "+" : ""}${(clvSummary.avg * 100).toFixed(2)}%` : "—"}
              sub={clvSummary ? `${clvSummary.positive} of ${clvSummary.count} beat close` : "No settled data"}
              tone={clvSummary ? (clvSummary.avg >= 0 ? "pos" : "neg") : undefined}
            />
            <KpiCard
              label="Yield · 30d"
              main={yieldSummary ? `${yieldSummary.pct >= 0 ? "+" : ""}${(yieldSummary.pct * 100).toFixed(1)}%` : "—"}
              sub={yieldSummary ? `ROI · ${yieldSummary.count} settled` : "No settled data"}
              tone={yieldSummary ? (yieldSummary.pct >= 0 ? "pos" : "neg") : undefined}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        )
      ) : (
        <Alert>
          <AlertTitle>Limited mode</AlertTitle>
          <AlertDescription>
            Bankroll metrics live in SQLite — run via{" "}
            <code className="font-mono text-xs">npm run tauri:dev</code> to activate.
          </AlertDescription>
        </Alert>
      )}

      {/* ── Fixtures + side ──────────────────────────────────────── */}
      <div className="grid flex-1 gap-6 lg:grid-cols-3">
        {/* Fixtures */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-semibold text-fg">Upcoming fixtures</span>
            <span className="pill pill-ghost" style={{ height: 20, fontSize: 10 }}>today · +72h</span>
          </div>
          {fixtureError ? (
            <Alert variant="destructive">
              <AlertTitle>Catalog unavailable</AlertTitle>
              <AlertDescription>{fixtureError.message}</AlertDescription>
            </Alert>
          ) : isLoadingFixtures && upcoming.length === 0 ? (
            <div className="flex flex-col gap-1.5">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-11 w-full" />)}
            </div>
          ) : upcoming.length === 0 ? (
            <div className="rounded-md border border-dashed border-zs p-5 text-sm text-fg-muted">
              Nothing scheduled — enable leagues in Settings or try the Scanner.
            </div>
          ) : (
            <div className="flex flex-col">
              {upcoming.map((m) => <FixtureRow key={m.catalogId} match={m} />)}
            </div>
          )}
        </section>

        {/* Side panel */}
        <aside className="flex flex-col gap-5">
          {/* Open bets */}
          {persistent && (
            <SideBlock
              title="Open bets"
              badge={String(openBetsQ.data?.length ?? 0)}
              link="/bankroll"
            >
              {(openBetsQ.data ?? []).length === 0 ? (
                <p className="py-2 text-xs text-fg-muted">No open bets.</p>
              ) : (
                <div className="flex flex-col">
                  {(openBetsQ.data ?? []).slice(0, 4).map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between border-b border-zs py-2 text-[12px] last:border-0"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium capitalize text-fg">
                          {b.selection.side}
                          {b.selection.line !== undefined ? ` ${b.selection.line}` : ""}
                        </div>
                        <div className="truncate text-[11px] text-fg-muted">
                          {b.marketKey} · {b.book}
                        </div>
                      </div>
                      <div className="ml-3 shrink-0 text-right font-mono tabular-nums">
                        <div className="text-fg">{b.priceDecimal.toFixed(2)}</div>
                        {settingsQ.data && (
                          <div className="text-[11px] text-fg-muted">
                            {formatMoney(b.stakeMinor, currency)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SideBlock>
          )}

          {/* Equity sparkline */}
          {persistent && equityPts.length > 1 && (
            <SideBlock title="Equity · 30d" badge={null}>
              <EquitySparkline pts={equityPts.map((p) => p.balanceMinor)} />
              {ledgerQ.data && ledgerQ.data.length > 0 && (
                <div className="mt-1 flex justify-between font-mono text-[11px] text-fg-muted">
                  <span>{new Date(equityPts[0].t).toLocaleDateString()}</span>
                  <span>{new Date(equityPts[equityPts.length - 1].t).toLocaleDateString()}</span>
                </div>
              )}
            </SideBlock>
          )}

          {/* Recent activity */}
          {persistent && settingsQ.data && (
            <SideBlock title="Recent activity" badge={null}>
              {(recentBetsQ.data ?? []).filter((b) => b.status !== "OPEN").length === 0 ? (
                <p className="py-2 text-xs text-fg-muted">No settled bets yet.</p>
              ) : (
                <div className="flex flex-col">
                  {(recentBetsQ.data ?? [])
                    .filter((b) => b.status !== "OPEN")
                    .slice(0, 4)
                    .map((b) => {
                      const pnl = profitMinor(b);
                      return (
                        <div
                          key={b.id}
                          className="flex items-center justify-between border-b border-zs py-2 text-[12px] last:border-0"
                        >
                          <div className="min-w-0">
                            <div className="truncate capitalize text-fg">
                              {b.selection.side}
                              {b.selection.line !== undefined ? ` ${b.selection.line}` : ""}
                            </div>
                            <div className="truncate text-[11px] text-fg-muted">
                              {b.status} · {new Date(b.settledAt ?? b.placedAt).toLocaleDateString()}
                            </div>
                          </div>
                          <span
                            className="ml-3 font-mono tabular-nums text-[12px]"
                            style={{ color: pnl > 0 ? "var(--zs-pos)" : pnl < 0 ? "var(--zs-neg)" : "var(--zs-fg-muted)" }}
                          >
                            {formatSignedMoney(pnl, currency)}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </SideBlock>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ── KpiCard ────────────────────────────────────────────────────── */
function KpiCard({
  label,
  main,
  sub,
  tone,
  spark,
}: {
  label: string;
  main: string;
  sub?: string;
  tone?: "pos" | "neg" | "info" | "warn";
  spark?: number[];
}) {
  const toneColor =
    tone === "pos" ? "var(--zs-pos)"
    : tone === "neg" ? "var(--zs-neg)"
    : tone === "info" ? "var(--zs-info)"
    : tone === "warn" ? "var(--zs-warn)"
    : "var(--zs-fg-muted)";

  return (
    <div
      className="relative overflow-hidden rounded-lg border border-zs p-4"
      style={{ background: "var(--zs-bg-elev)" }}
    >
      <div className="kicker mb-1">{label}</div>
      <div className="flex items-end gap-2">
        <span className="font-mono text-2xl font-semibold tabular-nums text-fg">{main}</span>
        {spark && spark.length > 2 && (
          <MiniSpark pts={spark} className="mb-0.5 ml-auto" />
        )}
      </div>
      {sub && (
        <div className="mt-1 font-mono text-[11px] tabular-nums" style={{ color: toneColor }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function MiniSpark({ pts, className }: { pts: number[]; className?: string }) {
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const W = 60, H = 22;
  const points = pts
    .map((p, i) => `${(i / (pts.length - 1)) * W},${H - ((p - min) / range) * (H - 2) - 1}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className={className}>
      <polyline
        points={points}
        fill="none"
        stroke="var(--zs-pos)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── FixtureRow ─────────────────────────────────────────────────── */
function FixtureRow({ match }: { match: CatalogMatch }) {
  const league = findLeagueById(String(match.leagueId));
  const leagueName = league?.name ?? match.leagueName ?? String(match.leagueId);
  const kickoff = new Date(match.kickoffAt);
  const timeStr = kickoff.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return (
    <Link
      to={`/match/${match.catalogId}`}
      className="group grid items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-zs-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ gridTemplateColumns: "54px 1fr auto" }}
    >
      <span className="font-mono text-[13px] tabular-nums text-fg">{timeStr}</span>
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium text-fg">
          {match.home.name}{" "}
          <span className="text-fg-muted mx-1.5">vs</span>
          {match.away.name}
        </div>
        <div className="kicker mt-0.5">{leagueName}</div>
      </div>
      <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-muted transition-colors group-hover:text-info">
        analyze →
      </span>
    </Link>
  );
}

/* ── SideBlock ──────────────────────────────────────────────────── */
function SideBlock({
  title,
  badge,
  link,
  children,
}: {
  title: string;
  badge: string | null;
  link?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-fg">{title}</span>
        {badge !== null && (
          <span className="pill pill-ghost" style={{ height: 18, fontSize: 10 }}>
            {badge}
          </span>
        )}
        {link && (
          <Link
            to={link}
            className="font-mono text-[10px] uppercase tracking-wider text-fg-muted hover:text-info"
          >
            View all
          </Link>
        )}
      </div>
      <div className="rounded-lg border border-zs px-3 py-1" style={{ background: "var(--zs-bg-elev)" }}>
        {children}
      </div>
    </div>
  );
}

/* ── EquitySparkline ────────────────────────────────────────────── */
function EquitySparkline({ pts }: { pts: number[] }) {
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const W = 300, H = 56;
  const xs = pts.map((_, i) => (i / (pts.length - 1)) * W);
  const ys = pts.map((p) => H - ((p - min) / range) * H);
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x} ${ys[i]}`).join(" ");
  const fillPath = `${path} L ${W} ${H} L 0 ${H} Z`;
  const rising = pts[pts.length - 1] >= pts[0];
  const stroke = rising ? "var(--zs-pos)" : "var(--zs-neg)";
  const fill = rising ? "var(--zs-pos-fill)" : "var(--zs-neg-fill)";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" className="mt-1">
      <path d={fillPath} fill={fill} />
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" />
    </svg>
  );
}
