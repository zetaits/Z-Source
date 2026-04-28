import { useMemo, useState } from "react";
import { BookId, LeagueId, MatchId, TeamId } from "@/domain/ids";
import type { MarketKey } from "@/domain/market";
import type { BookOffer, LineSnapshot } from "@/domain/odds";
import type { Splits } from "@/domain/splits";
import {
  DEFAULT_LEG_CAPS,
  DEFAULT_LEG_WEIGHTS,
  DEFAULT_STAKE_POLICY,
  type StrategyConfig,
} from "@/domain/strategy";
import type { PlayCandidate } from "@/domain/play";
import type { AnalysisContext } from "@/engine/context";
import { DEFAULT_UNIT_BANKROLL_FRACTION } from "@/engine/context";
import { runBondedAnalysis } from "@/engine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronRight } from "lucide-react";

const ENABLED_MARKETS: MarketKey[] = ["ML_1X2", "DNB", "AH", "OU_GOALS", "BTTS"];

const mkOffer = (
  marketKey: MarketKey,
  side: string,
  decimal: number,
  line?: number,
  book = "pinnacle",
): BookOffer => ({
  book: BookId(book),
  selection: line === undefined ? { marketKey, side } : { marketKey, side, line },
  decimal,
  takenAt: "2026-04-14T10:00:00Z",
});

const mkSnap = (marketKey: MarketKey, offers: BookOffer[], isOpener = false): LineSnapshot => ({
  matchId: MatchId("playground"),
  marketKey,
  offers,
  takenAt: "2026-04-14T10:00:00Z",
  isOpener,
});

const defaultStrategy = (): StrategyConfig => ({
  legWeights: DEFAULT_LEG_WEIGHTS,
  legCaps: DEFAULT_LEG_CAPS,
  minLegsAlignedForBonded: 3,
  stakePolicy: DEFAULT_STAKE_POLICY,
  rules: [],
  enabledMarkets: ENABLED_MARKETS,
});

type ScenarioKey = "soft-edge-draw" | "reverse-line-movement" | "no-edge";

const SCENARIOS: Record<ScenarioKey, { label: string; build: () => AnalysisContext }> = {
  "soft-edge-draw": {
    label: "Soft fav + tasty draw @ 3.90",
    build: () => buildCtx({
      lines: {
        ML_1X2: mkSnap("ML_1X2", [
          mkOffer("ML_1X2", "home", 2.05),
          mkOffer("ML_1X2", "draw", 3.9),
          mkOffer("ML_1X2", "away", 4.1),
        ]),
        OU_GOALS: mkSnap("OU_GOALS", [
          mkOffer("OU_GOALS", "over", 1.95, 2.5),
          mkOffer("OU_GOALS", "under", 1.85, 2.5),
        ]),
      },
    }),
  },
  "reverse-line-movement": {
    label: "Reverse line movement · home",
    build: () => buildCtx({
      lines: {
        ML_1X2: mkSnap("ML_1X2", [
          mkOffer("ML_1X2", "home", 2.15),
          mkOffer("ML_1X2", "draw", 3.4),
          mkOffer("ML_1X2", "away", 3.4),
        ]),
      },
      openers: {
        ML_1X2: mkSnap("ML_1X2", [
          mkOffer("ML_1X2", "home", 2.55),
          mkOffer("ML_1X2", "draw", 3.4),
          mkOffer("ML_1X2", "away", 2.95),
        ], true),
      },
      splits: {
        ML_1X2: {
          matchId: MatchId("playground"),
          marketKey: "ML_1X2",
          source: "mock",
          takenAt: "2026-04-14T10:00:00Z",
          rows: [
            { selection: { marketKey: "ML_1X2", side: "home" }, betsPct: 28, moneyPct: 65 },
            { selection: { marketKey: "ML_1X2", side: "draw" }, betsPct: 15, moneyPct: 15 },
            { selection: { marketKey: "ML_1X2", side: "away" }, betsPct: 57, moneyPct: 20 },
          ],
        } satisfies Splits,
      },
    }),
  },
  "no-edge": {
    label: "Efficient market · sharp pricing",
    build: () => buildCtx({
      lines: {
        ML_1X2: mkSnap("ML_1X2", [
          mkOffer("ML_1X2", "home", 1.95),
          mkOffer("ML_1X2", "draw", 3.45),
          mkOffer("ML_1X2", "away", 4.3),
        ]),
        BTTS: mkSnap("BTTS", [
          mkOffer("BTTS", "yes", 1.82),
          mkOffer("BTTS", "no", 1.98),
        ]),
      },
    }),
  },
};

