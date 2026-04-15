export const seedFromString = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export type Prng = () => number;

export const mulberry32 = (seed: number): Prng => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const randomBetween = (prng: Prng, min: number, max: number): number =>
  min + prng() * (max - min);

export const randomInt = (prng: Prng, min: number, max: number): number =>
  Math.floor(randomBetween(prng, min, max + 1));

export const pickOne = <T>(prng: Prng, items: readonly T[]): T =>
  items[Math.floor(prng() * items.length)]!;
