export const impliedProb = (decimal: number): number => {
  if (decimal <= 1) return 0;
  return 1 / decimal;
};

export const fairDecimal = (prob: number): number => {
  if (prob <= 0) return Infinity;
  return 1 / prob;
};

export const removeVig = (probs: number[]): number[] => {
  const sum = probs.reduce((a, b) => a + b, 0);
  if (sum <= 0) return probs.map(() => 0);
  return probs.map((p) => p / sum);
};

export const edgePct = (fairProb: number, priceDecimal: number): number =>
  fairProb * priceDecimal - 1;

export const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(Math.max(v, lo), hi);
