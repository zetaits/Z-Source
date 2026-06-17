# Handoff: Multi-Sport Support (Sport Registry + Rail Switcher)

## Overview
The app is currently football-only. This handoff adds first-class support for **multiple sports** (Football, Basketball, Baseball, Tennis, … extensible to any number) and a UI to switch between them.

The core idea is **NOT** "a sport filter." Switching sport changes the entire working context — markets, terminology, leagues, the engine feed. So it is modeled as a **workspace switch**, presented as a thin vertical **Sport Rail** to the left of the existing nav sidebar (Bloomberg-terminal pattern).

The whole feature is driven by a single **sport registry** so the client can add a new sport by appending one config object — no UI rework.

---

## About the Design Files
The files in `prototype/` are **design references created in HTML/React-via-Babel** — they show intended look and behavior, they are **not production code to copy verbatim**. The task is to **recreate this design inside the real Z-Source codebase** using its existing framework, component patterns, state management, and styling conventions.

The prototype reuses the project's real design tokens (`prototype/tokens.css`), so colors/typography/spacing are already production-accurate — match them exactly.

Files:
- `prototype/Multi-Sport Switcher.html` — runnable prototype (open in a browser).
- `prototype/sports.js` — **the sport registry** (`window.SPORTS_DATA`). This is the single most important file — port this data shape.
- `prototype/switcher-app.jsx` — contains `SportRail`, `SPORT_ICONS`, and a sport-aware demo shell. Port `SportRail` and `SPORT_ICONS`; the rest (NavSidebar/TopBar/ScannerView/PlacementControl) is demo scaffolding to show context — you already have the real equivalents.
- `prototype/tokens.css` — the real design system tokens (reference only; already in the app).

## Fidelity
**High-fidelity.** Final colors, typography, spacing, icons, and interactions. Recreate the rail pixel-accurately using the existing token variables. Only the *placement control* (bottom-right panel) is a throwaway comparison tool — do **not** ship it.

---

## The Core: Sport Registry

Define sports as data. To add a sport later, the client appends one object — it propagates to the rail, headers, market chips, table labels, and terminology automatically.

Recommended TypeScript shape (port from `prototype/sports.js`):

```ts
interface Sport {
  id: string;            // stable key, e.g. 'basketball'
  mono: string;          // 2-letter fallback shown when no icon exists, e.g. 'BK'
  label: string;         // display name, e.g. 'Basketball'
  code: string;          // short feed/league tag shown under the icon, e.g. 'NBA'
  enabled: boolean;      // false → parked "coming soon" (greyed, not clickable)
  live: boolean;         // true → green live dot on the rail tile
  unit: string;          // domain noun: 'fixtures' | 'games' | 'matches'
  eventLabel: string;    // contest start term: 'kickoff' | 'tip-off' | 'first pitch' | 'on court'
  nextLabel: string;     // 'next whistle' | 'next tip' | …
  competitions: string;  // league list string for the sidebar/header
  markets: string[];     // sport-specific market chips, e.g. ['SPREAD','TOTAL','MONEYLINE',...]
  // fixtures/games: comes from the real engine feed, keyed by sport — not hardcoded
}
```

The registry order = rail order. `enabled: false` keeps a sport visible as "coming soon" without removing it (see the `amfootball`/NFL entry in the prototype).

### Why per-sport `unit` / `eventLabel` / `markets` matter
The same screen must re-label itself per sport:
- Football → "fixtures", "kickoff", markets `1X2 / ASIAN HCAP / TOTALS / BTTS …`
- Basketball → "games", "tip-off", markets `SPREAD / TOTAL / MONEYLINE …`
- Baseball → "games", "first pitch", markets `MONEYLINE / RUN LINE / TOTAL / F5 …`
- Tennis → "matches", "on court", markets `MONEYLINE / SET HCAP / TOTAL GAMES …`

Read these from the active sport's config rather than hardcoding football terms.

---

## Screens / Views

### Sport Rail (the new component)
- **Purpose:** switch the active sport / workspace; always visible.
- **Placement:** fixed vertical column, flush-left, **before** the existing nav sidebar. Both are `position: sticky; top: 0; height: 100vh`. New layout: `[ Rail 70px ][ NavSidebar 232px ][ main flex:1 ]`.
- **Width:** `70px` (`flex: 0 0 70px`). Background `var(--bg)`, right border `1px solid var(--border)`.
- **Vertical structure (top → bottom):**
  1. **Brand mark** — 46px tall (matches topbar height), bottom border `1px solid var(--border)`. A 30×30 amber square (`var(--accent)` bg, `var(--bg)` text) with a bold "Z" in `var(--font-display)` 900.
  2. **"SPORT" caption** — `var(--font-mono)`, 8px, `var(--fg-muted)`, letter-spacing `0.18em`, padding `12px 0 6px`.
  3. **Scrollable sport list** (`.zs-scroll`, `overflow:auto`, column, `gap: 3px`) — one tile per sport.
  4. **"+" add-sport button** — full width, top border, `var(--fg-muted)`, 18px. Hover → `var(--accent)` text on `var(--accent-fill)` bg.

