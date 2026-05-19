import type { AnalysisDiagnostics } from "@/engine";

interface Props {
  diagnostics: AnalysisDiagnostics;
}

const Row = ({ label, value, tone = "neutral" }: {
  label: string;
  value: string | number;
  tone?: "neutral" | "warn";
}) => (
  <div className="flex items-center justify-between py-0.5">
    <span className="text-[11px] text-fg-muted">{label}</span>
    <span
      className={`font-mono text-[11px] tabular-nums ${
        tone === "warn" ? "text-warn" : "text-fg"
      }`}
    >
      {value}
    </span>
  </div>
);

export function ComboDiagnosticsCard({ diagnostics }: Props) {
  const value = diagnostics.combos;
  const anchor = diagnostics.anchorCombos;
  if (!value && !anchor) return null;

  const valueDisabled = value && !value.enabled;
  const anchorDisabled = anchor && !anchor.enabled;

  return (
    <div
      className="rounded-lg border border-dashed border-zs p-4"
      style={{ background: "var(--zs-bg-elev)" }}
    >
      <div className="kicker mb-3">Why no combos?</div>

      {value && (
        <div className="mb-3">
          <div className="mb-1.5 text-[12px] font-semibold text-fg">
            Value combos {valueDisabled ? "· disabled" : ""}
          </div>
          {!valueDisabled && (
            <div className="flex flex-col">
              <Row
                label="Eligible candidates (LEAN+)"
                value={value.eligibleCandidates}
                tone={value.eligibleCandidates < 2 ? "warn" : "neutral"}
              />
              <Row label="Pairs considered" value={value.pairsConsidered} />
              <Row
                label="Rejected: same market"
                value={value.rejectedSameMarket}
              />
              <Row
                label="Rejected: same sharp origin"
                value={value.rejectedSameOrigin}
              />
              <Row
                label="Treated as independent (ρ=0)"
                value={value.treatedAsIndependent}
                tone={value.treatedAsIndependent > 0 ? "warn" : "neutral"}
              />
              <Row
                label="Rejected: below min decimal"
                value={value.rejectedBelowMinDecimal}
              />
              <Row
                label="Rejected: below min edge"
                value={value.rejectedBelowMinEdge}
              />
              <Row
                label="Rejected: below min fair prob"
                value={value.rejectedBelowMinFairProb}
              />
            </div>
          )}
        </div>
      )}

      {anchor && (
        <div>
          <div className="mb-1.5 text-[12px] font-semibold text-fg">
            Anchor combos {anchorDisabled ? "· disabled" : ""}
          </div>
          {!anchorDisabled && (
            <div className="flex flex-col">
              <Row
                label="Eligible bases (PLAY+, low decimal)"
                value={anchor.eligibleBases}
                tone={anchor.eligibleBases === 0 ? "warn" : "neutral"}
              />
              <Row
                label="Eligible anchors (LEAN+, conf)"
                value={anchor.eligibleAnchors}
                tone={anchor.eligibleAnchors === 0 ? "warn" : "neutral"}
              />
              <Row label="Pairs considered" value={anchor.pairsConsidered} />
              <Row
                label="Rejected: same market"
                value={anchor.rejectedSameMarket}
              />
              <Row
                label="Rejected: same sharp origin"
                value={anchor.rejectedSameOrigin}
              />
              <Row
                label="Rejected: ρ below threshold"
                value={anchor.rejectedBelowMinRho}
              />
              <Row
                label="Rejected: outside target range"
                value={anchor.rejectedOutsideTargetRange}
              />
            </div>
          )}
        </div>
      )}

      <p className="mt-3 text-[11px] text-fg-muted">
        Adjust thresholds in Settings → Strategy · Combos. Bases require low
        decimal + high confidence; correlation table must contain the market
        pair for a value combo to emerge.
      </p>
    </div>
  );
}
