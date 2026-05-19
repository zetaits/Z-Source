import type { Verdict as PlayVerdict } from "@/domain/play";

export type VerdictKind = PlayVerdict | "WON" | "LOST";

interface Props {
  v: VerdictKind;
  big?: boolean;
}

const STYLES: Record<VerdictKind, { c: string; glyph: string }> = {
  STRONG: { c: "var(--zs-pos)",      glyph: "▲▲" },
  PLAY:   { c: "var(--zs-pos)",      glyph: "▲" },
  LEAN:   { c: "var(--zs-accent)",   glyph: "◆" },
  PASS:   { c: "var(--zs-fg-muted)", glyph: "▽" },
  LOST:   { c: "var(--zs-neg)",      glyph: "×" },
  WON:    { c: "var(--zs-pos)",      glyph: "✓" },
};

export function Verdict({ v, big = false }: Props) {
  const s = STYLES[v] ?? STYLES.PASS;
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: big ? "13px" : "11px",
        fontWeight: 700,
        letterSpacing: "0.10em",
        color: s.c,
        display: "inline-flex",
        gap: "6px",
        alignItems: "center",
        padding: big ? "4px 10px" : "2px 7px",
        border: `1px solid ${s.c}`,
        background: "transparent",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: big ? "11px" : "9px" }}>{s.glyph}</span>
      {v}
    </span>
  );
}
