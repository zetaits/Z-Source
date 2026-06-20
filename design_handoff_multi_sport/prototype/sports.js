// ============================================================================
// Z-SOURCE — SPORT REGISTRY (the scalable core)
// ----------------------------------------------------------------------------
// Add a sport = append ONE object. It propagates everywhere: the Scanner desk
// selector, the eyebrow, terminology, league grouping. `enabled:false` parks
// a sport as "coming soon". Only the SCANNER is sport-scoped.
//
// fixtures[] fields:
//   time   kickoff (local, "HH:MM")
//   mins   minutes from now until kickoff (negative = already started/over) —
//          used to find "next up" and render countdowns
//   status 'SCHEDULED' | 'LIVE' | 'FT'
//   comp   league/competition — fixtures are GROUPED by this in the board
//   edge   model's projected best edge % BEFORE analysis (0 = no edge / PASS).
//          This is a pre-analysis estimate; full picks/markets appear only
//          after ANALYSE. picks = how many +EV markets the model flagged.
//   verdict 'PLAY' | 'LEAN' | 'PASS'
// ============================================================================

window.SPORTS_DATA = [
  {
    id: 'football', mono: 'FB', label: 'Football', code: 'SOCCER',
    enabled: true, live: true, unit: 'fixtures', eventLabel: 'kickoff', nextLabel: 'next whistle',
    competitions: 'Premier League · Serie A · Bundesliga · +7',
    markets: ['1X2', 'ASIAN HCAP', 'TOTALS', 'BTTS', 'TEAM TTL', 'CORNERS'],
    fixtures: [
      { time: '17:00', mins: -180, status: 'FT', a: 'Newcastle Utd', b: 'Aston Villa', aS: 'NEW', bS: 'AVL', comp: 'PREMIER LEAGUE', edge: 0, picks: 0, verdict: 'PASS' },
      { time: '20:30', mins: 396, status: 'SCHEDULED', a: 'AFC Bournemouth', b: 'Manchester City', aS: 'BOU', bS: 'MCI', comp: 'PREMIER LEAGUE', edge: 3.08, picks: 3, verdict: 'PLAY' },
      { time: '21:15', mins: 441, status: 'SCHEDULED', a: 'Chelsea FC', b: 'Tottenham Hotspur', aS: 'CHE', bS: 'TOT', comp: 'PREMIER LEAGUE', edge: 1.42, picks: 1, verdict: 'LEAN' },
      { time: '18:00', mins: 0, status: 'LIVE', a: 'SSC Napoli', b: 'Lazio Roma', aS: 'NAP', bS: 'LAZ', comp: 'SERIE A', edge: 1.10, picks: 1, verdict: 'LEAN' },
      { time: '20:45', mins: 411, status: 'SCHEDULED', a: 'ACF Fiorentina', b: 'Atalanta BC', aS: 'FIO', bS: 'ATA', comp: 'SERIE A', edge: 2.14, picks: 2, verdict: 'PLAY' },
      { time: '20:30', mins: 396, status: 'SCHEDULED', a: 'VFL Wolfsburg', b: 'SC Paderborn 07', aS: 'WOL', bS: 'SCP', comp: 'BUNDESLIGA', edge: 0, picks: 0, verdict: 'PASS' },
    ],
  },
  {
    id: 'basketball', mono: 'BK', label: 'Basketball', code: 'NBA',
    enabled: true, live: true, unit: 'games', eventLabel: 'tip-off', nextLabel: 'next tip',
    competitions: 'NBA · EuroLeague · NCAA · +3',
    markets: ['SPREAD', 'TOTAL', 'MONEYLINE', 'TEAM TTL', 'Q1 LINES', 'PLAYER PROPS'],
    fixtures: [
      { time: '20:45', mins: 0, status: 'LIVE', a: 'Real Madrid', b: 'Olympiacos', aS: 'RMB', bS: 'OLY', comp: 'EUROLEAGUE', edge: 1.20, picks: 1, verdict: 'LEAN' },
      { time: '00:00', mins: 540, status: 'SCHEDULED', a: 'New York Knicks', b: 'Miami Heat', aS: 'NYK', bS: 'MIA', comp: 'NBA', edge: 3.42, picks: 2, verdict: 'PLAY' },
      { time: '01:30', mins: 630, status: 'SCHEDULED', a: 'Los Angeles Lakers', b: 'Boston Celtics', aS: 'LAL', bS: 'BOS', comp: 'NBA', edge: 2.71, picks: 2, verdict: 'PLAY' },
      { time: '02:00', mins: 660, status: 'SCHEDULED', a: 'Denver Nuggets', b: 'Minnesota T-Wolves', aS: 'DEN', bS: 'MIN', comp: 'NBA', edge: 1.66, picks: 1, verdict: 'LEAN' },
    ],
  },
  {
    id: 'baseball', mono: 'BB', label: 'Baseball', code: 'MLB',
    enabled: true, live: false, unit: 'games', eventLabel: 'first pitch', nextLabel: 'next pitch',
    competitions: 'MLB · NPB · KBO',
    markets: ['MONEYLINE', 'RUN LINE', 'TOTAL', 'F5 INNINGS', 'TEAM TTL', 'PROPS'],
    fixtures: [
      { time: '00:05', mins: 545, status: 'SCHEDULED', a: 'New York Yankees', b: 'Boston Red Sox', aS: 'NYY', bS: 'BOS', comp: 'MLB · AMERICAN LEAGUE', edge: 1.94, picks: 1, verdict: 'LEAN' },
      { time: '03:40', mins: 760, status: 'SCHEDULED', a: 'Houston Astros', b: 'Seattle Mariners', aS: 'HOU', bS: 'SEA', comp: 'MLB · AMERICAN LEAGUE', edge: 0, picks: 0, verdict: 'PASS' },
      { time: '02:10', mins: 670, status: 'SCHEDULED', a: 'LA Dodgers', b: 'San Francisco Giants', aS: 'LAD', bS: 'SF', comp: 'MLB · NATIONAL LEAGUE', edge: 2.88, picks: 2, verdict: 'PLAY' },
    ],
  },
  {
    id: 'tennis', mono: 'TN', label: 'Tennis', code: 'ATP/WTA',
    enabled: true, live: true, unit: 'matches', eventLabel: 'on court', nextLabel: 'next on court',
    competitions: 'ATP 1000 · WTA 1000 · Grand Slam',
    markets: ['MONEYLINE', 'SET HCAP', 'TOTAL GAMES', 'SET BETTING', 'GAME HCAP'],
    fixtures: [
      { time: '12:00', mins: 0, status: 'LIVE', a: 'I. Swiatek', b: 'A. Sabalenka', aS: 'SWI', bS: 'SAB', comp: 'WTA 1000 · FINAL', edge: 2.07, picks: 1, verdict: 'PLAY' },
      { time: '14:00', mins: 120, status: 'SCHEDULED', a: 'C. Alcaraz', b: 'J. Sinner', aS: 'ALC', bS: 'SIN', comp: 'ATP 1000 · SEMI-FINAL', edge: 2.33, picks: 1, verdict: 'PLAY' },
      { time: '16:30', mins: 270, status: 'SCHEDULED', a: 'N. Djokovic', b: 'A. Zverev', aS: 'DJO', bS: 'ZVE', comp: 'ATP 1000 · SEMI-FINAL', edge: 1.51, picks: 1, verdict: 'LEAN' },
    ],
  },
  {
    id: 'amfootball', mono: 'AF', label: 'Am. Football', code: 'NFL',
    enabled: false, live: false, unit: 'games', eventLabel: 'kickoff', nextLabel: 'next kickoff',
    competitions: 'NFL · NCAAF',
    markets: ['SPREAD', 'TOTAL', 'MONEYLINE', 'TEAM TTL', 'PROPS'],
    fixtures: [],
  },
];
