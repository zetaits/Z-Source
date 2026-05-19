import { useMemo } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Block, CalibrationChart, ScreenHeader, Stat, Tag, Verdict } from "@/components/zs";
import type { CalibrationBin as RepoCalibrationBin } from "@/storage/repos/pickOutcomesRepo";
import {
  useMetricsCalibration,
  useMetricsList,
  useMetricsSummary,
} from "@/features/metrics/hooks/useMetrics";
import { isPersistentStorage } from "@/storage";

export function Metrics() {
  const persistent = isPersistentStorage();
  const summary = useMetricsSummary();
  const calibration = useMetricsCalibration(10);
  const list = useMetricsList(1000);

  const outcomes = useMemo(() => list.data ?? [], [list.data]);

  const kpis = useMemo(() => {
    const settled = outcomes.filter((o) => ["WIN", "LOSS", "PUSH"].includes(o.outcome));
    const decisive = settled.filter((o) => o.outcome !== "PUSH");
    const wins = decisive.filter((o) => o.outcome === "WIN").length;
    const hit = decisive.length > 0 ? wins / decisive.length : null;
    const sumStake = settled.reduce((s, o) => s + o.stakeUnits, 0);
    const sumPayout = settled.reduce((s, o) => s + (o.payoutUnits ?? 0), 0);
    const roi = sumStake > 0 ? (sumPayout - sumStake) / sumStake : null;
    const settledWithProb = settled.filter((o) => ["WIN", "LOSS"].includes(o.outcome));
    const brier = settledWithProb.length > 0
      ? settledWithProb.reduce((s, o) => {
          const actual = o.outcome === "WIN" ? 1 : 0;
          return s + Math.pow(o.fairProb - actual, 2);
        }, 0) / settledWithProb.length
      : null;
    return {
      total: outcomes.length,
      settled: settled.length,
      wins,
      losses: decisive.length - wins,
      hit,
      roi,
      brier,
    };
  }, [outcomes]);

  const quartiles = useMemo(() => {
    const settled = outcomes.filter((o) =>
      ["WIN", "LOSS", "PUSH"].includes(o.outcome),
    );
    const buckets = [
      { q: "Q1", lo: 0, hi: 0.01, label: "0–1%" },
      { q: "Q2", lo: 0.01, hi: 0.02, label: "1–2%" },
      { q: "Q3", lo: 0.02, hi: 0.03, label: "2–3%" },
      { q: "Q4", lo: 0.03, hi: Number.POSITIVE_INFINITY, label: "3%+" },
    ];
    return buckets.map((b) => {
      const inBucket = settled.filter((o) => o.edgePct >= b.lo && o.edgePct < b.hi);
      const wins = inBucket.filter((o) => o.outcome === "WIN").length;
      const stake = inBucket.reduce((s, o) => s + o.stakeUnits, 0);
      const payout = inBucket.reduce((s, o) => s + (o.payoutUnits ?? 0), 0);
      return {
        ...b,
        n: inBucket.length,
        hit: wins,
        roi: stake > 0 ? ((payout - stake) / stake) * 100 : null,
      };
    });
  }, [outcomes]);

  if (!persistent) {
    return (
      <div style={{ padding: "28px 32px 48px" }}>
        <ScreenHeader bracket="METRICS · DESKTOP REQUIRED" title="CALIBRATION" sub="Run via Tauri" />
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>Desktop required</AlertTitle>
          <AlertDescription>
            Metrics live in local SQLite. Run via <code className="font-mono text-xs">npm run tauri:dev</code> to view them.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const loading = summary.isLoading || calibration.isLoading || list.isLoading;

  return (
    <div style={{ padding: "28px 32px 48px" }}>
      <ScreenHeader
        bracket={`METRICS · CALIBRATION · ${kpis.settled} SETTLED`}
        title="CALIBRATION"
        sub="Predicted vs realised hit rate · auto-mirrored from useLogBet / useSettleBet"
      />

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 22 }}>
            <Stat caption="SETTLED" value={String(kpis.settled)} sub={`${kpis.wins} W · ${kpis.losses} L`} />
            <Stat
              caption="WIN RATE"
              value={kpis.hit !== null ? `${(kpis.hit * 100).toFixed(1)}%` : "—"}
              tone={kpis.hit !== null && kpis.hit > 0.5 ? "pos" : "fg"}
              sub={`of ${kpis.wins + kpis.losses} decisive`}
            />
            <Stat
              caption="ROI"
              value={kpis.roi !== null ? `${kpis.roi >= 0 ? "+" : ""}${(kpis.roi * 100).toFixed(2)}%` : "—"}
              tone={kpis.roi !== null ? (kpis.roi >= 0 ? "pos" : "neg") : "fg"}
              sub="fractional Kelly"
            />
            <Stat
              caption="TOTAL PICKS"
              value={String(kpis.total)}
              sub={kpis.total > 0 ? `${Math.round((kpis.settled / kpis.total) * 100)}% SETTLED` : "—"}
            />
            <Stat
              caption="BRIER"
              value={kpis.brier !== null ? kpis.brier.toFixed(3) : "—"}
              tone="amber"
              sub="LOWER = BETTER"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 18, marginBottom: 22 }}>
            <Block
              head="CALIBRATION · PRED vs REAL"
              headRight={<Tag tone="amber">{(calibration.data ?? []).filter((b) => b.n > 0).length} BUCKETS</Tag>}
              pad={false}
            >
              <div style={{ padding: "12px 14px 8px" }}>
                <CalibrationChart
                  data={(calibration.data ?? [])
                    .filter((b) => b.n > 0)
                    .map((b: RepoCalibrationBin) => ({
                      pred: b.predictedAvg,
                      real: b.realisedRate,
                      n: b.n,
                    }))}
                  height={280}
                />
              </div>
              <div
                style={{
                  padding: "10px 16px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--zs-fg-muted)",
                  letterSpacing: "0.06em",
                  borderTop: "1px solid var(--zs-rule)",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <span>━ ━ IDENTITY · PERFECT CALIBRATION</span>
                <span style={{ color: "var(--zs-pos)" }}>● within ±4pp</span>
                <span style={{ color: "var(--zs-accent)" }}>● drift &gt;4pp</span>
              </div>
            </Block>

            <Block head="BREAKDOWN · MARKET × VERDICT" pad={false}>
              <table className="zs-table">
                <thead>
                  <tr>
                    <th>MARKET</th>
                    <th>VERDICT</th>
                    <th style={{ textAlign: "right" }}>N</th>
                    <th style={{ textAlign: "right" }}>HIT</th>
                    <th>HIT%</th>
                    <th style={{ textAlign: "right" }}>ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary.data ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="muted" style={{ textAlign: "center", padding: 28 }}>
                        NO SETTLED PICKS YET
                      </td>
                    </tr>
                  ) : (
                    (summary.data ?? []).map((m, i) => (
                      <tr key={`${m.verdict}-${m.marketKey}-${i}`}>
                        <td className="row-key">{m.marketKey}</td>
                        <td>
                          <Verdict v={m.verdict} />
                        </td>
                        <td className="num">{m.total}</td>
                        <td className="num">{m.wins}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div className="zs-bar" style={{ flex: 1, minWidth: 50 }}>
                              <span
                                style={{
                                  width: `${m.hitRate * 100}%`,
                                  background: m.hitRate >= 0.55 ? "var(--zs-pos)" : "var(--zs-accent)",
                                }}
                              />
                            </div>
                            <span className="tabnum" style={{ minWidth: 36, textAlign: "right", color: "var(--zs-fg)" }}>
                              {Math.round(m.hitRate * 100)}%
                            </span>
                          </div>
                        </td>
                        <td
                          className="num tabnum"
                          style={{ color: m.roi >= 0 ? "var(--zs-pos)" : "var(--zs-neg)", fontWeight: 700 }}
                        >
                          {m.roi >= 0 ? "+" : ""}
                          {(m.roi * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Block>
          </div>

          <Block head="QUARTILES · BY EDGE BUCKET">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
              {quartiles.map((q) => (
                <div key={q.q} style={{ borderLeft: "2px solid var(--zs-accent)", paddingLeft: 14 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      color: "var(--zs-accent)",
                      letterSpacing: "0.16em",
                      marginBottom: 6,
                    }}
                  >
                    {q.q} · EDGE {q.label}
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 28, color: "var(--zs-fg)" }}>
                      {q.hit}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--zs-fg-muted)" }}>
                      / {q.n} hit
                    </span>
                  </div>
                  <div
                    className="tabnum"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: q.roi === null
                        ? "var(--zs-fg-muted)"
                        : q.roi >= 0
                          ? "var(--zs-pos)"
                          : "var(--zs-neg)",
                      fontWeight: 700,
                    }}
                  >
                    ROI {q.roi === null ? "—" : `${q.roi >= 0 ? "+" : ""}${q.roi.toFixed(1)}%`}
                  </div>
                </div>
              ))}
            </div>
          </Block>
        </>
      )}
    </div>
  );
}
