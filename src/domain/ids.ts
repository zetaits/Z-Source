export type MatchId = string & { readonly _t: "MatchId" };
export type LeagueId = string & { readonly _t: "LeagueId" };
export type TeamId = string & { readonly _t: "TeamId" };
export type BetId = string & { readonly _t: "BetId" };
export type PlayId = string & { readonly _t: "PlayId" };
export type BookId = string & { readonly _t: "BookId" };

export const MatchId = (v: string) => v as MatchId;
export const LeagueId = (v: string) => v as LeagueId;
export const TeamId = (v: string) => v as TeamId;
export const BetId = (v: string) => v as BetId;
export const PlayId = (v: string) => v as PlayId;
export const BookId = (v: string) => v as BookId;
