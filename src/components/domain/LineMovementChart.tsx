import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import type { SnapshotRow } from "@/storage/repos/snapshotsRepo";

interface Props {
  snapshots: SnapshotRow[];
  title?: string;
  bucketMs?: number;
}

const SELECTION_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
] as const;

const SELECTION_DASH = ["0", "6 4", "2 3", "10 4"];

interface Series {
  key: string;
  label: string;
}

const HOUR_MS = 60 * 60 * 1000;

export const pickAutoBucketMs = (snaps: SnapshotRow[]): number => {
  if (snaps.length < 2) return 15 * 60 * 1000;
  const first = new Date(snaps[0].takenAt).getTime();
  const last = new Date(snaps[snaps.length - 1].takenAt).getTime();
  const rangeH = (last - first) / HOUR_MS;
  if (rangeH < 1) return 5 * 60 * 1000;
  if (rangeH < 4) return 15 * 60 * 1000;
  if (rangeH < 12) return 30 * 60 * 1000;
  if (rangeH < 36) return HOUR_MS;
  if (rangeH < 96) return 3 * HOUR_MS;
  return 6 * HOUR_MS;
};

export const bucketSnaps = (
  snaps: SnapshotRow[],
  bucketMs: number,
): SnapshotRow[] => {
  if (bucketMs <= 0 || snaps.length === 0) return snaps;
  const lastByKey = new Map<string, SnapshotRow>();
  for (const s of snaps) {
    const ts = new Date(s.takenAt).getTime();
    const bucket = Math.floor(ts / bucketMs) * bucketMs;
    const key = `${s.selectionKey}|${bucket}`;
    const cur = lastByKey.get(key);
    const curTs = cur ? new Date(cur.takenAt).getTime() : -Infinity;
    if (ts > curTs) {
      lastByKey.set(key, { ...s, takenAt: new Date(bucket).toISOString() });
    }
  }
  return [...lastByKey.values()].sort(
    (a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime(),
  );
};

const buildSeries = (
  snaps: SnapshotRow[],
): { rows: Record<string, unknown>[]; series: Series[] } => {
  const byTime = new Map<string, Record<string, unknown>>();
  const selectionKeys = new Set<string>();
  for (const s of snaps) {
    selectionKeys.add(s.selectionKey);
    const key = s.takenAt;
    const row =
      byTime.get(key) ??
      ({ t: s.takenAt, ts: new Date(s.takenAt).getTime() } as Record<string, unknown>);
    const prev = row[s.selectionKey] as number | undefined;
    if (prev === undefined || s.priceDecimal > prev) row[s.selectionKey] = s.priceDecimal;
    byTime.set(key, row);
  }
  const rows = [...byTime.values()].sort(
    (a, b) => (a.ts as number) - (b.ts as number),
  );
  const series: Series[] = [...selectionKeys].map((k) => ({
    key: k,
    label: k.split(":").slice(1).join(":"),
  }));
  return { rows, series };
};

const tickFormatter = (multiDay: boolean) => (iso: string) => {
  const d = new Date(iso);
  if (multiDay) {
    return d.toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

export function LineMovementChart({ snapshots, title, bucketMs }: Props) {
  const { rows, series, multiDay } = useMemo(() => {
    const aggregated =
      bucketMs && bucketMs > 0 ? bucketSnaps(snapshots, bucketMs) : snapshots;
    const built = buildSeries(aggregated);
    let multi = false;
    if (built.rows.length >= 2) {
      const first = built.rows[0].ts as number;
      const last = built.rows[built.rows.length - 1].ts as number;
      multi = last - first > 24 * HOUR_MS;
    }
    return { ...built, multiDay: multi };
  }, [snapshots, bucketMs]);

  if (snapshots.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground">
        No line history recorded yet.
      </div>
    );
  }

  if (rows.length < 2) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
        Only one bucket of data so far. Movement appears once at least two
        intervals are recorded.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-3">
      {title && (
        <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
      )}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <XAxis
              dataKey="t"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickFormatter={tickFormatter(multiDay)}
              minTickGap={40}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              domain={["auto", "auto"]}
              tickFormatter={(v) => (typeof v === "number" ? v.toFixed(2) : String(v))}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                fontSize: 12,
              }}
              labelFormatter={(v: string) => new Date(v).toLocaleString()}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {series.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label || s.key}
                stroke={SELECTION_COLORS[i % SELECTION_COLORS.length]}
                strokeDasharray={SELECTION_DASH[i % SELECTION_DASH.length]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
