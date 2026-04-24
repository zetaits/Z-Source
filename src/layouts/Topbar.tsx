import { useEffect, useMemo, useState } from "react";
import { Command, Search } from "lucide-react";
import { clvPct } from "@/domain/bet";
import { formatMoney } from "@/lib/money";
import {
  useBankrollSettings,
  useCurrentBalance,
} from "@/features/bankroll/hooks/useBankroll";
import { useBets, useOpenExposure } from "@/features/bankroll/hooks/useBets";
import { isPersistentStorage } from "@/storage";
import { cn } from "@/lib/utils";

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
  const recentQ = useBets({ limit: 100 });
  const syncLabel = useSyncTick();

  const currency = settingsQ.data?.currency ?? "USD";

  const clvText = useMemo(() => {
    const bets = recentQ.data ?? [];
    const cutoff = Date.now() - 30 * 24 * 3_600_000;
    const relevant = bets.filter((b) => {
      if (b.status === "OPEN") return false;
      if (b.closingPriceDecimal === undefined) return false;
      const t = b.settledAt ? new Date(b.settledAt).getTime() : 0;
      return t >= cutoff;
    });
    if (relevant.length === 0) return { value: "—", tone: "muted" as const };
    const avg =
      relevant.reduce((s, b) => s + (clvPct(b) ?? 0), 0) / relevant.length;
    const sign = avg >= 0 ? "+" : "";
    return {
      value: `${sign}${(avg * 100).toFixed(2)}%`,
      tone: avg >= 0 ? ("pos" as const) : ("neg" as const),
    };
  }, [recentQ.data]);

  return (
    <header
      className="flex h-12 shrink-0 items-center gap-4 border-b border-zs px-6"
      style={{ background: "var(--zs-bg-elev)" }}
    >
      <div className="flex items-center gap-2">
        <span className="ind ind-pos animate-pulse" aria-hidden />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-muted">
          LIVE · {syncLabel}
        </span>
      </div>

      {onOpenPalette ? (
        <button
          type="button"
          onClick={onOpenPalette}
          aria-label="Open command palette"
          className="flex h-8 min-w-0 max-w-[480px] flex-1 items-center gap-2 rounded-md border border-zs bg-zs-bg px-3 text-left transition-colors hover:border-zs-bright"
        >
          <Search className="size-3.5 shrink-0 text-fg-muted" aria-hidden />
          <span className="truncate text-[12.5px] text-fg-muted">
            Search fixtures, rules, markets…
          </span>
          <span className="ml-auto flex items-center gap-1 rounded border border-zs px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">
            {isMac ? (
              <Command className="size-3" aria-hidden />
            ) : (
              <span>Ctrl</span>
            )}
            <span>K</span>
          </span>
        </button>
      ) : (
        <div className="flex-1" />
      )}

      {persistent ? (
        <div className="flex items-center gap-5">
          <TopStat
            label="BANKROLL"
            value={
              balanceQ.data !== undefined
                ? formatMoney(balanceQ.data, currency)
                : "—"
            }
            tone="fg"
          />
          <TopStat
            label="EXPOSURE"
            value={
              exposureQ.data !== undefined
                ? formatMoney(exposureQ.data, currency)
                : "—"
            }
            tone={(exposureQ.data ?? 0) > 0 ? "info" : "muted"}
          />
          <TopStat label="CLV 30D" value={clvText.value} tone={clvText.tone} />
        </div>
      ) : (
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-fg-muted">
          LIMITED MODE · RUN VIA TAURI
        </span>
      )}
    </header>
  );
}

type Tone = "fg" | "pos" | "neg" | "info" | "warn" | "muted";

function TopStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: Tone;
}) {
  const colorClass = cn(
    tone === "fg" && "text-fg",
    tone === "pos" && "text-pos",
    tone === "neg" && "text-neg",
    tone === "info" && "text-info",
    tone === "warn" && "text-warn",
    tone === "muted" && "text-fg-muted",
  );
  return (
    <div className="flex flex-col items-end leading-tight">
      <span className="kicker text-[9px]">{label}</span>
      <span
        className={cn(
          "font-mono text-[12.5px] font-semibold tabular-nums",
          colorClass,
        )}
      >
        {value}
      </span>
    </div>
  );
}

const useSyncTick = () => {
  const [, setTick] = useState(0);
  const [mountedAt] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 5_000);
    return () => clearInterval(id);
  }, []);
  const secs = Math.max(1, Math.floor((Date.now() - mountedAt) / 1_000) % 60 || 1);
  return `SYNC ${secs}s AGO`;
};
