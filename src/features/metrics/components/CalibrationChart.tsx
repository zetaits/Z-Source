import {
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { CalibrationBin } from "@/storage/repos/pickOutcomesRepo";

interface Props {
  bins: CalibrationBin[];
}

export function CalibrationChart({ bins }: Props) {
  const data = bins
    .filter((b) => b.n > 0)
    .map((b) => ({
      predicted: b.predictedAvg,
      realised: b.realisedRate,
      n: b.n,
    }));

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground">
        Need decisive outcomes (WIN/LOSS) to render calibration.
      </div>
    );
  }

  return (
    <div className="h-64 rounded-lg border bg-card p-3">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="predicted"
            domain={[0, 1]}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            label={{
              value: "Predicted",
              position: "insideBottom",
              offset: -2,
              fontSize: 11,
              fill: "hsl(var(--muted-foreground))",
            }}
          />
          <YAxis
            type="number"
            dataKey="realised"
            domain={[0, 1]}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            label={{
              value: "Realised",
              angle: -90,
              position: "insideLeft",
              fontSize: 11,
              fill: "hsl(var(--muted-foreground))",
            }}
          />
          <ZAxis type="number" dataKey="n" range={[40, 220]} />
          <ReferenceLine
            segment={[
              { x: 0, y: 0 },
              { x: 1, y: 1 },
            ]}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="4 4"
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => {
              if (name === "predicted" || name === "realised") {
                return `${(value * 100).toFixed(1)}%`;
              }
              return value.toString();
            }}
          />
          <Scatter data={data} fill="hsl(var(--primary))" />
          <Line dataKey="realised" stroke="none" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