interface CtxInputs {
  lines?: AnalysisContext["lines"];
  openers?: AnalysisContext["openers"];
  splits?: AnalysisContext["splits"];
}

function buildCtx(inputs: CtxInputs): AnalysisContext {
  return {
    match: {
      id: MatchId("playground"),
      leagueId: LeagueId("playground-league"),
      kickoffAt: "2026-04-14T18:00:00Z",
      home: { id: TeamId("home"), name: "Home FC" },
      away: { id: TeamId("away"), name: "Away CF" },
      status: "SCHEDULED",
      source: "playground",
    },
    strategy: defaultStrategy(),
    lines: inputs.lines ?? {},
    openers: inputs.openers ?? {},
    splits: inputs.splits ?? {},
    unitBankrollFraction: DEFAULT_UNIT_BANKROLL_FRACTION,
    userBooks: [],
    generatedAt: new Date().toISOString(),
  };
}

const VERDICT_TONE: Record<PlayCandidate["verdict"], string> = {
  STRONG: "border-[hsl(var(--success))]/50 bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]",
  PLAY: "border-primary/40 bg-primary/15 text-primary",
  LEAN: "border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]",
  PASS: "border-border bg-muted text-muted-foreground",
};

export function EnginePlayground() {
  const [scenario, setScenario] = useState<ScenarioKey>("soft-edge-draw");
  const [includePass, setIncludePass] = useState(true);
  const [ranAt, setRanAt] = useState<string | null>(null);

  const plays = useMemo(() => {
    if (!ranAt) return [];
    const ctx = SCENARIOS[scenario].build();
    return runBondedAnalysis(ctx, { includePass });
  }, [scenario, includePass, ranAt]);

  return (
    <div className="flex h-full flex-col gap-6 p-8">
      <header className="flex flex-col gap-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          dev · engine playground
        </span>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Engine playground</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Run <code className="font-mono text-xs">runBondedAnalysis</code> over a fixture and inspect
              PlayCandidates + reasoning trace. Not linked from the sidebar.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={scenario} onValueChange={(v) => setScenario(v as ScenarioKey)}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SCENARIOS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant={includePass ? "secondary" : "outline"}
              onClick={() => setIncludePass((v) => !v)}
            >
              {includePass ? "All selections" : "Hide PASS"}
            </Button>
            <Button size="sm" onClick={() => setRanAt(new Date().toISOString())}>
              Run analysis
            </Button>
          </div>
        </div>
      </header>

      {!ranAt ? (
        <div className="rounded-lg border border-dashed bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Pick a scenario and hit “Run analysis”.
          </p>
        </div>
      ) : plays.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No plays generated. Flip “Hide PASS” to show all selections.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {plays.map((p) => (
            <PlayRow key={p.id} play={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlayRow({ play }: { play: PlayCandidate }) {
  const [open, setOpen] = useState(false);
  const label =
    play.selection.line !== undefined
      ? `${play.selection.side} ${play.selection.line}`
      : play.selection.side;
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {play.selection.marketKey}
            </span>
            <span className="text-sm font-medium capitalize">{label}</span>
            <Badge variant="outline" className={VERDICT_TONE[play.verdict]}>
              {play.verdict}
            </Badge>
          </div>
          <div className="flex items-center gap-6 font-mono text-xs tabular-nums">
            <Stat label="Edge" value={`${(play.edgePct * 100).toFixed(2)}%`} />
            <Stat label="Fair" value={`${(play.fairProb * 100).toFixed(1)}%`} />
            <Stat label="Confidence" value={`${(play.confidence * 100).toFixed(0)}%`} />
            <Stat label="Odds" value={play.price.decimal.toFixed(2)} />
            <Stat label="Stake" value={`${play.stakeUnits.toFixed(2)}u`} />
          </div>
        </div>
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
              <ChevronRight
                className={`size-3 transition-transform ${open ? "rotate-90" : ""}`}
              />
              Trace ({play.trace.length})
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-1.5 border-l border-border pl-3">
            {play.trace.map((entry, idx) => (
              <div key={`${entry.id}-${idx}`} className="text-xs">
                <span className="mr-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {entry.source}:{entry.id}
                </span>
                <span className="text-foreground/80">{entry.message}</span>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
