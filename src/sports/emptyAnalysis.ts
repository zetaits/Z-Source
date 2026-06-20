import { loadStrategy } from "@/features/match-detail/hooks/loadStrategy";
import type { AnalysisResult, AnalysisStatus } from "./contracts";

/**
 * Build an empty AnalysisResult for sports that have no analysis engine wired
 * yet (status "no-engine") or that hit a terminal state before producing plays.
 * Keeps the match-detail UI on a clean empty state instead of crashing.
 */
export const emptyAnalysis = async (
  status: AnalysisStatus,
  message?: string,
): Promise<AnalysisResult> => {
  const strategy = await loadStrategy();
  return {
    plays: [],
    allCandidates: [],
    combos: [],
    lines: {},
    openers: {},
    synthetic: {},
    splits: {},
    splitsAvailable: false,
    splitsProvider: "",
    historyAvailable: false,
    historyProvider: "",
    strategy,
    status,
    message,
    generatedAt: new Date().toISOString(),
  };
};
