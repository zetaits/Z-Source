import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Block, ScreenHeader, Stat, Sparkline, EquityChart, FlagChip, Tag } from "@/components/zs";
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
import { useFixturesWindow } from "@/features/fixtures/useFixturesWindow";
import { isPersistentStorage } from "@/storage";
import { formatMoney, formatSignedMoney } from "@/lib/money";
import { formatRelativeShort } from "@/lib/time";

export function CommandCenter() {
  const persistent = isPersistentStorage();
  const fixtures = useFixturesWindow();
  const settingsQ = useBankrollSettings();
  const balanceQ = useCurrentBalance();
  const exposureQ = useOpenExposure();
  const openBetsQ = useBets({ status: "OPEN", limit: 20 });
  const recentBetsQ = useBets({ limit: 200 });
  const ledgerQ = useLedger(120);

  const upcoming = useMemo<CatalogMatch[]>(() => {
    const now = Date.now();
    return fixtures.data
      .filter((m) => new Date(m.kickoffAt).getTime() >= now - 3 * 3_600_000)
      .filter((m) => m.status !== "FT" && m.status !== "CANCELLED")
      .slice(0, 12);
  }, [fixtures.data]);

  const nextMatch = useMemo(() => {
    const now = Date.now();
    return upcoming.find((m) => new Date(m.kickoffAt).getTime() >= now) ?? null;
  }, [upcoming]);

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
  const equityValues = useMemo(() => equityPts.map((p) => p.balanceMinor), [equityPts]);

  const pnlMinor = useMemo(() => {
    if (balanceQ.data === undefined || !settingsQ.data) return null;
    return balanceQ.data - settingsQ.data.startingBankrollMinor;
  }, [balanceQ.data, settingsQ.data]);

  const today = new Date();
  const dayLabel = today
    .toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })
    .toUpperCase();
  const armedCount = upcoming.filter((m) => m.status !== "FT").length;
  const nextWhistleTxt = nextMatch ? formatRelativeShort(nextMatch.kickoffAt) : "—";

  const sub = `${armedCount} fixture${armedCount === 1 ? "" : "s"} in window · next whistle ${nextWhistleTxt}${
    recentBetsQ.data ? ` · ${recentBetsQ.data.filter((b) => b.status !== "OPEN").length} settled` : ""
  } · live sync 5s ago`;

  return (
    <div style={{ padding: "28px 32px 48px" }}>
      <ScreenHeader
        bracket={`COMMAND · ${dayLabel} · WINDOW NOW+72H`}
        title="EDGE FLOOR"
        sub={sub}
        right={
          <>
            <Link to="/strategy" className="zs-btn ghost" style={{ textDecoration: "none" }}>
              ◆ STRATEGY
            </Link>
            <Link to="/scanner" className="zs-btn primary" style={{ textDecoration: "none" }}>
              OPEN SCANNER →
            </Link>
          </>
        }
      />

      {/* HERO — NEXT WHISTLE */}
      {nextMatch && <NextWhistleHero match={nextMatch} />}

      {/* KPI ROW */}
      {persistent && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 22 }}>
          <Stat
            caption="BANKROLL"
            value={balanceQ.data !== undefined ? formatMoney(balanceQ.data, currency) : "—"}
            sub={pnlMinor !== null ? `${pnlMinor >= 0 ? "+" : ""}${formatMoney(pnlMinor, currency)} vs start` : "No baseline"}
            tone={pnlMinor !== null ? (pnlMinor >= 0 ? "pos" : "neg") : "fg"}
            right={
              equityValues.length > 1 ? (
                <Sparkline points={equityValues} w={80} h={22} color="var(--zs-pos)" />
              ) : undefined
            }
          />
          <Stat
            caption="OPEN EXPOSURE"
            value={exposureQ.data !== undefined ? formatMoney(exposureQ.data, currency) : "—"}
            sub={`${openBetsQ.data?.length ?? 0} open bet${(openBetsQ.data?.length ?? 0) === 1 ? "" : "s"}`}
            tone="fg"
          />
          <Stat
            caption="CLV · 30D"
            value={clvSummary ? `${clvSummary.avg >= 0 ? "+" : ""}${(clvSummary.avg * 100).toFixed(2)}%` : "—"}
            sub={clvSummary ? `${clvSummary.positive} of ${clvSummary.count} beat close` : "No settled data"}
            tone={clvSummary ? (clvSummary.avg >= 0 ? "pos" : "neg") : "fg"}
          />
          <Stat
            caption="YIELD · 30D"
            value={yieldSummary ? `${yieldSummary.pct >= 0 ? "+" : ""}${(yieldSummary.pct * 100).toFixed(1)}%` : "—"}
            sub={yieldSummary ? `${yieldSummary.count} settled` : "No settled data"}
            tone={yieldSummary ? (yieldSummary.pct >= 0 ? "pos" : "neg") : "fg"}
          />
        </div>
      )}

      {/* TWO COL: fixtures + side */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <Block
          head={
            <>
              UPCOMING · WINDOW NOW+72H <Tag tone="amber">{upcoming.length}</Tag>
            </>
          }
          headRight={
            <Link to="/scanner" className="zs-btn sm ghost" style={{ textDecoration: "none" }}>
              ALL →
            </Link>
          }
          pad={false}
        >
          {fixtures.isLoading && upcoming.length === 0 ? (
            <FixturesLoading />
          ) : fixtures.isError ? (
            <ErrorRow message={(fixtures.error as Error)?.message ?? "Catalog unavailable"} />
          ) : upcoming.length === 0 ? (
            <EmptyRow text="Nothing scheduled — enable leagues in Settings or open the Scanner." />
          ) : (
            <UpcomingTable matches={upcoming} />
          )}
        </Block>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {persistent && (
            <Block head="OPEN BETS" headRight={<Tag>{openBetsQ.data?.length ?? 0}</Tag>}>
              {(openBetsQ.data ?? []).length === 0 ? (
                <EmptyTicket />
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {(openBetsQ.data ?? []).slice(0, 5).map((b) => (
                    <div
                      key={b.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 10,
                        padding: "8px 0",
                        borderBottom: "1px solid var(--zs-rule)",
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: "var(--zs-fg)", textTransform: "capitalize" }}>
                          {b.selection.side}
                          {b.selection.line !== undefined ? ` ${b.selection.line}` : ""}
                        </div>
                        <div style={{ color: "var(--zs-fg-muted)", fontSize: 9, marginTop: 1 }}>
                          {b.marketKey} · {b.book}
                        </div>
                      </div>
                      <div
                        className="tabnum"
                        style={{ textAlign: "right", color: "var(--zs-fg)" }}
                      >
                        <div>{b.priceDecimal.toFixed(2)}</div>
                        <div style={{ color: "var(--zs-fg-muted)", fontSize: 9 }}>
                          {formatMoney(b.stakeMinor, currency)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Block>
          )}

          {persistent && equityValues.length > 1 && (
            <Block
              head="EQUITY · 30D"
              headRight={
                pnlMinor !== null ? (
                  <Tag tone={pnlMinor >= 0 ? "pos" : "neg"}>
                    {formatSignedMoney(pnlMinor, currency)}
                  </Tag>
                ) : undefined
              }
              pad={false}
            >
              <div style={{ padding: "12px 14px 6px" }}>
                <EquityChart points={equityValues} height={140} formatLabel={(v) => formatMoney(v, currency)} />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 14px 12px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  color: "var(--zs-fg-muted)",
                  letterSpacing: "0.08em",
                }}
              >
                <span>{new Date(equityPts[0].t).toLocaleDateString()}</span>
                <span>{new Date(equityPts[equityPts.length - 1].t).toLocaleDateString()}</span>
              </div>
            </Block>
          )}

          {persistent && (recentBetsQ.data ?? []).some((b) => b.status !== "OPEN") && (
            <Block
              head="RECENT · 5"
              headRight={
                <Link to="/bankroll" className="zs-btn sm ghost" style={{ textDecoration: "none" }}>
                  ALL →
                </Link>
              }
              pad={false}
            >
              {(recentBetsQ.data ?? [])
                .filter((b) => b.status !== "OPEN")
                .slice(0, 5)
                .map((b, i, arr) => {
                  const pnl = profitMinor(b);
                  return (
                    <div
                      key={b.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto auto",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 14px",
                        borderBottom: i < arr.length - 1 ? "1px solid var(--zs-rule)" : "none",
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: "var(--zs-fg)", textTransform: "capitalize" }}>
                          {b.selection.side}
                          {b.selection.line !== undefined ? ` ${b.selection.line}` : ""}
                        </div>
                        <div style={{ color: "var(--zs-fg-muted)", fontSize: 9, marginTop: 1 }}>
                          {b.status} · {new Date(b.settledAt ?? b.placedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <Tag tone={b.status === "WON" ? "pos" : b.status === "LOST" ? "neg" : "default"}>
                        {b.status}
                      </Tag>
                      <div
                        className="tabnum"
                        style={{
                          color: pnl > 0 ? "var(--zs-pos)" : pnl < 0 ? "var(--zs-neg)" : "var(--zs-fg-muted)",
                          fontWeight: 600,
                          minWidth: 70,
                          textAlign: "right",
                        }}
                      >
                        {formatSignedMoney(pnl, currency)}
                      </div>
                    </div>
                  );
                })}
            </Block>
          )}
        </div>
      </div>
    </div>
  );
}

function NextWhistleHero({ match }: { match: CatalogMatch }) {
  const league = findLeagueById(String(match.leagueId));
  const kickoff = new Date(match.kickoffAt);
  const timeStr = kickoff.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const dayStr = kickoff
    .toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })
    .toUpperCase();
  const relative = formatRelativeShort(match.kickoffAt);
  const homeShort = match.home.name.split(" ").slice(-1)[0].toUpperCase();
  const awayShort = match.away.name.split(" ").slice(-1)[0].toUpperCase();
  const leagueName = league?.name ?? match.leagueName;
  const cc = league?.countryCode ?? match.countryCode ?? "—";

  return (
    <div className="zs-block" style={{ padding: 0, marginBottom: 22 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "stretch" }}>
        <div style={{ padding: "20px 28px", borderRight: "1px solid var(--zs-border)" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--zs-accent)",
              letterSpacing: "0.20em",
              marginBottom: 14,
            }}
          >
            ┏━ NEXT WHISTLE · IN {relative}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginBottom: 14, flexWrap: "wrap" }}>
            <span className="zs-bignum" style={{ fontSize: 56 }}>
              {homeShort}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 22,
                color: "var(--zs-fg-muted)",
                letterSpacing: "0.06em",
              }}
            >
              vs
            </span>
            <span className="zs-bignum" style={{ fontSize: 56, color: "var(--zs-fg-dim)" }}>
              {awayShort}
            </span>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--zs-fg-dim)", marginBottom: 4 }}>
            {match.home.name} <span style={{ color: "var(--zs-fg-muted)" }}>vs</span> {match.away.name}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--zs-fg-muted)",
              letterSpacing: "0.10em",
            }}
          >
            <FlagChip cc={cc} /> {leagueName.toUpperCase()} · {dayStr} · KICKOFF {timeStr}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minWidth: 320 }}>
          <HeroCell k="KICKOFF" v={timeStr} sub={relative.toUpperCase()} tone="fg" />
          <HeroCell k="WINDOW" v={dayStr} sub={`IN ${relative.toUpperCase()}`} tone="amber" />
        </div>
      </div>
      <div className="zs-block-head" style={{ borderTop: "1px solid var(--zs-border)", borderBottom: "none" }}>
        <div className="l">
          ▸ {match.home.name.toUpperCase()} · {match.away.name.toUpperCase()}
        </div>
        <div className="r">
          <Link
            to={`/match/${match.catalogId}`}
            className="zs-btn sm primary"
            style={{ textDecoration: "none" }}
          >
            ANALYSE →
          </Link>
        </div>
      </div>
    </div>
  );
}

