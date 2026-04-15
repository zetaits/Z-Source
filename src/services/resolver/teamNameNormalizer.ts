const SUFFIX_TOKENS = [
  "fc",
  "afc",
  "cf",
  "sc",
  "ac",
  "rc",
  "cd",
  "cp",
  "ud",
  "if",
  "bk",
  "club",
  "calcio",
  "deportivo",
  "real",
];

const ALIASES: Record<string, string> = {
  "manchester city": "man city",
  "manchester united": "man united",
  "wolverhampton wanderers": "wolves",
  "tottenham hotspur": "tottenham",
  "brighton hove albion": "brighton",
  "brighton and hove albion": "brighton",
  "leicester city": "leicester",
  "newcastle united": "newcastle",
  "west ham united": "west ham",
  "aston villa": "villa",
  "atletico madrid": "atletico",
  "atletico de madrid": "atletico",
  "athletic club": "athletic bilbao",
  "athletic": "athletic bilbao",
  "borussia dortmund": "dortmund",
  "borussia monchengladbach": "monchengladbach",
  "bayern munich": "bayern",
  "bayern munchen": "bayern",
  "internazionale": "inter",
  "psg": "paris saint germain",
  "paris sg": "paris saint germain",
  "psv eindhoven": "psv",
};

const stripDiacritics = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const normalizeTeamName = (raw: string): string => {
  if (!raw) return "";
  let s = stripDiacritics(raw.toLowerCase().trim());
  s = s.replace(/[.,'`"’]/g, "");
  s = s.replace(/\s+/g, " ");
  if (ALIASES[s]) return ALIASES[s];
  const tokens = s
    .split(" ")
    .filter((t) => t.length > 0 && !SUFFIX_TOKENS.includes(t));
  const cleaned = tokens.join(" ").trim();
  return ALIASES[cleaned] ?? cleaned;
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

export const teamSimilarity = (a: string, b: string): number =>
  jaroWinkler(normalizeTeamName(a), normalizeTeamName(b));
