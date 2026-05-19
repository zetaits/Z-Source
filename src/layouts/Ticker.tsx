import { useMemo } from "react";
import { useFixturesWindow } from "@/features/fixtures/useFixturesWindow";
import {
  useBankrollSettings,
  useCurrentBalance,
} from "@/features/bankroll/hooks/useBankroll";
import { useOpenExposure, useBets } from "@/features/bankroll/hooks/useBets";
import { formatMoney } from "@/lib/money";
import { clvPct, profitMinor } from "@/domain/bet";

interface TickerItem {
  k: string;
  v: string;
  tone: "pos" | "neg" | "muted" | "fg";
}

export function Ticker() {
  const fixtures = useFixturesWindow();
  const balanceQ = useCurrentBalance();
  const exposureQ = useOpenExposure();
  const settingsQ = useBankrollSettings();
  const recentQ = useBets({ limit: 200 });

  const items = useMemo<TickerItem[]>(() => {
    const currency = settingsQ.data?.currency ?? "USD";
    const out: TickerItem[] = [];

    const nextFew = fixtures.data
      .filter((m) => new Date(m.kickoffAt).getTime() >= Date.now() - 5 * 60_000)
      .slice(0, 5);
    for (const m of nextFew) {
      const home = m.home.name.split(" ").pop()!.slice(0, 3).toUpperCase();
      const away = m.away.name.split(" ").pop()!.slice(0, 3).toUpperCase();
      const t = new Date(m.kickoffAt).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
      out.push({ k: `${home}·${away}`, v: t, tone: "fg" });
    }

    if (balanceQ.data !== undefined) {
      out.push({ k: "BANKROLL", v: formatMoney(balanceQ.data, currency), tone: "fg" });
    }
    if (exposureQ.data !== undefined) {
      out.push({
        k: "EXPOSURE",
        v: formatMoney(exposureQ.data, currency),
        tone: exposureQ.data > 0 ? "fg" : "muted",
      });
    }

    const bets = recentQ.data ?? [];
    const settled = bets.filter((b) => b.status !== "OPEN");
    if (settled.length > 0) {
      const totalStake = settled.reduce((s, b) => s + b.stakeMinor, 0);
      if (totalStake > 0) {
        const roi = settled.reduce((s, b) => s + profitMinor(b), 0) / totalStake;
        out.push({
          k: "ROI",
          v: `${roi >= 0 ? "+" : ""}${(roi * 100).toFixed(2)}%`,
          tone: roi >= 0 ? "pos" : "neg",
        });
      }
      const relevant = settled.filter((b) => b.closingPriceDecimal !== undefined);
      if (relevant.length > 0) {
        const clv = relevant.reduce((s, b) => s + (clvPct(b) ?? 0), 0) / relevant.length;
        out.push({
          k: "CLV·30D",
          v: `${clv >= 0 ? "+" : ""}${(clv * 100).toFixed(2)}%`,
          tone: clv >= 0 ? "pos" : "neg",
        });
      }
    }

    if (out.length === 0) {
      out.push({ k: "SYNC", v: "STANDING BY", tone: "muted" });
    }
    return out;
  }, [
    fixtures.data,
    balanceQ.data,
    exposureQ.data,
    settingsQ.data,
    recentQ.data,
  ]);

  return (
    <div
      style={{
        height: 28,
        flex: "0 0 28px",
        borderBottom: "1px solid var(--zs-border)",
        background: "var(--zs-bg-elev)",
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          flex: "0 0 auto",
          padding: "0 14px",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--zs-accent)",
          color: "var(--zs-bg)",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.14em",
          zIndex: 1,
        }}
      >
        EDGE FEED ▸
      </div>
      <div style={{ overflow: "hidden", flex: 1 }}>
        <div className="zs-ticker" style={{ padding: "0 24px" }}>
          {[...items, ...items].map((t, i) => (
            <span
              key={i}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.04em",
              }}
            >
              <span style={{ color: "var(--zs-fg-muted)" }}>{t.k}</span>
              <span
                className="tabnum"
                style={{
                  color:
                    t.tone === "pos"
                      ? "var(--zs-pos)"
                      : t.tone === "neg"
                        ? "var(--zs-neg)"
                        : t.tone === "fg"
                          ? "var(--zs-fg)"
                          : "var(--zs-fg-dim)",
                  fontWeight: 600,
                }}
              >
                {t.v}
              </span>
              <span style={{ color: "var(--zs-fg-faint)" }}>·</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
