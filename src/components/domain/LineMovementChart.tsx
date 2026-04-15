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

const buildSeries = (snaps: SnapshotRow[]): { rows: Record<string, unknown>[]; series: Series[] } => {
  const byTime = new Map<string, Record<string, unknown>>();
  const selectionKeys = new Set<string>();
  for (const s of snaps) {
    selectionKeys.add(s.selectionKey);
    const key = s.takenAt;
    const row =
      byTime.get(key) ?? ({ t: s.takenAt, ts: new Date(s.takenAt).getTime() } as Record<string, unknown>);
    const prev = row[s.selectionKey] as number | undefined;
    if (prev === undefined || s.priceDecimal > prev) row[s.selectionKey] = s.priceDecimal;
    byTime.set(key, row);
  }
  const rows = [...byTime.values()].sort(
    (a, b) => (a.ts as number) - (b.ts as number),
  );
  const series: Series[] = [...selectionKeys].map((k) => ({ key: k, label: k.split(":").slice(1).join(":") }));
  return { rows, series };
};

const formatTick = (iso: string): string =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

export function LineMovementChart({ snapshots, title }: Props) {
  const { rows, series } = useMemo(() => buildSeries(snapshots), [snapshots]);

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
        Only one snapshot so far. Line movement appears after two or more data points.
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
              tickFormatter={formatTick}
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
