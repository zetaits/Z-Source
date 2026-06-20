# Handoff: Multi-Sport Support (Sport Registry + Scanner "Fixture Board")

## Goal
The app is football-only today. Add first-class support for **multiple sports**
(Football, Basketball, Baseball, Tennis, … any number) so the user can pick the
sport they're analysing and add new sports later with near-zero work.

## The one key decision
**Sport is a scope that belongs to the Scanner — not a global app mode.**
Only the **Scanner** is sport-specific (it's where you pick fixtures to analyse).
Every other view — Command, Match·Live, Bankroll, Metrics, Strategy, Settings —
is account-wide and must NOT show a sport selector or change with the sport.

Therefore:
- The **left nav stays exactly as it is** (real order: WORK ▸ Command/Scanner/Match·Live,
  PERFORMANCE ▸ Bankroll/Metrics/Strategy, CFG ▸ Settings). Do not add sport state to it.
- The **sport selector lives inside the Scanner** as its primary control
  ("Analysis Desk"). Nothing about sport leaks into the global chrome.

This was decided after rejecting a global sport rail (it wrongly implied every
screen was sport-scoped) — do not reintroduce a global sport switcher.

---

## About the prototype files (`prototype/`)
HTML/React-via-Babel **design references** — intended look & behaviour, NOT
production code to paste. Recreate this in the real Z-Source codebase using its
framework, component patterns, data layer, and styling. The prototype already
uses the real design tokens (`prototype/tokens.css`), so colours/type/spacing are
production-accurate — match them exactly.

| File | Port this |
|---|---|
| `prototype/sports.js` | **The sport registry** (`window.SPORTS_DATA`). The single most important artefact — port this data shape into your config/data layer. |
| `prototype/scanner.jsx` | `DeskSelector`, `NextUp`, `LeagueGroup`, `EdgeMeter`, `StatusTag`, `Scanner`. The whole Fixture Board. |
| `prototype/chrome.jsx` | `SPORT_ICONS` + `SportGlyph` (icon w/ fallback). The `Sidebar`/`TopBar`/`Ticker` here just mirror your existing shell for context — you already have the real ones; only the icons need porting. |
| `prototype/tokens.css` | Real tokens (reference; already in app). |

Open `prototype/Multi-Sport Scanner.html` to run it. Keyboard `[` / `]` cycle sports (only while on the Scanner).

**Fidelity:** high. Final colours, type, spacing, icons, interactions.

---

## 1) Sport registry (the scalable core)
Sports are data. Adding a sport = appending one object → it appears in the desk
selector, eyebrow, terminology and grouping automatically. `enabled:false` parks
a sport as "coming soon" (greyed, not clickable — see the `amfootball`/NFL entry).

```ts
interface Sport {
  id: string;            // stable key, e.g. 'basketball'
  mono: string;          // 2-letter fallback when no icon exists, e.g. 'BK'
  label: string;         // 'Basketball'
  code: string;          // short league tag under the name, e.g. 'NBA'
  enabled: boolean;      // false → "coming soon"
  live: boolean;         // green live dot on the desk
  unit: string;          // domain noun: 'fixtures' | 'games' | 'matches'
  eventLabel: string;    // 'kickoff' | 'tip-off' | 'first pitch' | 'on court'
  nextLabel: string;     // 'next whistle' | 'next tip' | …
  competitions: string;  // league list (context only)
  markets: string[];     // sport's markets — METADATA used by the ANALYSIS view,
                         //   NOT rendered on the Scanner (see note below)
}
```
Per-sport terminology (`unit`, `eventLabel`, `nextLabel`) is read everywhere the
Scanner shows nouns, so the board re-labels itself: football "fixtures / kickoff",
basketball "games / tip-off", baseball "games / first pitch", tennis "matches / on court".

**Fixtures** come from the engine feed keyed by `sport.id`. The prototype hardcodes
samples only to demonstrate layout. Fixture shape used by the board:
```ts
interface Fixture {
  time: string;          // "20:30"
  mins: number;          // minutes until kickoff; <0 = started/over → drives countdown & "next up"
  status: 'SCHEDULED' | 'LIVE' | 'FT';
  comp: string;          // competition/league — fixtures are GROUPED by this
  a: string; b: string;  // team/player names
  aS: string; bS: string;// short codes (badges)
  edge: number;          // pre-analysis projected best edge % (0 = none/PASS) — see §4
  picks: number;         // # of +EV markets the model flagged
  verdict: 'PLAY' | 'LEAN' | 'PASS';
}
```

---

## 2) Sport icons (monoline) — with mandatory fallback
Monoline SVG matching the terminal look: `viewBox 0 0 24 24`, `fill:none`,
`stroke:currentColor`, `stroke-width:1.5`, `stroke-linecap:square`,
`stroke-linejoin:miter`. `currentColor` makes them invert in the active state.

Icons live in a **separate map keyed by `sport.id`** (`SPORT_ICONS`), decoupled
from the registry. **If a sport has no icon entry, `SportGlyph` renders its 2-letter
`mono` instead** — so adding a sport never breaks the UI; giving it an icon later is
a 4-line addition. Copy the five glyph paths from `chrome.jsx` verbatim (or swap your
own icon set, but keep the 1.5px square-cap monochrome style so they read as a family).

---

## 3) The Scanner = "Fixture Board"
Layout, top → bottom:

**a) Header**
- Eyebrow `[ SCANNER · {SPORT} · 72H WINDOW ]` (amber, mono, tracked).
- Title `Fixture Board` (Archivo 800, ~34px).
- Subtitle: `{weekday date} · {N} {unit} · {nextLabel} in {countdown}` — all real, derived.
- Right: `↻ REFRESH` (re-fetches / replays load) and `LEAGUES →` (opens league management). Keep both.

