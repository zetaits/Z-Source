// Legal/structural designations that don't carry team identity.
const SUFFIX_TOKENS = new Set([
  // English / general
  "fc", "afc", "cf", "sc", "ac", "rc", "cd", "cp", "ud", "if", "bk",
  // German
  "vfb", "vfl", "fsv", "tsg", "msv", "sv", "kv", "tsv", "rb", "spvgg",
  // Italian
  "ssc", "ssd", "us", "asd", "calcio",
  // Spanish / Portuguese
  "rcd", "ca", "sd", "scp", "sl",
  // French
  "ogc", "losc", "asse",
  // Generic
  "club", "deportivo", "athletic", "football",
]);

// Connector words, articles, and other linguistic noise.
const FILLER_TOKENS = new Set([
  "de", "du", "del", "el", "la", "le", "les", "los", "y", "und", "et",
  "e", "di", "da", "dal", "do", "dos", "das", "van", "der", "den",
  "of", "the", "and", "a",
]);

// Aliases reserved for abbreviations whose tokens do not overlap with the
// canonical full form (so token-based matching cannot recover them).
const ALIASES: Record<string, string> = {
  psg: "paris saint germain",
  "paris sg": "paris saint germain",
  wolves: "wolverhampton wanderers",
};

const stripDiacritics = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "");

const cleanString = (raw: string): string =>
  stripDiacritics(raw.toLowerCase().trim())
    .replace(/[.,'`"’\-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (raw: string): string[] => {
  if (!raw) return [];
  return cleanString(raw)
    .split(" ")
    .filter((t) => t.length > 0);
};

const isSignificant = (t: string): boolean => {
  if (t.length < 2) return false;
  if (SUFFIX_TOKENS.has(t)) return false;
  if (FILLER_TOKENS.has(t)) return false;
  if (/^\d+$/.test(t)) return false;
  return true;
};

export const normalizeTeamName = (raw: string): string => {
  if (!raw) return "";
  const cleaned = cleanString(raw);
  if (ALIASES[cleaned]) return ALIASES[cleaned];
  const significant = tokenize(raw).filter(isSignificant);
  return significant.length > 0 ? significant.join(" ") : cleaned;
};

export const jaroWinkler = (a: string, b: string): number => {
  if (a === b) return 1;
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0 || lenB === 0) return 0;
  const matchDist = Math.max(0, Math.floor(Math.max(lenA, lenB) / 2) - 1);
  const matchedA = new Array<boolean>(lenA).fill(false);
  const matchedB = new Array<boolean>(lenB).fill(false);
  let matches = 0;
  for (let i = 0; i < lenA; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, lenB);
    for (let j = start; j < end; j++) {
      if (matchedB[j]) continue;
      if (a[i] !== b[j]) continue;
      matchedA[i] = true;
      matchedB[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let k = 0;
  let transpositions = 0;
  for (let i = 0; i < lenA; i++) {
    if (!matchedA[i]) continue;
    while (!matchedB[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  const m = matches;
  const jaro = (m / lenA + m / lenB + (m - transpositions / 2) / m) / 3;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, lenA, lenB); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
};

const TOKEN_MATCH_FLOOR = 0.85;

// Token containment: each token of the shorter set must find a strong fuzzy
// match in the longer set. Handles "Lens" ↔ "Racing Club de Lens" and
// "Inter" ↔ "Internazionale" without needing per-team aliases.
const tokenContainment = (a: string, b: string): { score: number; allStrong: boolean } => {
  const ta = a.split(" ").filter((t) => t.length > 0);
  const tb = b.split(" ").filter((t) => t.length > 0);
  if (ta.length === 0 || tb.length === 0) return { score: 0, allStrong: false };
  const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  let total = 0;
  let allStrong = true;
  for (const t of shorter) {
    let best = 0;
    for (const u of longer) {
      const sim = t === u ? 1 : jaroWinkler(t, u);
      if (sim > best) best = sim;
    }
    if (best < TOKEN_MATCH_FLOOR) allStrong = false;
    total += best;
  }
  return { score: total / shorter.length, allStrong };
};

export const teamSimilarity = (a: string, b: string): number => {
  const na = normalizeTeamName(a);
  const nb = normalizeTeamName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const { score: containment, allStrong } = tokenContainment(na, nb);
  const fullScore = jaroWinkler(na, nb);
  if (allStrong) return Math.max(containment, fullScore);
  return Math.max(fullScore, containment * 0.7);
};

/**
 * Token-significant breakdown of a normalised team name. Useful for retrying
 * provider searches with shorter sub-strings when the full name returns zero
 * hits (e.g. "real betis seville" → ["real betis", "betis seville", ...]).
 */
export const normalizedTokens = (raw: string): string[] => {
  const normalized = normalizeTeamName(raw);
  return normalized ? normalized.split(" ").filter((t) => t.length > 0) : [];
};
