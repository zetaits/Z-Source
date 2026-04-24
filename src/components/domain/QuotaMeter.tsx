import { useEffect, useState } from "react";
import { Activity, AlertTriangle } from "lucide-react";
import type { QuotaTracker } from "@/services/http/quotaTracker";
import type { QuotaSnapshot } from "@/services/providers/OddsProvider";
import { cn } from "@/lib/utils";

interface Props {
  tracker: QuotaTracker;
  compactLabel?: string;
}

const tone = (
  remaining: number | null,
  capacity: number | null,
): "ok" | "warn" | "danger" | "muted" => {
  if (remaining === null || capacity === null) return "muted";
  const ratio = remaining / capacity;
  if (ratio <= 0.1) return "danger";
  if (ratio <= 0.25) return "warn";
  return "ok";
};

const formatReset = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diffMs = d.getTime() - Date.now();
  if (diffMs <= 0) return "resetting…";
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return `reset ${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `reset ${hrs}h`;
  const days = Math.round(hrs / 24);
  return `reset ${days}d`;
};

export function QuotaMeter({ tracker, compactLabel }: Props) {
  const [snapshot, setSnapshot] = useState<QuotaSnapshot>(() => tracker.snapshot());
  useEffect(() => tracker.subscribe(setSnapshot), [tracker]);

  const t = tone(snapshot.remaining, tracker.capacity);
  const Icon = t === "danger" ? AlertTriangle : Activity;
  const display = snapshot.remaining === null
    ? "—"
    : `${snapshot.remaining}${tracker.capacity !== null ? ` / ${tracker.capacity}` : ""}`;
  const resetHint = formatReset(snapshot.resetAt);
  const label = compactLabel ?? tracker.label;

  const title = [
    `${tracker.label} quota`,
    snapshot.lastSyncedAt
      ? `synced ${new Date(snapshot.lastSyncedAt).toLocaleTimeString()}`
      : "no requests yet",
    resetHint ?? null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 font-mono text-xs",
        t === "danger" && "text-destructive",
        t === "warn" && "text-warning",
        t === "ok" && "text-muted-foreground",
        t === "muted" && "text-muted-foreground/70",
      )}
      title={title}
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="font-tabular">
        {label} {display}
      </span>
    </div>
  );
}
