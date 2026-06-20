// Baseball domain types — Phase-1 data layer for MLB strikeout analysis.
// Plain interfaces (no branded ids: MLBAM player/game ids are raw numbers,
// shared across statsapi and Baseball Savant). Every field a downstream model
// needs lands here; providers populate these from statsapi/Savant payloads.

export type Handedness = "L" | "R";
export type BatSide = "L" | "R" | "S"; // S = switch hitter
export type DayNight = "day" | "night";

export interface ProbablePitcher {
  playerId: number; // MLBAM
  name: string;
  teamSide: "home" | "away";
  throws?: Handedness; // from /people bio; undefined until enriched
}

export interface PitcherSeasonStats {
  playerId: number;
  season: number;
  gamesStarted: number;
  gamesPlayed: number;
  inningsPitched: number; // parseFloat of "158.0"
  battersFaced: number;
  strikeouts: number;
  kPct: number; // computed strikeouts / battersFaced (0..1); 0 if BF=0
  kPer9: number; // parseFloat strikeoutsPer9Inn
  strikePct: number; // parseFloat strikePercentage (".650" -> 0.65)
  numberOfPitches?: number;
}

export interface PitcherGameLog {
  gamePk: number;
  date: string; // "2025-03-31"
  isHome: boolean;
  opponentName?: string;
  inningsPitched: number; // parseFloat
  battersFaced: number;
  strikeouts: number;
  pitches?: number; // stat.numberOfPitches
  gamesStarted: number; // 1 = start, 0 = relief
}

export interface SavantPitcherProfile {
  playerId: number;
  season: number;
  kPct?: number; // CSV k_percent (e.g. 16.7) /100 -> 0.167
  whiffPct?: number; // whiff_percent /100
  cswPct?: number; // csw_percent /100 — often empty -> undefined
  oSwingPct?: number; // o_swing_percent /100 — often empty -> undefined
  zSwingPct?: number; // z_swing_percent /100
}

export interface LineupSlot {
  battingOrder: number; // 1..9, derived from array index + 1
  playerId: number;
  name: string;
  position?: string; // primaryPosition.abbreviation
  bats?: BatSide; // enriched separately; undefined until /people fetched
}

export interface Lineup {
  gamePk: number;
  home: LineupSlot[]; // empty array if not yet confirmed
  away: LineupSlot[];
  confirmed: boolean; // false when lineups key absent
}

export interface BatterKSplits {
  playerId: number;
  season: number;
  kPctVsL?: number; // 0..1, strikeOuts/plateAppearances for sitCode "vl"
  kPctVsR?: number; // for sitCode "vr"
  paVsL?: number; // sample size, for confidence weighting
  paVsR?: number;
}

export interface GameContext {
  gamePk: number;
  venueId?: number;
  venueName?: string;
  dayNight?: DayNight;
  weather?: { tempF?: number; condition?: string; wind?: string }; // absent for future games
}
