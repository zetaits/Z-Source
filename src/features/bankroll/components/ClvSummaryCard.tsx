import type { Bet } from "@/domain/bet";
import { Block, Stat, Tag } from "@/components/zs";
import { KELLY_READINESS_THRESHOLD, clvSummary } from "../clvSummary";
import { useClvSnapshots } from "../hooks/useClvSnapshots";

interface Props {
  bets: Bet[];
}

/**
 * CLV readout for MLB pitcher-strikeout props. Renders nothing until at least
 * one prop play is logged (football-only users never see an empty MLB card).
 * The readiness line is the visible driver of the flat -> ¼-Kelly switch — it
 * surfaces the gate but never flips the policy automatically (a human does that
 * after reading the sample).
 */
export function ClvSummaryCard({ bets }: Props) {
  // Closing Ks snapshots power the line-move and model-vs-close axes of
  // beat-close; without them the report degrades to odds-only CLV.
  const snapshots = useClvSnapshots(bets);
  const s = clvSummary(bets, snapshots.data ?? {});
  if (s.nPlays === 0) return null;

  const clvTone = s.avgClvPct > 0 ? "pos" : s.avgClvPct < 0 ? "neg" : "fg";
  const beatTone = s.pctBeatClose >= 0.5 ? "pos" : "amber";

  return (
    <Block
      head="CLV · MLB PROPS"
      headRight={
        s.kellyReady ? (
          <Tag tone="pos">¼-KELLY ELIGIBLE</Tag>
        ) : (
          <Tag tone="amber">
            FLAT · {s.nPlays}/{KELLY_READINESS_THRESHOLD}
          </Tag>
        )
      }
      pad={false}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: "var(--zs-border)" }}>
        <Stat
          caption="PLAYS LOGGED"
          value={String(s.nPlays)}
          sub={`${s.nWithClose} WITH CLOSE`}
        />
        <Stat
          caption="BEAT CLOSE"
          value={`${(s.pctBeatClose * 100).toFixed(0)}%`}
          tone={beatTone}
          sub={s.nWithClose > 0 ? `OF ${s.nWithClose} MEASURED` : "PENDING CLOSE"}
        />
        <Stat
          caption="AVG CLV"
          value={`${s.avgClvPct >= 0 ? "+" : ""}${(s.avgClvPct * 100).toFixed(2)}%`}
          tone={clvTone}
          sub="ODDS VS CLOSE"
        />
      </div>
      <div
        style={{
          padding: "10px 16px",
          borderTop: "1px solid var(--zs-border)",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.06em",
          color: "var(--zs-fg-muted)",
        }}
      >
        {s.kellyReady
          ? `${s.nPlays} plays logged — enough sample to consider switching stake policy to ¼-Kelly in Strategy.`
          : `Flat staking — ${s.nPlays}/${KELLY_READINESS_THRESHOLD} plays logged before ¼-Kelly is worth measuring.`}
      </div>
    </Block>
  );
}
