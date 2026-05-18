import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { VerdictMarketSummary } from "@/storage/repos/pickOutcomesRepo";
import type { Verdict } from "@/domain/play";

interface Props {
  rows: VerdictMarketSummary[];
}

const VERDICT_ORDER: Verdict[] = ["STRONG", "PLAY", "LEAN", "PASS"];

const formatPct = (n: number): string => `${(n * 100).toFixed(1)}%`;
const formatRoi = (n: number): string =>
  `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;

export function SummaryTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        No picks recorded yet. Log a bet linked to a play to start tracking.
      </div>
    );
  }

  const grouped = new Map<Verdict, typeof rows>();
  for (const row of rows) {
    const bucket = grouped.get(row.verdict) ?? [];
    bucket.push(row);
    grouped.set(row.verdict, bucket);
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Verdict</TableHead>
            <TableHead>Market</TableHead>
            <TableHead className="text-right">Settled</TableHead>
            <TableHead className="text-right">W-L-P</TableHead>
            <TableHead className="text-right">Hit rate</TableHead>
            <TableHead className="text-right">ROI</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {VERDICT_ORDER.flatMap((v) =>
            (grouped.get(v) ?? []).map((row) => (
              <TableRow key={`${row.verdict}:${row.marketKey}`}>
                <TableCell className="font-medium">{row.verdict}</TableCell>
                <TableCell>{row.marketKey}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.settled} / {row.total}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.wins}–{row.losses}–{row.pushes}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.wins + row.losses > 0 ? formatPct(row.hitRate) : "—"}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums ${
                    row.settled > 0 && row.roi > 0
                      ? "text-emerald-500"
                      : row.settled > 0 && row.roi < 0
                        ? "text-rose-500"
                        : ""
                  }`}
                >
                  {row.settled > 0 ? formatRoi(row.roi) : "—"}
                </TableCell>
              </TableRow>
            )),
          )}
        </TableBody>
      </Table>
    </div>
  );
}
