import { useEffect, useState } from "react";
import { Activity, AlertTriangle } from "lucide-react";
import { oddsApiQuota } from "@/services/http/quotaTracker";
import type { QuotaSnapshot } from "@/services/providers/OddsProvider";
import { cn } from "@/lib/utils";

const FREE_TIER_TOTAL = 500;

const tone = (remaining: number | null): "ok" | "warn" | "danger" | "muted" => {
  if (remaining === null) return "muted";
  if (remaining <= FREE_TIER_TOTAL * 0.1) return "danger";
  if (remaining <= FREE_TIER_TOTAL * 0.25) return "warn";
  return "ok";
};

export function QuotaMeter() {
  const [snapshot, setSnapshot] = useState<QuotaSnapshot>(() => oddsApiQuota.snapshot());

  useEffect(() => oddsApiQuota.subscribe(setSnapshot), []);

  const t = tone(snapshot.remaining);
  const Icon = t === "danger" ? AlertTriangle : Activity;
  const display = snapshot.remaining === null
    ? "—"
    : `${snapshot.remaining} / ${FREE_TIER_TOTAL}`;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 font-mono text-xs",
        t === "danger" && "text-destructive",
        t === "warn" && "text-warning",
        t === "ok" && "text-muted-foreground",
        t === "muted" && "text-muted-foreground/70",
      )}
      title={
        snapshot.lastSyncedAt
          ? `OddsAPI quota · last synced ${new Date(snapshot.lastSyncedAt).toLocaleTimeString()}`
          : "OddsAPI quota — no requests yet this session"
      }
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="font-tabular">odds {display}</span>
    </div>
  );
}
