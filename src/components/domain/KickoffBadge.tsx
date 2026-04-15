import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  kickoffAt: string;
  className?: string;
}

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const formatRelative = (iso: string, now: number): string => {
  const ts = new Date(iso).getTime();
  const diffMin = Math.round((ts - now) / 60_000);
  if (diffMin < -60) return formatTime(iso);
  if (diffMin < 0) return `${-diffMin}m ago`;
  if (diffMin < 60) return `in ${diffMin}m`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `in ${diffH}h`;
  const diffD = Math.round(diffH / 24);
  return `in ${diffD}d`;
};

export function KickoffBadge({ kickoffAt, className }: Props) {
  const now = Date.now();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border border-border bg-background/40 px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground",
        className,
      )}
      title={new Date(kickoffAt).toLocaleString()}
    >
      <CalendarClock className="size-3" aria-hidden />
      <span className="font-tabular">{formatTime(kickoffAt)}</span>
      <span className="text-muted-foreground/60">·</span>
      <span>{formatRelative(kickoffAt, now)}</span>
    </span>
  );
}
