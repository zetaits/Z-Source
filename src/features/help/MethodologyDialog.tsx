import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ExternalLink } from "lucide-react";

interface Pillar {
  name: string;
  oneLiner: string;
  body: string;
  rules: string[];
}

const PILLARS: Pillar[] = [
  {
    name: "MATCHUP",
    oneLiner: "Is the model edge real?",
    body: "xG-based fair probability vs the bookmaker's vig-adjusted price. xPoints regression flags overperformers due for mean reversion.",
    rules: ["vigAdjustedEdge", "xPointsRegression", "xGMatchupAsymmetry", "drawValueAt375"],
  },
  {
    name: "TRENDS",
    oneLiner: "Does recent form back it?",
    body: "Recent form divergence, head-to-head dominance, and rest/congestion. Catches teams stacked on fixtures or coming off bye weeks.",
    rules: ["formDivergence", "h2hDominance", "restCongestion"],
  },
  {
    name: "LINES",
    oneLiner: "What is the market saying?",
    body: "Tracks line movement vs public ticket share. Looks for first-half tilts on heavy favourites, and tempo signals from corner lines.",
    rules: ["lineMovementVsPublic", "favFullMatchToFirstHalf", "cornersHighTempo"],
  },
  {
    name: "SHARP VS SQUARE",
    oneLiner: "Are pros on this side?",
    body: "Unified 5-pattern detector — RLM, dog trap, divergence, heavy/no-divergence silence, pure fade. One rule, five distinct signals.",
    rules: ["sharpSquareDetector"],
  },
  {
    name: "INTANGIBLES",
    oneLiner: "What's the model missing?",
    body: "Goals tempo from form, BTTS via Dixon-Coles xG matrix, double chance and team totals from the same matrix. Bridges xG into derived markets.",
    rules: ["bttsXgPoisson", "goalsTempoForm", "doubleChanceDcModel", "teamTotalsXgDc"],
  },
];

const VERDICTS: Array<{ tag: string; tone: string; rule: string }> = [
  { tag: "PASS", tone: "fg-muted", rule: "Fewer than 2 legs positive. Engine stays out." },
  { tag: "LEAN", tone: "fg-dim", rule: "2+ positive legs, none below −0.4. Watch-only." },
  { tag: "PLAY", tone: "info", rule: "3+ positive legs, no leg below −0.4. Stake at policy size." },
  { tag: "STRONG", tone: "pos", rule: "3+ positive legs with high composite confidence. Full stake." },
];

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
}

