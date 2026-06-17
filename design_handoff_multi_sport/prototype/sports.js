// ============================================================================
// Z-SOURCE — SPORT REGISTRY (the scalable core)
// ----------------------------------------------------------------------------
// To add a sport: append ONE object here. It propagates everywhere — rail,
// switcher, content headers, market chips, terminology. Zero UI rework.
// `enabled:false` parks a sport as "coming soon" without removing it.
// ============================================================================

window.SPORTS_DATA = [
  {
    id: 'football',
    mono: 'FB',
    label: 'Football',
    code: 'SOCCER',
    enabled: true,
    live: true,
    hue: 36,                       // identity hue (brand amber)
    unit: 'fixtures',              // domain noun
    eventLabel: 'kickoff',        // when the contest starts
    nextLabel: 'next whistle',
    competitions: 'Premier League · La Liga · Serie A · Bundesliga · +6',
    markets: ['1X2', 'ASIAN HCAP', 'TOTALS', 'BTTS', 'TEAM TTL', 'CORNERS'],
    fixtures: [
      { time: '20:30', a: 'AFC Bournemouth', b: 'Manchester City', aS: 'BOU', bS: 'MCI', comp: 'PREMIER LEAGUE', cc: 'GB-ENG', verdict: 'PLAY', edge: 3.08, picks: 3 },
      { time: '21:15', a: 'Chelsea FC', b: 'Tottenham Hotspur', aS: 'CHE', bS: 'TOT', comp: 'PREMIER LEAGUE', cc: 'GB-ENG', verdict: 'LEAN', edge: 1.42, picks: 1 },
      { time: '20:45', a: 'ACF Fiorentina', b: 'Atalanta BC', aS: 'FIO', bS: 'ATA', comp: 'SERIE A', cc: 'IT', verdict: 'PLAY', edge: 2.14, picks: 2 },
      { time: '20:30', a: 'VFL Wolfsburg', b: 'SC Paderborn 07', aS: 'WOL', bS: 'SCP', comp: 'BUNDESLIGA', cc: 'DE', verdict: 'PASS', edge: 0, picks: 0 },
    ],
  },
  {
    id: 'basketball',
    mono: 'BK',
    label: 'Basketball',
    code: 'NBA',
    enabled: true,
    live: true,
    hue: 28,
    unit: 'games',
    eventLabel: 'tip-off',
    nextLabel: 'next tip',
    competitions: 'NBA · EuroLeague · NCAA · +3',
    markets: ['SPREAD', 'TOTAL', 'MONEYLINE', 'TEAM TTL', 'Q1 LINES', 'PLAYER PROPS'],
    fixtures: [
      { time: '01:30', a: 'Los Angeles Lakers', b: 'Boston Celtics', aS: 'LAL', bS: 'BOS', comp: 'NBA', cc: 'US', verdict: 'PLAY', edge: 2.71, picks: 2 },
      { time: '02:00', a: 'Denver Nuggets', b: 'Minnesota T-Wolves', aS: 'DEN', bS: 'MIN', comp: 'NBA', cc: 'US', verdict: 'LEAN', edge: 1.66, picks: 1 },
      { time: '00:00', a: 'New York Knicks', b: 'Miami Heat', aS: 'NYK', bS: 'MIA', comp: 'NBA', cc: 'US', verdict: 'PLAY', edge: 3.42, picks: 2 },
      { time: '20:45', a: 'Real Madrid', b: 'Olympiacos', aS: 'RMB', bS: 'OLY', comp: 'EUROLEAGUE', cc: 'EU', verdict: 'PASS', edge: 0, picks: 0 },
    ],
  },
  {
    id: 'baseball',
    mono: 'BB',
    label: 'Baseball',
    code: 'MLB',
    enabled: true,
    live: false,
    hue: 44,
    unit: 'games',
    eventLabel: 'first pitch',
    nextLabel: 'next pitch',
    competitions: 'MLB · NPB · KBO',
    markets: ['MONEYLINE', 'RUN LINE', 'TOTAL', 'F5 INNINGS', 'TEAM TTL', 'PROPS'],
    fixtures: [
      { time: '00:05', a: 'New York Yankees', b: 'Boston Red Sox', aS: 'NYY', bS: 'BOS', comp: 'MLB · AL EAST', cc: 'US', verdict: 'LEAN', edge: 1.94, picks: 1 },
      { time: '02:10', a: 'LA Dodgers', b: 'San Francisco Giants', aS: 'LAD', bS: 'SF', comp: 'MLB · NL WEST', cc: 'US', verdict: 'PLAY', edge: 2.88, picks: 2 },
      { time: '03:40', a: 'Houston Astros', b: 'Seattle Mariners', aS: 'HOU', bS: 'SEA', comp: 'MLB · AL WEST', cc: 'US', verdict: 'PASS', edge: 0, picks: 0 },
    ],
  },
  {
    id: 'tennis',
    mono: 'TN',
    label: 'Tennis',
    code: 'ATP/WTA',
    enabled: true,
    live: true,
    hue: 52,
    unit: 'matches',
    eventLabel: 'on court',
    nextLabel: 'next on court',
    competitions: 'ATP 1000 · WTA 1000 · Grand Slam',
    markets: ['MONEYLINE', 'SET HCAP', 'TOTAL GAMES', 'SET BETTING', 'GAME HCAP'],
    fixtures: [
      { time: '14:00', a: 'C. Alcaraz', b: 'J. Sinner', aS: 'ALC', bS: 'SIN', comp: 'ATP 1000 · SF', cc: 'IT', verdict: 'PLAY', edge: 2.33, picks: 1 },
      { time: '16:30', a: 'N. Djokovic', b: 'A. Zverev', aS: 'DJO', bS: 'ZVE', comp: 'ATP 1000 · SF', cc: 'IT', verdict: 'LEAN', edge: 1.51, picks: 1 },
      { time: '12:00', a: 'I. Swiatek', b: 'A. Sabalenka', aS: 'SWI', bS: 'SAB', comp: 'WTA 1000 · F', cc: 'IT', verdict: 'PLAY', edge: 2.07, picks: 1 },
    ],
  },
  {
    id: 'amfootball',
    mono: 'AF',
    label: 'Am. Football',
    code: 'NFL',
    enabled: false,                // parked — shows the "coming soon" state
    live: false,
    hue: 20,
    unit: 'games',
    eventLabel: 'kickoff',
    nextLabel: 'next kickoff',
    competitions: 'NFL · NCAAF',
    markets: ['SPREAD', 'TOTAL', 'MONEYLINE', 'TEAM TTL', 'PROPS'],
    fixtures: [],
  },
];
