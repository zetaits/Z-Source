// A sport-specific autopilot driver. The orchestrator (useAutopilot) owns the
// tick loop, persistence and UI; each driver knows only how to (A) analyze its
// slate and log threshold plays, and (B) capture closing odds + auto-settle its
// open bets. Adding a sport to the autopilot = drop a driver here and register it.

export type AutopilotEventKind = "log" | "close" | "settle" | "info" | "error";

export interface AutopilotDriverCtx {
  nowMs: number;
  /** Emit an activity event (the orchestrator tags it with this driver's sport). */
  push: (kind: AutopilotEventKind, message: string) => void;
}

export interface AutopilotDriver {
  /** Matches Sport.id (config/sports.ts) and the sport registry key. */
  sportId: string;
  /** Short badge for the panel, e.g. "MLB", "TENNIS". */
  label: string;
  /** Phase A — analyze the slate and log new threshold plays as OPEN bets. */
  analyzeAndLog: (ctx: AutopilotDriverCtx) => Promise<void>;
  /** Phases B+C — closing snapshots and auto-settle. Returns #open bets watched. */
  captureAndSettle: (ctx: AutopilotDriverCtx) => Promise<number>;
}