function HeroCell({ k, v, sub, tone }: { k: string; v: string; sub: string; tone: "fg" | "amber" | "pos" }) {
  const cls = tone === "amber" ? "amber" : tone === "pos" ? "pos" : "";
  return (
    <div
      style={{
        padding: "20px 22px",
        borderLeft: "1px solid var(--zs-border)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div className="zs-caption">{k}</div>
      <div className={`zs-bignum ${cls}`} style={{ fontSize: 32, margin: "14px 0 8px" }}>
        {v}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--zs-fg-muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {sub}
      </div>
    </div>
  );
}

function UpcomingTable({ matches }: { matches: CatalogMatch[] }) {
  return (
    <table className="zs-table">
      <thead>
        <tr>
          <th style={{ width: 56 }}>WHEN</th>
          <th>FIXTURE</th>
          <th style={{ width: 140 }}>LEAGUE</th>
          <th style={{ width: 64 }} />
        </tr>
      </thead>
      <tbody>
        {matches.map((m) => {
          const league = findLeagueById(String(m.leagueId));
          const t = new Date(m.kickoffAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
          const dayShort = new Date(m.kickoffAt)
            .toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })
            .toUpperCase();
          return (
            <tr key={m.catalogId}>
              <td className="row-key tabnum">{t}</td>
              <td>
                <div style={{ color: "var(--zs-fg)" }}>
                  <strong style={{ fontWeight: 600 }}>{m.home.name}</strong>
                  <span style={{ color: "var(--zs-fg-muted)", margin: "0 6px" }}>vs</span>
                  <strong style={{ fontWeight: 600 }}>{m.away.name}</strong>
                </div>
                <div style={{ color: "var(--zs-fg-muted)", fontSize: 10, marginTop: 2 }}>{dayShort}</div>
              </td>
              <td className="muted">
                <FlagChip cc={league?.countryCode ?? m.countryCode} />{" "}
                <span style={{ marginLeft: 4 }}>{league?.name ?? m.leagueName}</span>
              </td>
              <td>
                <Link
                  to={`/match/${m.catalogId}`}
                  className="zs-btn sm ghost"
                  style={{ height: 22, padding: "0 8px", textDecoration: "none" }}
                >
                  →
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function FixturesLoading() {
  return (
    <div style={{ padding: 20 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="shimmer"
          style={{
            height: 36,
            marginBottom: 6,
            borderTop: "1px solid var(--zs-rule)",
            borderBottom: "1px solid var(--zs-rule)",
          }}
        />
      ))}
    </div>
  );
}

function ErrorRow({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: 18,
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        color: "var(--zs-neg)",
        letterSpacing: "0.04em",
      }}
    >
      × CATALOG UNAVAILABLE — {message}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: "26px 18px",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        color: "var(--zs-fg-muted)",
        letterSpacing: "0.04em",
        textAlign: "center",
      }}
    >
      {text}
    </div>
  );
}

function EmptyTicket() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: "18px 0",
        color: "var(--zs-fg-muted)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: "0.06em",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 22, color: "var(--zs-fg-faint)" }}>—</div>
      <div>NO ACTIVE TICKETS</div>
      <div style={{ fontSize: 9, color: "var(--zs-fg-faint)" }}>BANKROLL FULL · DEPLOY ON BONDED PLAYS</div>
    </div>
  );
}