**b) Analysis Desk — the sport selector** (`DeskSelector`)
- Bordered strip. Header row: left `ANALYSIS DESK`; right a true aggregate
  `{total} live edges · {n} sports active` (sum of edges across enabled sports —
  genuinely useful: shows where the action is).
- Horizontal row of **desk tabs**, one per sport, **horizontally scrollable** (scales):
  - `SportGlyph` (icon, or mono fallback) + name (Archivo 700) + `{code} · {n} edges`.
  - Active: amber top-border (2px) + `--surface` fill + amber text + filled icon — visually
    continuous with the content below.
  - Live sports show a pulsing dot. Disabled (`enabled:false`) → 40% opacity, `· SOON`, not clickable.
  - Trailing `+ ADD` cell to onboard a sport (route to sport config in the real app).
- `n edges` per desk = fixtures with `verdict !== 'PASS'`.

**c) NEXT UP** (`NextUp`) — kept because it looks good and fills the top nicely.
The soonest `SCHEDULED` fixture for the active sport (fallback: first `LIVE`),
in an amber-outlined bar: `▸ NEXT UP` badge + matchup + (best edge) + league +
`time · in {countdown}` + `ANALYSE →`. Hidden if no upcoming fixture.

**d) Filter / sort bar** (functional)
- `STATUS` segmented: `ALL · SCHEDULED · LIVE · FT` (filters the board).
- `SORT` toggle: `KICKOFF ↑` ⇄ `BEST EDGE ↓`.
- Right: `SHOWING {n}`.

**e) Fixtures GROUPED BY LEAGUE** (`LeagueGroup`) — this matches production:
fixtures are **grouped under a competition header**, NOT shown with a league column.
- Group header: corner mark `▛` + small sport glyph + `COMP NAME`; right
  `{n} {UNIT} · {firstTime}–{lastTime}`.
- Each fixture **row** (flex, not a table):
  `[time + countdown]  [matchup w/ code badges]  [BEST EDGE]  [verdict]  [status]  [ANALYSE →]`
  - `FT` rows are dimmed (opacity ~0.5) and show `SETTLED` instead of a verdict.
  - `LIVE` status pulses green.
- Empty state per filter / disabled sport.

> **Markets are intentionally NOT on the Scanner.** The Scanner is triage —
> you pick a fixture to analyse; you do not browse or sort by market here. Market
> selection happens in the analysis view. (An earlier draft had a market-chips row;
> it was removed as incoherent.) Keep `markets[]` in the registry as metadata for
> the analysis screen.

---

## 4) "Best edge" — note on semantics (the user wants this kept)
Production does not yet show a best edge on the Scanner because picks only exist
*after* analysis. The user likes surfacing it anyway, so: **`edge` here is the
model's PRE-analysis projected best edge** (top-of-book estimate) used purely to
prioritise what to open. The full picks/markets/lines still appear only after
`ANALYSE`. Render it as a small magnitude bar + `+x.xx%` (green); show `—` when
there's no edge or the fixture is `FT`. If a true pre-analysis estimate isn't
available from the engine, this column can fall back to `—` without breaking layout.

---

## 5) State & behaviour
- `activeSportId` — lives in the Scanner's scope (or a route param `…/scanner/:sport`
  to make it deep-linkable + survive reload). Do NOT lift it to global app chrome.
- Scanner-local UI state: `status` filter, `sort`.
- Keyboard `[` / `]` cycle enabled sports — **only when the Scanner is active**.
- Fixtures fetched per sport from the engine, keyed by `sport.id`.

## 6) Tokens (already in `tokens.css`)
Surfaces `--bg / --bg-2 / --surface / --surface-2`; borders `--border / --border-hot / --rule`;
text `--fg / --fg-dim / --fg-muted / --fg-faint`; signal `--accent` (amber) / `--accent-fill` / `--pos` (green);
type `--font-display: Archivo`, `--font-mono: JetBrains Mono`; motion `--ease-snap`, `.zs-pulse`, `.zs-page-enter`.
Reuse existing `.zs-block`, `.zs-block-head`, `.zs-nav-item`, `.zs-kbd`, `.zs-ticker`.

## 7) Assets
None external. Icons are inline SVG. Fonts already loaded by the app.

---

## Implementation checklist
1. Port the **sport registry** (`sports.js`) into your config/data layer; type it.
2. Add `SPORT_ICONS` + a `SportGlyph` component with mono-letter fallback.
3. Build `DeskSelector` (horizontal, scrollable, edge counts, add-sport, disabled state).
4. Refactor the Scanner into the **Fixture Board**: header (+ refresh/leagues),
   desk selector, Next Up, status/sort bar, **league-grouped** rows with best-edge,
   verdict, status, analyse.
5. Wire `activeSportId` into Scanner scope (prefer a route param); fetch fixtures per sport.
6. `[` / `]` sport cycling, scoped to the Scanner.
7. Leave all other views (and the global nav) untouched — they stay account-wide.
8. Keep `markets[]` for the analysis view; do not render market chips on the Scanner.
