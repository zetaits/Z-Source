import { z } from "zod";

export const SOFA_API_BASE = "https://api.sofascore.com/api/v1";

export const tournamentEventsUrl = (tournamentId: number, season: number, span: "next" | "last", page = 0): string =>
  `${SOFA_API_BASE}/unique-tournament/${tournamentId}/season/${season}/events/${span}/${page}`;

export const tournamentSeasonsUrl = (tournamentId: number): string =>
  `${SOFA_API_BASE}/unique-tournament/${tournamentId}/seasons`;

export const tournamentInfoUrl = (tournamentId: number): string =>
  `${SOFA_API_BASE}/unique-tournament/${tournamentId}`;

export const sofaTeamSchema = z.object({
  id: z.number(),
  name: z.string(),
  shortName: z.string().optional(),
  nameCode: z.string().optional(),
  country: z
    .object({ name: z.string().optional(), alpha2: z.string().optional() })
    .partial()
    .optional(),
});

export const sofaStatusSchema = z.object({
  code: z.number(),
  type: z.string(),
  description: z.string().optional(),
});

export const sofaTournamentSchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  uniqueTournament: z
    .object({
      id: z.number().optional(),
      name: z.string().optional(),
      category: z
        .object({ name: z.string().optional(), alpha2: z.string().optional() })
        .partial()
        .optional(),
    })
    .partial()
    .optional(),
});

export const sofaEventSchema = z.object({
  id: z.number(),
  startTimestamp: z.number(),
  status: sofaStatusSchema,
  homeTeam: sofaTeamSchema,
  awayTeam: sofaTeamSchema,
  tournament: sofaTournamentSchema.optional(),
});

export const sofaEventsResponseSchema = z.object({
  events: z.array(sofaEventSchema),
  hasNextPage: z.boolean().optional(),
});

export const sofaSeasonsResponseSchema = z.object({
  seasons: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      year: z.string().optional(),
    }),
  ),
});

export type SofaEvent = z.infer<typeof sofaEventSchema>;
export type SofaEventsResponse = z.infer<typeof sofaEventsResponseSchema>;

export const mapSofaStatus = (
  code: number,
  type: string,
): "SCHEDULED" | "LIVE" | "FT" | "POSTPONED" | "CANCELLED" => {
  if (type === "finished") return "FT";
  if (type === "inprogress") return "LIVE";
  if (type === "postponed") return "POSTPONED";
  if (type === "canceled" || type === "cancelled") return "CANCELLED";
  if (code === 100) return "FT";
  if (code === 0) return "SCHEDULED";
  return "SCHEDULED";
};