#### Sport tile (per sport)
- Button: width 58px, padding `8px 0 6px`, column, centered, `gap: 5px`. Disabled (`enabled:false`) → `opacity: 0.34`, `cursor: not-allowed`.
- **Active spine:** 2px-wide bar, absolutely positioned at `left: 0`, `top/bottom: 6px`; `var(--accent)` when active else transparent. Transition `120ms var(--ease-snap)`.
- **Icon tile:** 40×40, `1px solid` border, centered icon.
  - Inactive: bg `var(--surface)`, border `var(--border-hot)`, icon color `var(--fg-dim)`.
  - Active: bg `var(--accent)`, border `var(--accent)`, icon color `var(--bg)` (inverted).
  - Hover (inactive): border → `var(--accent)`, icon color → `var(--fg)`.
  - Transitions: color/background/border-color `120ms var(--ease-snap)`.
- **Code label:** below tile, `var(--font-mono)` 8px, letter-spacing `0.08em`, uppercase. Active → `var(--accent)` + weight 700; else `var(--fg-muted)` + weight 500.
- **Live dot:** if `live && enabled`, a 5×5 square absolutely positioned `top:9px right:9px`. Active → `var(--bg)` color + pulse animation (`.zs-pulse`); else `var(--pos)` (green).

### Existing screens — make them sport-aware
- **Nav sidebar:** the brand header subtitle and the "FIXTURES·LIVE" item label should read from `sport.code` / `sport.unit` (e.g. "GAMES·LIVE" for basketball). Footer feed line shows the sport's first competition.
- **Top bar:** search placeholder reads "search {sport.unit}, rules, markets…".
- **Scanner / content:** heading title = `sport.label`, subtitle = `sport.competitions`; the market chip row renders `sport.markets`; table column header uses `sport.eventLabel`; empty state for a not-yet-enabled feed.

---

## Sport Icons (monoline glyphs)

Icons are **monoline SVG** matching the brutalist terminal aesthetic: `viewBox 0 0 24 24`, `fill:none`, `stroke: currentColor`, `stroke-width: 1.5`, `stroke-linecap: square`, `stroke-linejoin: miter`. Rendered at 22×22 inside the 40px tile. `currentColor` makes them invert automatically in the active state.

**Scalability rule (important):** icons live in a separate map keyed by `sport.id`, decoupled from the registry data. **If a sport has no icon entry, the tile falls back to its 2-letter `mono`.** So adding a sport never breaks the rail; giving it an icon later is a 4-line addition.

The five glyph paths (soccer ball w/ pentagon, basketball seams, baseball stitching, tennis curves, am-football w/ laces) are in `SPORT_ICONS` in `prototype/switcher-app.jsx` — copy them verbatim. If your codebase uses an icon library, you may swap in equivalent monoline icons, but keep the 1.5px square-cap monochrome style so they read as a set.

---

## Interactions & Behavior
- **Click a tile** → set active sport; entire content context re-renders from that sport's config (use a key on the content root so it remounts, giving the `.zs-page-enter` entrance animation).
- **Keyboard:** `[` and `]` cycle to previous/next **enabled** sport (skip parked ones). Ignore when focus is in an input.
- **Disabled sports** (`enabled:false`) are not clickable and show a "coming soon" tooltip.
- **Add sport "+"** → in the real app this should route to wherever sport onboarding/config lives (or be hidden if not applicable).
- **Persist** the active sport (e.g. localStorage or route param `/sport/:id`) so reloads keep context. A route segment is preferable — it makes sport deep-linkable.

## State Management
- `activeSportId: string` — the selected sport. Lift to wherever your global app state lives (context/store/router). Most screens read `const sport = SPORTS.find(s => s.id === activeSportId)`.
- Fixtures/games/markets data must be **fetched per sport** from the engine, keyed by `sport.id`. The prototype hardcodes sample fixtures only to demonstrate the re-labeling.

---

## Design Tokens (all already in `tokens.css`)
- **Surfaces:** `--bg #0a0907`, `--bg-2 #121110`, `--surface #1a1814`, `--surface-2 #221f1a`
- **Borders:** `--border #2a2620`, `--border-hot #3d362c`, `--rule #15130f`
- **Text:** `--fg`, `--fg-dim #a89e84`, `--fg-muted #6b6150`, `--fg-faint #443e33`
- **Signal:** `--accent` (amber, primary), `--accent-fill`, `--pos` (green, live/play)
- **Type:** `--font-display: 'Archivo'`, `--font-mono: 'JetBrains Mono'`
- **Motion:** `--ease-snap` (use for tile state transitions), `.zs-pulse` (live dot), `.zs-page-enter` (content remount)
- **Rail-specific sizes:** rail 70px · tile 40×40 · icon 22px · spine 2px · code label 8px · live dot 5px

## Assets
No external assets. Icons are inline SVG (in `switcher-app.jsx`). Fonts (Archivo, JetBrains Mono) are already loaded by the app.

## Placement alternatives (already evaluated — Rail chosen)
The prototype also contains `SportDropdown` (sidebar-header dropdown) and `SportTabs` (topbar segmented tabs) behind the bottom-right placement control, kept only as a record of the comparison. **Ship the Rail.** Discard the placement control.

---

## Implementation checklist
1. Create the sport registry (port `sports.js` → your data layer / config).
2. Build the `SportRail` component from the spec above, using existing token vars.
3. Add the `SPORT_ICONS` map with mono-letter fallback.
4. Insert the rail into the app shell left of the nav sidebar; adjust the grid/flex.
5. Make sidebar / topbar / scanner read terminology + markets from the active sport.
6. Wire `activeSportId` into global state; fetch feed data per sport.
7. Persist active sport (route param preferred).
8. Keyboard `[` / `]` cycling among enabled sports.
