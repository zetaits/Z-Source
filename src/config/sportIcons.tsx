// ============================================================================
// Z-SOURCE — SPORT ICONS (monoline glyphs)
// ----------------------------------------------------------------------------
// Brutalist terminal aesthetic: 24×24 viewBox, fill:none, stroke:currentColor,
// 1.5px square caps. `currentColor` makes them invert automatically in the
// active (amber-filled) state.
//
// SCALABILITY: keyed by `sport.id`, DECOUPLED from the registry data. A sport
// with no entry here automatically falls back to its 2-letter `mono` (see
// SportGlyph), so adding a sport never breaks the UI. Each entry is a render
// function taking a pixel size, so the same glyph scales from an 18px league
// header tile to a 38px desk tab.
// ============================================================================

import type { ReactNode } from "react";

function Svg({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      {children}
    </svg>
  );
}

export type SportIcon = (size: number) => ReactNode;

export const SPORT_ICONS: Record<string, SportIcon> = {
  football: (s) => (
    <Svg size={s}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8.8 L15.04 11.01 L13.88 14.59 L10.12 14.59 L8.96 11.01 Z" />
      <path d="M12 8.8 L12 3.2 M15.04 11.01 L20.4 9.2 M13.88 14.59 L17.1 19.2 M10.12 14.59 L6.9 19.2 M8.96 11.01 L3.6 9.2" />
    </Svg>
  ),
  basketball: (s) => (
    <Svg size={s}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3 L12 21 M3 12 L21 12" />
      <path d="M12 3 Q4 12 12 21 M12 3 Q20 12 12 21" />
    </Svg>
  ),
  baseball: (s) => (
    <Svg size={s}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.4 3.7 Q4 12 8.4 20.3" />
      <path d="M15.6 3.7 Q20 12 15.6 20.3" />
      <path d="M6.4 8 L7.9 8.6 M6 11.5 L7.6 11.7 M6 14.5 L7.6 14.3 M6.6 17.5 L8 16.9" />
      <path d="M17.6 8 L16.1 8.6 M18 11.5 L16.4 11.7 M18 14.5 L16.4 14.3 M17.4 17.5 L16 16.9" />
    </Svg>
  ),
  tennis: (s) => (
    <Svg size={s}>
      <circle cx="12" cy="12" r="9" />
      <path d="M5 7 Q12 11.5 19 7" />
      <path d="M5 17 Q12 12.5 19 17" />
    </Svg>
  ),
  amfootball: (s) => (
    <Svg size={s}>
      <path d="M4 12 Q4 6.5 12 6.5 Q20 6.5 20 12 Q20 17.5 12 17.5 Q4 17.5 4 12 Z" />
      <path d="M12 9.4 L12 14.6" />
      <path d="M10.4 10.6 L13.6 10.6 M10.4 12 L13.6 12 M10.4 13.4 L13.6 13.4" />
      <path d="M5.6 10.6 L5.6 13.4 M18.4 10.6 L18.4 13.4" />
    </Svg>
  ),
};
