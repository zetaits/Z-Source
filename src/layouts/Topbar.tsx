import { useEffect, useMemo, useState } from "react";
import { clvPct, profitMinor } from "@/domain/bet";
import { formatMoney } from "@/lib/money";
import {
  useBankrollSettings,
  useCurrentBalance,
} from "@/features/bankroll/hooks/useBankroll";
import { useBets, useOpenExposure } from "@/features/bankroll/hooks/useBets";
import { ThemeMenu } from "@/features/tweaks/ThemeMenu";
import { isPersistentStorage } from "@/storage";

interface Props {
  onOpenPalette?(): void;
}

const isMac =
  typeof navigator !== "undefined" &&
  /mac|iphone|ipad|ipod/i.test(navigator.platform ?? "");

export function Topbar({ onOpenPalette }: Props) {
  const persistent = isPersistentStorage();
  const balanceQ = useCurrentBalance();
  const exposureQ = useOpenExposure();
  const settingsQ = useBankrollSettings();
  const recentQ = useBets({ limit: 200 });

  const clock = useClock();

  const currency = settingsQ.data?.currency ?? "USD";

  const clvAvg = useMemo(() => {
    const bets = recentQ.data ?? [];
    const cutoff = Date.now() - 30 * 24 * 3_600_000;
    const relevant = bets.filter((b) => {
      if (b.status === "OPEN") return false;
      if (b.closingPriceDecimal === undefined) return false;
      const t = b.settledAt ? new Date(b.settledAt).getTime() : 0;
      return t >= cutoff;
    });
    if (relevant.length === 0) return null;
    return relevant.reduce((s, b) => s + (clvPct(b) ?? 0), 0) / relevant.length;
  }, [recentQ.data]);

  const roi30d = useMemo(() => {
    const bets = (recentQ.data ?? []).filter((b) => b.status !== "OPEN");
    if (bets.length === 0) return null;
    const totalStake = bets.reduce((s, b) => s + b.stakeMinor, 0);
    if (totalStake === 0) return null;
    const totalPnl = bets.reduce((s, b) => s + profitMinor(b), 0);
    return totalPnl / totalStake;
  }, [recentQ.data]);

  return (
    <header
      style={{
        height: 46,
        flex: "0 0 46px",
        borderBottom: "1px solid var(--zs-border)",
        display: "flex",
        alignItems: "stretch",
        background: "var(--zs-bg)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "0 18px",
          borderRight: "1px solid var(--zs-border)",
          minWidth: 200,
        }}
      >
        <span className="zs-pulse" style={{ width: 7, height: 7, background: "var(--zs-pos)" }} aria-hidden />
        <span
          className="tabnum"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--zs-fg)",
            letterSpacing: "0.04em",
          }}
        >
          {clock}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--zs-fg-muted)",
            letterSpacing: "0.10em",
          }}
        >
          SYNC 5s
        </span>
      </div>

      <button
        type="button"
        onClick={onOpenPalette}
        aria-label="Open command palette"
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "0 18px",
          background: "transparent",
          border: "none",
          borderRight: "1px solid var(--zs-border)",
          color: "var(--zs-fg-muted)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ color: "var(--zs-accent)", fontWeight: 700 }}>{">>"}</span>
        <span>search fixtures, rules, markets…</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <span className="zs-kbd">{isMac ? "⌘" : "Ctrl"}</span>
          <span className="zs-kbd">K</span>
        </span>
      </button>

      {persistent ? (
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <KpiCell
            label="BANKROLL"
            value={balanceQ.data !== undefined ? formatMoney(balanceQ.data, currency) : "—"}
            tone="fg"
          />
          <KpiCell
            label="EXPOSURE"
            value={exposureQ.data !== undefined ? formatMoney(exposureQ.data, currency) : "€0.00"}
            tone={(exposureQ.data ?? 0) > 0 ? "info" : "muted"}
          />
          <KpiCell
            label="CLV·30D"
            value={clvAvg === null ? "—" : `${clvAvg >= 0 ? "+" : ""}${(clvAvg * 100).toFixed(2)}%`}
            tone={clvAvg === null ? "muted" : clvAvg >= 0 ? "pos" : "neg"}
          />
          <KpiCell
            label="ROI"
            value={roi30d === null ? "—" : `${roi30d >= 0 ? "+" : ""}${(roi30d * 100).toFixed(2)}%`}
            tone={roi30d === null ? "muted" : roi30d >= 0 ? "pos" : "neg"}
          />
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0 18px",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--zs-fg-muted)",
            letterSpacing: "0.10em",
          }}
        >
          LIMITED MODE · RUN VIA TAURI
        </div>
      )}

      <ThemeMenu />
    </header>
  );
}

type Tone = "fg" | "pos" | "neg" | "info" | "muted";

function KpiCell({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  const color =
    tone === "pos" ? "var(--zs-pos)" :
    tone === "neg" ? "var(--zs-neg)" :
    tone === "info" ? "var(--zs-info)" :
    tone === "muted" ? "var(--zs-fg-muted)" : "var(--zs-fg)";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 2,
        padding: "0 18px",
        borderRight: "1px solid var(--zs-border)",
        minWidth: 110,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "var(--zs-fg-muted)",
          letterSpacing: "0.16em",
        }}
      >
        {label}
      </div>
      <div
        className="tabnum"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 14,
          color,
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now.toLocaleTimeString("en-GB", { hour12: false });
}
