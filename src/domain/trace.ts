export type ReasoningSource = "rule" | "leg" | "adapter" | "math";
export type ReasoningVerdict = "SUPPORT" | "AGAINST" | "NEUTRAL";

export interface ReasoningEntry {
  source: ReasoningSource;
  id: string;
  verdict: ReasoningVerdict;
  weight: number;
  message: string;
  data?: Record<string, unknown>;
}