export function MethodologyDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl border-0 p-0"
        style={{
          background: "var(--zs-bg)",
          border: "1px solid var(--zs-accent)",
          borderRadius: 0,
          padding: 0,
          maxHeight: "85dvh",
          overflow: "auto",
          fontFamily: "var(--font-mono)",
          boxShadow: "0 10px 40px rgba(0,0,0,.7)",
        }}
      >
        <div style={{ padding: "22px 26px 0", borderBottom: "1px solid var(--zs-border)", paddingBottom: 18 }}>
          <div
            style={{
              fontSize: 9,
              color: "var(--zs-fg-muted)",
              letterSpacing: "0.20em",
              marginBottom: 6,
            }}
          >
            ── METHODOLOGY ──
          </div>
          <DialogTitle asChild>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: 26,
                color: "var(--zs-fg)",
                letterSpacing: "-0.01em",
                marginBottom: 4,
                margin: 0,
              }}
            >
              BONDED BETTING METHODOLOGY
            </h2>
          </DialogTitle>
          <DialogDescription asChild>
            <div style={{ fontSize: 11, color: "var(--zs-fg-muted)", letterSpacing: "0.10em", marginTop: 4 }}>
              5-leg signed consolidator · pluggable rule registry · traceable per pick
            </div>
          </DialogDescription>
        </div>

        <div style={{ padding: "20px 26px" }}>
          <p style={{ fontSize: 13, color: "var(--zs-fg-dim)", lineHeight: 1.65, margin: 0 }}>
            Every candidate is scored across five independent <em style={{ color: "var(--zs-fg)" }}>legs</em>.
            Signed signals are combined through a capped consolidator so no single rule dominates.
            A verdict only fires when bonded coverage holds: <strong style={{ color: "var(--zs-accent)" }}>≥3 positive legs</strong>{" "}
            and <strong style={{ color: "var(--zs-accent)" }}>no leg below −0.4</strong> for{" "}
            <span style={{ color: "var(--zs-fg)" }}>PLAY+</span>. Picks rank by{" "}
            <span style={{ color: "var(--zs-fg)" }}>edge × confidence</span>.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
            padding: "0 26px 22px",
          }}
        >
          {PILLARS.map((p) => (
            <div
              key={p.name}
              style={{
                border: "1px solid var(--zs-border)",
                padding: "12px 14px",
                background: "var(--zs-bg-elev)",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  background: "var(--zs-accent-fill)",
                  border: "1px solid var(--zs-accent)",
                  color: "var(--zs-accent)",
                  fontSize: 9,
                  letterSpacing: "0.18em",
                  fontWeight: 700,
                  marginBottom: 8,
                }}
              >
                {p.name}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--zs-fg)",
                  fontWeight: 600,
                  marginBottom: 6,
                  letterSpacing: "0.04em",
                }}
              >
                {p.oneLiner}
              </div>
              <div style={{ fontSize: 11, color: "var(--zs-fg-dim)", lineHeight: 1.55, marginBottom: 10 }}>
                {p.body}
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {p.rules.map((r) => (
                  <span
                    key={r}
                    style={{
                      padding: "2px 6px",
                      border: "1px solid var(--zs-border)",
                      fontSize: 9,
                      color: "var(--zs-fg-muted)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: "0 26px 22px" }}>
          <div
            style={{
              fontSize: 10,
              color: "var(--zs-fg-muted)",
              letterSpacing: "0.18em",
              marginBottom: 10,
            }}
          >
            ── VERDICTS ──
          </div>
          <div style={{ border: "1px solid var(--zs-border)" }}>
            {VERDICTS.map((v, i) => (
              <div
                key={v.tag}
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 1fr",
                  alignItems: "center",
                  gap: 14,
                  padding: "10px 14px",
                  borderTop: i === 0 ? "none" : "1px solid var(--zs-rule)",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.16em",
                    color: `var(--zs-${v.tone})`,
                  }}
                >
                  {v.tag}
                </span>
                <span style={{ fontSize: 11, color: "var(--zs-fg-dim)", lineHeight: 1.55 }}>
                  {v.rule}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: "0 26px 22px" }}>
          <div
            style={{
              border: "1px dashed var(--zs-border)",
              padding: "12px 14px",
              background: "transparent",
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: "var(--zs-accent)",
                letterSpacing: "0.20em",
                marginBottom: 6,
              }}
            >
              SYNTHETIC ALT-LINES
            </div>
            <div style={{ fontSize: 11, color: "var(--zs-fg-dim)", lineHeight: 1.6 }}>
              When the bookmaker doesn't quote a line, the engine generates it from a Dixon-Coles xG matrix
              (Power-adjusted, ρ=0.13). Offers are marked{" "}
              <code style={{ color: "var(--zs-accent)", fontSize: 10 }}>book="synthetic-poisson"</code>{" "}
              and skip vig-edge evaluation — signal comes from xG-based rules so phantom edges never fire.
            </div>
          </div>
        </div>

        <div
          style={{
            padding: "14px 26px",
            borderTop: "1px solid var(--zs-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 10, color: "var(--zs-fg-muted)", letterSpacing: "0.10em" }}>
            All data, picks and ledger stay local. No cloud sync.
          </span>
          <a
            href="https://github.com/zits/Z-Source#z-source"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              border: "1px solid var(--zs-accent)",
              background: "var(--zs-accent-fill)",
              color: "var(--zs-accent)",
              fontSize: 10,
              letterSpacing: "0.14em",
              fontWeight: 700,
              textDecoration: "none",
              textTransform: "uppercase",
            }}
          >
            <ExternalLink size={11} strokeWidth={2} />
            FULL README
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
