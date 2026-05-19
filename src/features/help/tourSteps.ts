export interface TourStep {
  id: string;
  targetId: string;
  pathBuilder(ctx: { firstMatchId: string | null }): string;
  title: string;
  body: string;
  fallback?: string;
  scrollBlock?: ScrollLogicalPosition;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    targetId: "command-center",
    pathBuilder: () => "/",
    title: "WELCOME",
    body: "Z-Source scores fixtures with the bonded methodology. This is your Command Center — bankroll, exposure, next whistles. Let's walk through the rest.",
    scrollBlock: "start",
  },
  {
    id: "scanner",
    targetId: "scanner-list",
    pathBuilder: () => "/scanner",
    title: "1 · FIND A FIXTURE",
    body: "Your fixture board for the next 4 days, grouped by league. Pick a day, then click ANALYSE on any match row to score it.",
  },
  {
    id: "match-analyse",
    targetId: "match-analyse",
    pathBuilder: ({ firstMatchId }) => (firstMatchId ? `/match/${firstMatchId}` : "/scanner"),
    title: "2 · RUN ANALYSIS",
    body: "Hit RUN ANALYSIS to score the fixture across the 5 bonded legs — matchup, trends, lines, sharp vs square, intangibles. Picks land below within seconds.",
    fallback: "Open a fixture from Scanner first to see this in action.",
  },
  {
    id: "match-tabs",
    targetId: "match-tabs",
    pathBuilder: ({ firstMatchId }) => (firstMatchId ? `/match/${firstMatchId}` : "/scanner"),
    title: "3 · DRILL THE LEGS",
    body: "Seven tabs hold the per-leg breakdown: Picks (with reasoning trace), Lines, Matchup, Trends, Splits, Sentiment, Intangibles. Every signal is traceable.",
    fallback: "Open a fixture from Scanner to inspect the tabs.",
  },
  {
    id: "bankroll",
    targetId: "bankroll-equity",
    pathBuilder: () => "/bankroll",
    title: "4 · TRACK BANKROLL",
    body: "Equity curve, ROI, CLV, exposure. Log bets here — fractional Kelly sizing is wired in and the ledger drives your balance.",
  },
  {
    id: "metrics",
    targetId: "metrics-calibration",
    pathBuilder: () => "/metrics",
    title: "5 · CHECK CALIBRATION",
    body: "Predicted probability vs realised hit rate. If your dots hug the diagonal, the engine is honest. Drift means recalibrate.",
  },
  {
    id: "strategy",
    targetId: "strategy-rules",
    pathBuilder: () => "/strategy",
    title: "6 · TUNE THE ENGINE",
    body: "Toggle individual rules, reweight legs, set combo policy. Changes save instantly and re-trigger any open analyses.",
    scrollBlock: "start",
  },
  {
    id: "palette",
    targetId: "topbar-search",
    pathBuilder: () => "/scanner",
    title: "7 · POWER TIP",
    body: "Hit ⌘K (or Ctrl+K) anywhere to jump straight to a fixture, rule, or market. Once you're set up, this is the fastest way around.",
  },
];
