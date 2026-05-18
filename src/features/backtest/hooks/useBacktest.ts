import { useState } from "react";
import { runBacktest, type BacktestSummary } from "@/backtest/runner";
import {
  fetchAndIngestSeason,
  type FdLeague,
  type IngestResult,
} from "@/services/impl/footballDataHistorical";
import { historicalOddsRepo } from "@/storage/repos/historicalOddsRepo";
import type { StrategyConfig } from "@/domain/strategy";

export interface BacktestState {
  phase:
    | "idle"
    | "ingesting"
    | "ingested"
    | "running"
    | "done"
    | "error";
  progress: { done: number; total: number };
  ingest?: IngestResult;
  summary?: BacktestSummary;
  matchesAvailable?: number;
  error?: string;
}

export const useBacktestRunner = () => {
  const [state, setState] = useState<BacktestState>({
    phase: "idle",
    progress: { done: 0, total: 0 },
  });

  const ingest = async (league: FdLeague, season: string) => {
    setState({ phase: "ingesting", progress: { done: 0, total: 100 } });
    try {
      const result = await fetchAndIngestSeason(league, season, (done, total) => {
        setState((s) => ({ ...s, progress: { done, total } }));
      });
      const matchesAvailable = await historicalOddsRepo.countMatches({
        league,
      });
      setState({
        phase: "ingested",
        progress: { done: result.matchesIngested, total: result.matchesIngested },
        ingest: result,
        matchesAvailable,
      });
    } catch (err) {
      setState({
        phase: "error",
        progress: { done: 0, total: 0 },
        error: (err as Error).message,
      });
    }
  };

  const run = async (league: FdLeague, strategy: StrategyConfig) => {
    setState((s) => ({ ...s, phase: "running", progress: { done: 0, total: 0 } }));
    try {
      const { summary } = await runBacktest({
        league,
        strategy,
        onProgress: (done, total) => {
          setState((s) => ({ ...s, progress: { done, total } }));
        },
      });
      setState((s) => ({
        ...s,
        phase: "done",
        progress: { done: summary.totalMatches, total: summary.totalMatches },
        summary,
      }));
    } catch (err) {
      setState({
        phase: "error",
        progress: { done: 0, total: 0 },
        error: (err as Error).message,
      });
    }
  };

  const reset = () =>
    setState({ phase: "idle", progress: { done: 0, total: 0 } });

  return { state, ingest, run, reset };
};
