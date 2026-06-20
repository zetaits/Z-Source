import type { CSSProperties } from "react";
import { SPORT_ICONS } from "@/config/sportIcons";
import type { Sport } from "@/config/sports";

// ============================================================================
// SPORT GLYPH — icon tile with MANDATORY mono-letter fallback.
// ----------------------------------------------------------------------------
// Icons live in SPORT_ICONS, keyed by sport.id and DECOUPLED from the registry.
// If a sport has no icon entry, we render its 2-letter `mono` instead — so
// adding a sport never breaks the UI; giving it an icon later is a 4-line edit.
// `currentColor` in the SVGs makes them invert automatically in the active tile.
// ============================================================================

interface Props {
  sport: Pick<Sport, "id" | "mono">;
  /** Tile edge length in px. */
  size?: number;
  /** Rendered SVG size in px (defaults to ~60% of the tile). */
  iconSize?: number;
  /** Active = amber fill + inverted glyph. */
  active?: boolean;
  /** Transparent tile (for headers sitting on a surface). */
  ghost?: boolean;
}

export function SportGlyph({
  sport,
  size = 32,
  iconSize,
  active = false,
  ghost = false,
}: Props) {
  const icon = SPORT_ICONS[sport.id];
  const svg = iconSize ?? Math.round(size * 0.6);
  const style: CSSProperties = {
    width: size,
    height: size,
    flex: `0 0 ${size}px`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid",
    borderColor: active ? "var(--zs-accent)" : "var(--zs-border-bright)",
    background: active ? "var(--zs-accent)" : ghost ? "transparent" : "var(--zs-surface)",
    color: active ? "var(--zs-bg)" : "var(--zs-fg-dim)",
    fontFamily: "var(--font-mono)",
    fontWeight: 700,
    fontSize: Math.round(size * 0.36),
    transition:
      "color 140ms var(--ease-snap), background 140ms var(--ease-snap), border-color 140ms var(--ease-snap)",
  };
  return (
    <span style={style} aria-hidden>
      {icon ? icon(svg) : sport.mono}
    </span>
  );
}
