import type { AnalysisDiagnostics } from "@/engine";

interface Props {
  diagnostics: AnalysisDiagnostics;
}

const Pill = ({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "warn" | "good";
}) => (
  <span
    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${
      tone === "warn"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
        : tone === "good"
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
          : "border-zs bg-muted/30 text-muted-foreground"
    }`}
  >
    <span className="opacity-70">{label}</span>
    <span className="font-medium tabular-nums">{value}</span>
  </span>
);

export function DiagnosticsCard({ diagnostics }: Props) {
  const d = diagnostics;
  const totalSkipped =
    d.selectionsSkipped.noPrice + d.selectionsSkipped.noBaseProb;
  const rulesFired = Object.keys(d.rulesFired).length;
  const rulesSkipped = Object.keys(d.rulesSkippedDataMissing).length;
  const totalVerdicts =
    d.verdictBreakdown.LEAN +
    d.verdictBreakdown.PLAY +
    d.verdictBreakdown.STRONG;

  const missingFlags: string[] = [];
  if (d.dataMissing.homeForm) missingFlags.push("home form");
  if (d.dataMissing.awayForm) missingFlags.push("away form");
  if (d.dataMissing.homeXG) missingFlags.push("home xG");
  if (d.dataMissing.awayXG) missingFlags.push("away xG");
  if (d.dataMissing.h2hMeetings === 0) missingFlags.push("h2h");
  if (d.dataMissing.intangibles) missingFlags.push("intangibles");
  const splitsMissingCount = d.dataMissing.splitsMissing.length;
  const openersMissingCount = d.dataMissing.openersMissing.length;

  return (
    <div className="rounded-lg border border-dashed bg-card p-4">
      <div className="kicker mb-3">Why no picks?</div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <Pill label="enumerated" value={d.selectionsEnumerated} />
        <Pill
          label="rules fired"
          value={rulesFired}
          tone={rulesFired > 0 ? "good" : "warn"}
        />
        <Pill
          label="rules data-missing"
          value={rulesSkipped}
          tone={rulesSkipped > rulesFired ? "warn" : "neutral"}
        />
        <Pill
          label="skipped (no price/prob)"
          value={totalSkipped}
          tone={totalSkipped > 0 ? "warn" : "neutral"}
        />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div>
          <div className="text-muted-foreground">PASS</div>
          <div className="font-medium tabular-nums">{d.verdictBreakdown.PASS}</div>
        </div>
        <div>
          <div className="text-muted-foreground">LEAN</div>
          <div className="font-medium tabular-nums">{d.verdictBreakdown.LEAN}</div>
        </div>
        <div>
          <div className="text-muted-foreground">PLAY</div>
          <div className="font-medium tabular-nums">{d.verdictBreakdown.PLAY}</div>
        </div>
        <div>
          <div className="text-muted-foreground">STRONG</div>
          <div className="font-medium tabular-nums">{d.verdictBreakdown.STRONG}</div>
        </div>
      </div>

      {missingFlags.length > 0 || splitsMissingCount > 0 || openersMissingCount > 0 ? (
        <div className="mb-3">
          <div className="kicker mb-1.5">Missing data</div>
          <div className="flex flex-wrap gap-1.5">
            {missingFlags.map((m) => (
              <Pill key={m} label="no" value={m} tone="warn" />
            ))}
            {splitsMissingCount > 0 && (
              <Pill
                label="splits missing"
                value={`${splitsMissingCount} markets`}
                tone="warn"
              />
            )}
            {openersMissingCount > 0 && (
              <Pill
                label="openers missing"
                value={`${openersMissingCount} markets`}
                tone="warn"
              />
            )}
          </div>
        </div>
      ) : null}

      {rulesFired > 0 && totalVerdicts === 0 ? (
        <p className="text-xs text-muted-foreground">
          Rules fired but no selection cleared the bonded threshold (≥{2} positive
          legs, edge ≥ 2%, confidence ≥ 40%).
        </p>
      ) : rulesFired === 0 ? (
        <p className="text-xs text-muted-foreground">
          No rule emitted output. Likely missing form / xG / splits data — fix
          the resolver before tweaking thresholds.
        </p>
      ) : null}
    </div>
  );
}
