// Post-/pre-game result fetches for the autopilot loop. Separate from
// statsapiData.ts (the analysis feed) because these are settle-time concerns:
//   - game timing + state, to decide WHEN to capture the closing line and WHEN
//     the box score is final, and
//   - a pitcher's realised strikeouts from the final box score, to auto-settle.
// Both degrade gracefully: on HTTP/parse failure they console.warn and return
// undefined, so the autopilot just retries on its next tick.

import { z } from "zod";
import { httpRequest } from "@/services/http/httpClient";

const STATSAPI_BASE = "https://statsapi.mlb.com/api/v1";
const STATSAPI_RPS = 2;
const ACCEPT_JSON = { Accept: "application/json" };

const num = (v: unknown): number => parseFloat(String(v ?? ""));

/** Coarse game state, mapped from statsapi `status.abstractGameState`. */
export type GameState = "preview" | "live" | "final" | "other";

export interface GameTiming {
  /** Scheduled first-pitch time (ISO), when statsapi provides it. */
  startTime?: string;
  state: GameState;
}

const timingSchema = z
  .object({
    dates: z
      .array(
        z.object({
          games: z
            .array(
              z.object({
                gamePk: z.union([z.number(), z.string()]).optional(),
                gameDate: z.string().optional(),
                status: z
                  .object({ abstractGameState: z.string().optional() })
                  .optional(),
              }),
            )
            .optional(),
        }),
      )
      .optional(),
  })
  .passthrough();

const mapState = (raw: string | undefined): GameState => {
  switch (raw) {
    case "Preview":
      return "preview";
    case "Live":
      return "live";
    case "Final":
      return "final";
    default:
      return "other";
  }
};

/**
 * Scheduled start time + coarse state for one game. The schedule endpoint
 * returns `gameDate` (ISO first pitch) and `status.abstractGameState` by
 * default — one cheap call backs both the close-snapshot trigger (start - N
 * min) and the settle trigger (state === "final").
 */
export const getGameTiming = async (
  gamePk: number,
  date: string,
  signal?: AbortSignal,
): Promise<GameTiming | undefined> => {
  const url = `${STATSAPI_BASE}/schedule?sportId=1&date=${date}&gamePk=${gamePk}`;
  try {
    const res = await httpRequest({ url, rps: STATSAPI_RPS, headers: ACCEPT_JSON, signal });
    const parsed = timingSchema.safeParse(await res.json());
    if (!parsed.success) return undefined;
    const games = (parsed.data.dates ?? []).flatMap((d) => d.games ?? []);
    const game = games.find((g) => Number(g.gamePk) === gamePk) ?? games[0];
    if (!game) return undefined;
    return { startTime: game.gameDate, state: mapState(game.status?.abstractGameState) };
  } catch (err) {
    console.warn("[mlb-statsapi] game timing fetch failed", err);
    return undefined;
  }
};

// ---------------------------------------------------------------------------
// Final box score: a pitcher's realised strikeouts. Box score keys players as
// `ID{playerId}` under each team; pitching.strikeOuts is the realised K count.
// ---------------------------------------------------------------------------
const boxPlayerSchema = z
  .object({
    stats: z
      .object({
        pitching: z.object({ strikeOuts: z.union([z.number(), z.string()]).optional() }).optional(),
      })
      .optional(),
  })
  .passthrough();

const boxscoreSchema = z
  .object({
    teams: z
      .object({
        home: z.object({ players: z.record(boxPlayerSchema).optional() }).optional(),
        away: z.object({ players: z.record(boxPlayerSchema).optional() }).optional(),
      })
      .optional(),
  })
  .passthrough();

/**
 * A pitcher's realised strikeouts from the final box score, or undefined if the
 * game/pitcher isn't found or hasn't recorded a pitching line yet. Caller should
 * gate on getGameTiming state === "final" before trusting this as the result.
 */
export const getPitcherFinalKs = async (
  gamePk: number,
  pitcherId: number,
  signal?: AbortSignal,
): Promise<number | undefined> => {
  const url = `${STATSAPI_BASE}/game/${gamePk}/boxscore`;
  try {
    const res = await httpRequest({ url, rps: STATSAPI_RPS, headers: ACCEPT_JSON, signal });
    const parsed = boxscoreSchema.safeParse(await res.json());
    if (!parsed.success) return undefined;
    const key = `ID${pitcherId}`;
    const sides = [parsed.data.teams?.home, parsed.data.teams?.away];
    for (const side of sides) {
      const player = side?.players?.[key];
      const ks = player?.stats?.pitching?.strikeOuts;
      if (ks != null) {
        const n = num(ks);
        if (Number.isFinite(n)) return n;
      }
    }
    return undefined;
  } catch (err) {
    console.warn("[mlb-statsapi] boxscore fetch failed", err);
    return undefined;
  }
};
