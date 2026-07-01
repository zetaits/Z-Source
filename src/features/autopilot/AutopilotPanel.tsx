// Bankroll-page control + activity readout for the multi-sport autopilot. The
// loop runs in the AppShell-level provider; this panel toggles it (master + per
// sport) and shows what it has done, filterable by sport. Terminal-flavoured.

import { useMemo, useState } from "react";
import { Block, Tag } from "@/components/zs";
import type { TagTone } from "@/components/zs";
import { useAutopilotContext } from "./AutopilotContext";
import type { AutopilotEventKind } from "./useAutopilot";

const KIND_TONE: Record<AutopilotEventKind, TagTone> = {
  log: "pos",
  close: "amber",
  settle: "info",
  info: "default",
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

const toggleBtn = {
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
} as const;

export function AutopilotPanel() {
  const { enabled, setEnabled, sports, setSportEnabled, status } = useAutopilotContext();
  const [filter, setFilter] = useState<string>("ALL");

  const events = useMemo(
    () => (filter === "ALL" ? status.events : status.events.filter((e) => e.sport === filter)),
    [status.events, filter],
  );

  const filters = ["ALL", ...sports.map((s) => s.label)];

  return (
    <Block
      head="AUTOPILOT"
      headRight={
        <button type="button" onClick={() => setEnabled(!enabled)} style={toggleBtn}>
          <Tag tone={enabled ? "pos" : "default"}>{enabled ? "● ON" : "○ OFF"}</Tag>
        </button>
      }
      pad={false}
    >
      {/* Per-sport execution toggles + status line */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          borderBottom: "1px solid var(--zs-border)",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.06em",
          color: "var(--zs-fg-muted)",
        }}
      >
        <span style={{ color: "var(--zs-fg)" }}>SPORTS</span>
        {sports.map((s) => (
          <button key={s.sportId} type="button" onClick={() => setSportEnabled(s.sportId, !s.enabled)} style={toggleBtn}>
            <Tag tone={s.enabled ? "pos" : "default"}>
              {s.enabled ? "●" : "○"} {s.label}
            </Tag>
          </button>
        ))}
        <span style={{ marginLeft: "auto" }}>
          {status.running ? "TICK RUNNING…" : `LAST ${fmtTime(status.lastTickAt)}`}
        </span>
        <span>WATCHING {status.watching}</span>
        <span>{enabled ? "60s LOOP" : "DISABLED"}</span>
      </div>

      {/* Activity filter tabs */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "8px 16px",
          borderBottom: "1px solid var(--zs-border)",
        }}
      >
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={filter === f ? "pill pill-info" : "pill pill-ghost"}
            style={{ cursor: "pointer" }}
          >
            {f}
          </button>
        ))}
      </div>

      <div style={{ maxHeight: 240, overflow: "auto" }} className="zs-scroll">
        {events.length === 0 ? (
          <div style={{ padding: 16, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--zs-fg-muted)" }}>
            {enabled
              ? "Armed. Logs threshold plays, captures the Bet365 close, and settles hands-off — per enabled sport."
              : "Off. Turn ON to auto-log picks, capture closing odds, and settle across enabled sports."}
          </div>
        ) : (
          events.map((e, i) => (
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
              <Tag tone="default">{e.sport}</Tag>
              <Tag tone={KIND_TONE[e.kind]}>{KIND_LABEL[e.kind]}</Tag>
              <span style={{ color: "var(--zs-fg)" }}>{e.message}</span>
            </div>
          ))
        )}
      </div>
    </Block>
  );
}
