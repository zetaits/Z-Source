// Bankroll-page control + activity readout for the autopilot. The loop itself
// runs in the AppShell-level provider; this panel just toggles it and shows
// what it has done. Terminal-flavoured to match the rest of the desk.

import { Block, Tag } from "@/components/zs";
import type { TagTone } from "@/components/zs";
import { useAutopilotContext } from "./AutopilotContext";
import type { AutopilotEventKind } from "./useAutopilot";

const KIND_TONE: Record<AutopilotEventKind, TagTone> = {
  log: "pos",
  close: "amber",
  settle: "fg",
  info: "fg",
  error: "neg",
};

const KIND_LABEL: Record<AutopilotEventKind, string> = {
  log: "LOG",
  close: "CLOSE",
  settle: "SETTLE",
  info: "INFO",
  error: "ERR",
};

const fmtTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

export function AutopilotPanel() {
  const { enabled, setEnabled, status } = useAutopilotContext();

  return (
    <Block
      head="AUTOPILOT · MLB"
      headRight={
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
        >
          <Tag tone={enabled ? "pos" : "fg"}>{enabled ? "● ON" : "○ OFF"}</Tag>
        </button>
      }
      pad={false}
    >
      <div
        style={{
          display: "flex",
          gap: 16,
          padding: "10px 16px",
          borderBottom: "1px solid var(--zs-border)",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.06em",
          color: "var(--zs-fg-muted)",
        }}
      >
        <span>{status.running ? "TICK RUNNING…" : `LAST TICK ${fmtTime(status.lastTickAt)}`}</span>
        <span>WATCHING {status.watching}</span>
        <span>{enabled ? "POLLS EVERY 60s WHILE APP OPEN" : "DISABLED"}</span>
      </div>

      <div style={{ maxHeight: 220, overflow: "auto" }} className="zs-scroll">
        {status.events.length === 0 ? (
          <div
            style={{
              padding: "16px",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--zs-fg-muted)",
            }}
          >
            {enabled
              ? "Armed. Logs picks when lineups post, captures the Bet365 close ~10 min before first pitch, and settles from the final box score — all hands-off."
              : "Off. Turn ON to auto-analyze posted-lineup games, log threshold plays, capture closing odds, and settle from the box score."}
          </div>
        ) : (
          status.events.map((e, i) => (
            <div
              key={`${e.at}-${i}`}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                padding: "6px 16px",
                borderBottom: "1px solid var(--zs-border)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
              }}
            >
              <span style={{ color: "var(--zs-fg-muted)", minWidth: 64 }}>{fmtTime(e.at)}</span>
              <Tag tone={KIND_TONE[e.kind]}>{KIND_LABEL[e.kind]}</Tag>
              <span style={{ color: "var(--zs-fg)" }}>{e.message}</span>
            </div>
          ))
        )}
      </div>
    </Block>
  );
}
