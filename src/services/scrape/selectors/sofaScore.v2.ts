import { z } from "zod";
import { SOFA_API_BASE, sofaEventSchema, type SofaEvent } from "./sofaScore.v1";

export const teamEventsLastUrl = (teamId: number, page = 0): string =>
  `${SOFA_API_BASE}/team/${teamId}/events/last/${page}`;

export const teamEventsNextUrl = (teamId: number, page = 0): string =>
  `${SOFA_API_BASE}/team/${teamId}/events/next/${page}`;

export const teamInfoUrl = (teamId: number): string =>
  `${SOFA_API_BASE}/team/${teamId}`;

export const sofaEventWithScoreSchema = sofaEventSchema.extend({
  homeScore: z
    .object({ current: z.number().optional(), display: z.number().optional() })
    .partial()
    .optional(),
  awayScore: z
    .object({ current: z.number().optional(), display: z.number().optional() })
    .partial()
    .optional(),
});

export type SofaEventWithScore = z.infer<typeof sofaEventWithScoreSchema>;

export const sofaTeamEventsResponseSchema = z.object({
  events: z.array(sofaEventWithScoreSchema),
  hasNextPage: z.boolean().optional(),
});

export const readScore = (
  s: SofaEventWithScore["homeScore"] | SofaEventWithScore["awayScore"],
): number | null => {
  if (!s) return null;
  if (typeof s.current === "number") return s.current;
  if (typeof s.display === "number") return s.display;
  return null;
};

export const isFinishedEvent = (e: SofaEvent): boolean => {
  const type = e.status.type;
  return type === "finished" || e.status.code === 100;
};
