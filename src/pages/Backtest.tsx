import { useEffect, useState } from "react";
import { AlertCircle, Database, Play } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { loadStrategy } from "@/features/match-detail/hooks/loadStrategy";
import { useBacktestRunner } from "@/features/backtest/hooks/useBacktest";
import {
  FD_LEAGUE_LABELS,
  type FdLeague,
} from "@/services/impl/footballDataHistorical";
import { isPersistentStorage } from "@/storage";
import { historicalOddsRepo } from "@/storage/repos/historicalOddsRepo";
import type { StrategyConfig } from "@/domain/strategy";

const LEAGUES: FdLeague[] = ["E0", "SP1", "I1", "D1", "F1"];
const SEASONS = ["2425", "2324", "2223", "2122", "2021"];

const seasonLabel = (s: string): string =>
  s.length === 4 ? `20${s.slice(0, 2)}-${s.slice(2, 4)}` : s;

const formatPct = (n: number): string => `${(n * 100).toFixed(1)}%`;
const formatSigned = (n: number): string =>
  `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;

export function Backtest() {
  const persistent = isPersistentStorage();
  const [league, setLeague] = useState<FdLeague>("E0");
  const [season, setSeason] = useState<string>(SEASONS[0]);
  const [strategy, setStrategy] = useState<StrategyConfig | null>(null);
  const [matchesInDb, setMatchesInDb] = useState<number>(0);
  const { state, ingest, run, reset } = useBacktestRunner();

  useEffect(() => {
    if (!persistent) return;
    loadStrategy().then(setStrategy).catch(() => {});
  }, [persistent]);

  useEffect(() => {
    if (!persistent) return;
    historicalOddsRepo
      .countMatches({ league })
      .then(setMatchesInDb)
      .catch(() => {});
  }, [league, persistent, state.phase]);

  if (!persistent) {
    return (
      <div className="flex h-full flex-col gap-6 p-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Backtest</h1>
        </header>
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>Desktop required</AlertTitle>
          <AlertDescription>
            Historical data lives in local SQLite. Run via{" "}
            <code className="font-mono text-xs">npm run tauri:dev</code>.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const isWorking = state.phase === "ingesting" || state.phase === "running";
  const progressPct =
    state.progress.total > 0
      ? Math.round((state.progress.done / state.progress.total) * 100)
      : 0;

  return (
    <div className="flex h-full flex-col gap-6 p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Backtest</h1>
        <p className="text-sm text-muted-foreground">
          Run the engine against football-data.co.uk historical CSVs (Pinnacle
          closing). Note: xG / splits / openers are NOT in this dataset, so
          xG-based rules will skip. Use this to validate verdict ordinal + ROI.
        </p>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase text-muted-foreground">
                League
              </label>
              <Select
                value={league}
                onValueChange={(v) => setLeague(v as FdLeague)}
                disabled={isWorking}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAGUES.map((l) => (
                    <SelectItem key={l} value={l}>
                      {FD_LEAGUE_LABELS[l]} ({l})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase text-muted-foreground">
                Season
              </label>
              <Select
                value={season}
                onValueChange={setSeason}
                disabled={isWorking}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEASONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {seasonLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted-foreground">
              In DB ({FD_LEAGUE_LABELS[league]}):{" "}
              <span className="font-medium tabular-nums text-foreground">
                {matchesInDb}
              </span>{" "}
              matches
            </span>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              disabled={isWorking}
              onClick={() => ingest(league, season)}
            >
              <Database className="mr-2 size-3.5" />
              Ingest season CSV
            </Button>
            <Button
              size="sm"
              disabled={isWorking || matchesInDb === 0 || !strategy}
              onClick={() => strategy && run(league, strategy)}
            >
              <Play className="mr-2 size-3.5" />
              Run backtest
            </Button>
            {state.phase !== "idle" && (
              <Button variant="ghost" size="sm" onClick={reset}>
                Reset
              </Button>
            )}
          </div>

          {isWorking && (
            <div className="flex flex-col gap-1.5">
              <Progress value={progressPct} />
              <span className="text-xs text-muted-foreground">
                {state.phase === "ingesting" ? "Ingesting" : "Running"} ·{" "}
                {state.progress.done} / {state.progress.total}
              </span>
            </div>
          )}

          {state.phase === "error" && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          {state.phase === "ingested" && state.ingest && (
            <Alert>
              <AlertTitle>Ingest complete</AlertTitle>
              <AlertDescription>
                {state.ingest.matchesIngested} matches, {state.ingest.offersIngested}{" "}
                offers, {state.ingest.rowsSkipped} rows skipped.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {state.summary && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Results</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card>
              <CardContent className="flex flex-col gap-1 p-4">
                <span className="text-xs uppercase text-muted-foreground">
                  Matches analysed
                </span>
                <span className="text-2xl font-semibold tabular-nums">
                  {state.summary.matchesAnalysed} / {state.summary.totalMatches}
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-1 p-4">
                <span className="text-xs uppercase text-muted-foreground">
                  Total picks
                </span>
                <span className="text-2xl font-semibold tabular-nums">
                  {state.summary.totalPicks}
                </span>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Verdict</TableHead>
                  <TableHead>Market</TableHead>
                  <TableHead className="text-right">N</TableHead>
                  <TableHead className="text-right">W-L-P</TableHead>
                  <TableHead className="text-right">Hit rate</TableHead>
                  <TableHead className="text-right">ROI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.summary.perVerdictMarket.map((row) => (
                  <TableRow key={`${row.verdict}:${row.marketKey}`}>
                    <TableCell className="font-medium">{row.verdict}</TableCell>
                    <TableCell>{row.marketKey}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.n}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.wins}–{row.losses}–{row.pushes}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.wins + row.losses > 0 ? formatPct(row.hitRate) : "—"}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${
                        row.roi > 0
                          ? "text-emerald-500"
                          : row.roi < 0
                            ? "text-rose-500"
                            : ""
                      }`}
                    >
                      {row.n > 0 ? formatSigned(row.roi) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}
