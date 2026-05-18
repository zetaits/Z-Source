import { useEffect, useMemo, useRef, useState } from "react";

export type StageKey = "resolve" | "odds" | "rules" | "verdicts";
export type StageStatus = "pending" | "running" | "done";

export interface StageState {
  key: StageKey;
  label: string;
  detail: string;
  status: StageStatus;
}

interface ScriptStage {
  key: StageKey;
  label: string;
  detail: string;
  /** Seconds at which this stage starts running (cumulative from scan start). */
  startAt: number;
  /** Seconds at which this stage finishes (relative to scan start). */
  endAt: number;
}

const SCRIPT: ScriptStage[] = [
  { key: "resolve",  label: "Resolve",  detail: "mapping teams + leagues",    startAt: 0,  endAt: 3.5 },
  { key: "odds",     label: "Odds",     detail: "fetching books + markets",   startAt: 3.5, endAt: 10 },
  { key: "rules",    label: "Rules",    detail: "scoring selections",         startAt: 10, endAt: 22 },
  { key: "verdicts", label: "Verdicts", detail: "ranking plays + combos",     startAt: 22, endAt: 28 },
];

const PIPELINE_BUDGET_S = 28;
const PROGRESS_CAP = 0.9;

interface UseScanStagesArgs {
  active: boolean;
}

interface UseScanStagesReturn {
  stages: StageState[];
  /** 0..1 — time-eased, capped at 0.9 while active, snaps to 1 on finish. */
  progress: number;
  elapsedMs: number;
  finishing: boolean;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export function useScanStages({ active }: UseScanStagesArgs): UseScanStagesReturn {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const startRef = useRef<number | null>(null);
  const wasActiveRef = useRef(false);
  const finishTimerRef = useRef<number | null>(null);

  // Drive the timer while active
  useEffect(() => {
    if (active) {
      if (!wasActiveRef.current) {
        startRef.current = performance.now();
        setElapsedMs(0);
        setFinishing(false);
      }
      wasActiveRef.current = true;
      let raf = 0;
      const tick = () => {
        if (startRef.current !== null) {
          setElapsedMs(performance.now() - startRef.current);
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }

    // active just turned false: enter finishing phase (snap-to-done flash), then reset
    if (wasActiveRef.current) {
      wasActiveRef.current = false;
      setFinishing(true);
      if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = window.setTimeout(() => {
        setFinishing(false);
        startRef.current = null;
        setElapsedMs(0);
      }, 700);
    }
    return undefined;
  }, [active]);

  useEffect(() => () => {
    if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
  }, []);

  const elapsedS = elapsedMs / 1000;

  const stages = useMemo<StageState[]>(() => {
    if (finishing) {
      return SCRIPT.map((s) => ({
        key: s.key,
        label: s.label,
        detail: s.detail,
        status: "done" as StageStatus,
      }));
    }
    if (!active && !wasActiveRef.current) {
      return SCRIPT.map((s) => ({
        key: s.key,
        label: s.label,
        detail: s.detail,
        status: "pending" as StageStatus,
      }));
    }
    return SCRIPT.map((s) => {
      let status: StageStatus = "pending";
      if (elapsedS >= s.endAt) status = "done";
      else if (elapsedS >= s.startAt) status = "running";
      return { key: s.key, label: s.label, detail: s.detail, status };
    });
  }, [active, elapsedS, finishing]);

  const progress = useMemo(() => {
    if (finishing) return 1;
    if (!active) return 0;
    const linear = Math.min(1, elapsedS / PIPELINE_BUDGET_S);
    return Math.min(PROGRESS_CAP, easeOutCubic(linear) * PROGRESS_CAP);
  }, [active, elapsedS, finishing]);

  return { stages, progress, elapsedMs, finishing };
}

export const RULE_TICKER = [
  "h2hDominance",
  "sharpSquareDetector",
  "lineMovementVsPublic",
  "restCongestion",
  "xGMatchupAsymmetry",
  "xPointsRegression",
  "formDivergence",
  "drawValueAt375",
  "favFullMatchToFirstHalf",
  "cornersHighTempo",
  "vigAdjustedEdge",
  "bttsXgPoisson",
  "goalsTempoForm",
  "doubleChanceDcModel",
  "teamTotalsXgDc",
] as const;
