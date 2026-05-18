/* global React */

/* ===========================================================
   MATCHUP TAB — perspective-aware H2H + smarter form
=========================================================== */
window.MatchupFrame = function MatchupFrame() {
  const homeName = "Atlético Madrid";
  const awayName = "Sevilla";

  // Each meeting: who played at home that day, score from THAT venue's POV, plus today-perspective for the right team
  const meetings = [
    { date: "Mar '26", venue: "atleti", atletiGoals: 2, sevillaGoals: 1, atletiPerspective: 'W' },
    { date: "Oct '25", venue: "sevilla", atletiGoals: 0, sevillaGoals: 0, atletiPerspective: 'D' },
    { date: "Apr '25", venue: "atleti", atletiGoals: 3, sevillaGoals: 0, atletiPerspective: 'W' },
    { date: "Sep '24", venue: "sevilla", atletiGoals: 1, sevillaGoals: 2, atletiPerspective: 'L' },
    { date: "Feb '24", venue: "atleti", atletiGoals: 2, sevillaGoals: 2, atletiPerspective: 'D' },
    { date: "Aug '23", venue: "sevilla", atletiGoals: 0, sevillaGoals: 1, atletiPerspective: 'L' },
  ];

  const homeWins = meetings.filter(m => m.atletiPerspective === 'W').length;
  const draws = meetings.filter(m => m.atletiPerspective === 'D').length;
  const awayWins = meetings.filter(m => m.atletiPerspective === 'L').length;
  const total = meetings.length;
  const homePct = (homeWins / total * 100).toFixed(0);
  const drawPct = (draws / total * 100).toFixed(0);
  const awayPct = (awayWins / total * 100).toFixed(0);

  const [perspective, setPerspective] = React.useState('home'); // home | away | neutral

  return (
    <div style={{ width: 1280, background: 'var(--zs-bg)', display: 'flex', flexDirection: 'column' }}>
      <MatchHeader />
      <TabStrip active="matchup" />

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Recent form — already good, kept compact for context */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { name: homeName, last: ['W','W','D','L','W'], ppg: 1.80, gf: 9, ga: 5 },
            { name: awayName, last: ['L','W','W','D','W'], ppg: 2.00, gf: 8, ga: 4 },
          ].map((t, i) => (
            <div key={i} className="bg-elev border-zs" style={{ borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</span>
                <span className="kicker">last 5</span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {t.last.map((r, j) => <span key={j} className={`formchip ${r}`}>{r}</span>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 14 }}>
                {[['PPG', t.ppg.toFixed(2)], ['GF', t.gf], ['GA', t.ga]].map(([l, v]) => (
                  <div key={l}>
                    <div className="kicker">{l}</div>
                    <div className="font-mono tabular" style={{ fontSize: 16, fontWeight: 600 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* H2H — the redesigned section */}
        <div className="bg-elev border-zs" style={{ borderRadius: 8 }}>
          <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--zs-border)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Head to head</span>
              <span className="kicker">last {total} meetings</span>
            </div>
            {/* Perspective toggle — the FIX */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="kicker">From perspective of</span>
              <div style={{ display: 'inline-flex', background: 'var(--zs-surface)', borderRadius: 6, padding: 2, border: '1px solid var(--zs-border)' }}>
                {[
                  { k: 'home', l: homeName },
                  { k: 'neutral', l: 'Neutral' },
                  { k: 'away', l: awayName },
                ].map(o => (
                  <button key={o.k} onClick={() => setPerspective(o.k)} style={{
                    border: 'none', background: perspective === o.k ? 'var(--zs-bg-elev)' : 'transparent',
                    color: perspective === o.k ? 'var(--zs-fg)' : 'var(--zs-fg-muted)',
                    fontFamily: 'var(--font-mono)', fontSize: 11, padding: '5px 10px', borderRadius: 4, cursor: 'pointer'
                  }}>{o.l}</button>
                ))}
              </div>
            </div>
          </div>

          <Annot kind="good" style={{ margin: '12px 18px 0' }}>
            FIX · "W"/"L" now reads from the chosen perspective (default: home team today). Toggle to flip — neutral mode hides the W/L letter and shows only the score, since "W from neutral view" is meaningless.
          </Annot>

          {/* Aggregate share bar — perspective-aware */}
          <div style={{ padding: '14px 18px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                <span className="font-mono tabular" style={{ color: 'var(--zs-info)', fontSize: 13 }}>
                  {perspective === 'away' ? `${awayWins} wins` : `${homeWins} wins`} <span className="text-fg-muted">{perspective === 'away' ? awayName : homeName}</span>
                </span>
                <span className="font-mono tabular text-fg-muted" style={{ fontSize: 13 }}>{draws} draws</span>
                <span className="font-mono tabular" style={{ color: 'var(--zs-warn)', fontSize: 13 }}>
                  {perspective === 'away' ? `${homeWins} wins` : `${awayWins} wins`} <span className="text-fg-muted">{perspective === 'away' ? homeName : awayName}</span>
                </span>
              </div>
              <span className="kicker">avg goals 1.83</span>
            </div>
            <div className="share-bar" style={{ '--home-pct': `${perspective === 'away' ? awayPct : homePct}%`, '--draw-pct': `${drawPct}%`, '--away-pct': `${perspective === 'away' ? homePct : awayPct}%` }}>
              <span /><span /><span />
            </div>
          </div>

          {/* Meeting rows — visual layout makes home/away unambiguous */}
          <div style={{ padding: '14px 0 6px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 100px 1fr 70px', gap: 12, padding: '0 18px 6px', borderBottom: '1px solid var(--zs-border)' }}>
              <span className="kicker">Date</span>
              <span className="kicker" style={{ textAlign: 'right' }}>Home that day</span>
              <span className="kicker" style={{ textAlign: 'center' }}>Score</span>
              <span className="kicker">Away that day</span>
              <span className="kicker" style={{ textAlign: 'right' }}>Result</span>
            </div>
            {meetings.map((m, i) => {
              const homeTeam = m.venue === 'atleti' ? homeName : awayName;
              const awayTeam = m.venue === 'atleti' ? awayName : homeName;
              const homeGoals = m.venue === 'atleti' ? m.atletiGoals : m.sevillaGoals;
              const awayGoals = m.venue === 'atleti' ? m.sevillaGoals : m.atletiGoals;
              const homeWon = homeGoals > awayGoals;
              const awayWon = awayGoals > homeGoals;

              // Perspective-aware outcome label
              let outcome, tone, label;
              if (perspective === 'neutral') {
                if (homeWon) { outcome = `${homeTeam.split(' ').slice(-1)[0]} won`; tone = 'info'; }
                else if (awayWon) { outcome = `${awayTeam.split(' ').slice(-1)[0]} won`; tone = 'warn'; }
                else { outcome = 'Draw'; tone = 'muted'; }
                label = outcome;
              } else {
                const focus = perspective === 'home' ? homeName : awayName;
                const focusGoals = focus === homeTeam ? homeGoals : awayGoals;
                const oppGoals = focus === homeTeam ? awayGoals : homeGoals;
                if (focusGoals > oppGoals) { tone = 'pos'; label = 'W'; }
                else if (focusGoals < oppGoals) { tone = 'neg'; label = 'L'; }
                else { tone = 'muted'; label = 'D'; }
              }

              const toneVar = { pos: 'var(--zs-pos)', neg: 'var(--zs-neg)', info: 'var(--zs-info)', warn: 'var(--zs-warn)', muted: 'var(--zs-fg-muted)' }[tone];
              const toneFill = { pos: 'var(--zs-pos-fill)', neg: 'var(--zs-neg-fill)', info: 'var(--zs-info-fill)', warn: 'var(--zs-warn-fill)', muted: 'var(--zs-surface)' }[tone];

              return (
                <div key={i} className="h2h-row" style={{ borderBottom: i < meetings.length - 1 ? '1px solid color-mix(in oklch, var(--zs-border) 50%, transparent)' : 'none' }}>
                  <span className="h2h-date">{m.date}</span>
                  <div className={`h2h-team right ${homeWon ? 'winner' : awayWon ? 'loser' : ''}`}>
                    <span className="crest" />
                    <span className="name">{homeTeam}</span>
                  </div>
                  <div className="h2h-score">
                    <span style={{ color: homeWon ? 'var(--zs-fg)' : 'var(--zs-fg-muted)' }}>{homeGoals}</span>
                    <span style={{ color: 'var(--zs-fg-muted)', margin: '0 6px' }}>–</span>
                    <span style={{ color: awayWon ? 'var(--zs-fg)' : 'var(--zs-fg-muted)' }}>{awayGoals}</span>
                  </div>
                  <div className={`h2h-team ${awayWon ? 'winner' : homeWon ? 'loser' : ''}`}>
                    <span className="crest" />
                    <span className="name">{awayTeam}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <span className="h2h-outcome" style={{ color: toneVar, background: toneFill, borderColor: `color-mix(in oklch, ${toneVar} 40%, transparent)` }}>
                      {label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scenario rail — bonus: makes H2H actionable */}
        <div className="bg-elev border-zs" style={{ borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Pattern signals</span>
            <span className="kicker">computed from these {total} meetings</span>
          </div>
          <Annot kind="info" style={{ marginBottom: 12 }}>
            BONUS · the raw rows are useful but burying signals in your head is wasted effort. We surface patterns the model already extracted.
          </Annot>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { l: 'Goals avg', v: '1.83', sub: 'vs market O/U 2.5 → leans Under', tone: 'info' },
              { l: 'BTTS rate', v: '50%', sub: '3/6 meetings', tone: 'fg' },
              { l: `${homeName.split(' ')[0]} at home`, v: '2W 1D 0L', sub: '3 meetings · strong', tone: 'pos' },
              { l: 'Last 3 trend', v: '1.33 ppg', sub: 'cooling down', tone: 'muted' },
            ].map((s, i) => (
              <div key={i} style={{ background: 'var(--zs-surface)', border: '1px solid var(--zs-border)', borderRadius: 6, padding: 12 }}>
                <div className="kicker" style={{ marginBottom: 6 }}>{s.l}</div>
                <div className="font-mono tabular" style={{ fontSize: 18, fontWeight: 600, color: { pos: 'var(--zs-pos)', neg: 'var(--zs-neg)', info: 'var(--zs-info)', muted: 'var(--zs-fg-muted)', fg: 'var(--zs-fg)' }[s.tone] }}>{s.v}</div>
                <div style={{ fontSize: 11, color: 'var(--zs-fg-muted)', marginTop: 4 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ===========================================================
   BONUS — Header upgrade with at-a-glance KPI strip
=========================================================== */
window.HeaderUpgradeFrame = function HeaderUpgradeFrame() {
  return (
    <div style={{ width: 1280, background: 'var(--zs-bg)' }}>
      {/* Upgraded header: kickoff, weather, injury count, sharp move, picks-found — all readable in 1 glance */}
      <div style={{ padding: '18px 28px', background: 'var(--zs-bg-elev)', borderBottom: '1px solid var(--zs-border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 24, marginBottom: 16 }}>
          <div className="team home"><span className="team-bullet" /><span>Atlético Madrid</span></div>
          <div className="vs">
            <div className="kicker">LaLiga · MD32</div>
            <div style={{ fontSize: 13 }}>Tomorrow · 21:00</div>
          </div>
          <div className="team away"><span className="team-bullet" /><span>Sevilla</span></div>
        </div>

        {/* KPI strip — quick-scan signals */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginTop: 8 }}>
          {[
            { l: 'Picks', v: '2', tone: 'pos', sub: '+4.32% top' },
            { l: 'Sharp move 6h', v: '+8¢', tone: 'sharp', sub: 'on Sevilla' },
            { l: 'Public on', v: 'Atléti 71%', tone: 'warn', sub: 'fade signal' },
            { l: 'KEY out (H/A)', v: '2 / 0', tone: 'neg', sub: 'lineups @19:00' },
            { l: 'Rest days', v: '5d / 7d', tone: 'info', sub: '+2 to away' },
            { l: 'Weather', v: '14°C', tone: 'fg', sub: 'wind 12kph' },
          ].map((k, i) => (
            <div key={i} style={{ background: 'var(--zs-surface)', borderRadius: 6, padding: '10px 12px', border: '1px solid var(--zs-border)' }}>
              <div className="kicker" style={{ marginBottom: 4 }}>{k.l}</div>
              <div className="font-mono tabular" style={{ fontSize: 16, fontWeight: 600, color: { pos: 'var(--zs-pos)', neg: 'var(--zs-neg)', info: 'var(--zs-info)', sharp: 'var(--zs-sharp)', warn: 'var(--zs-warn)', fg: 'var(--zs-fg)' }[k.tone] }}>{k.v}</div>
              <div style={{ fontSize: 10.5, color: 'var(--zs-fg-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <TabStrip active="picks" />

      <div style={{ padding: 24 }}>
        <Annot kind="info">
          BONUS · the current header just shows team names + run-analysis button. This packs 6 high-signal stats above the fold so you don't have to dig through tabs to feel out the matchup.
        </Annot>
      </div>
    </div>
  );
};

/* ===========================================================
   BONUS — Lines tab with current-vs-opener compare strip
=========================================================== */
window.LinesUpgradeFrame = function LinesUpgradeFrame() {
  return (
    <div style={{ width: 1280, background: 'var(--zs-bg)' }}>
      <MatchHeader />
      <TabStrip active="lines" />

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Line movement</span>
            <span className="kicker">ML_1X2 · 14 books · 6h window</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['ML_1X2','OU_GOALS','AH','BTTS','DNB'].map((m, i) => (
              <span key={m} className={i === 0 ? 'pill pill-info' : 'pill pill-ghost'}>{m}</span>
            ))}
          </div>
        </div>

        {/* current-vs-opener strip */}
        <Annot kind="info">
          BONUS · current chart needs interpretation. New strip shows opener → current per side, with color-coded delta.
        </Annot>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { side: 'Home', open: 2.10, now: 2.18, dir: 'drift', tone: 'warn' },
            { side: 'Draw', open: 3.50, now: 3.55, dir: 'drift', tone: 'muted' },
            { side: 'Away', open: 3.65, now: 3.40, dir: 'shorten', tone: 'pos' },
          ].map((s, i) => (
            <div key={i} className="bg-elev border-zs" style={{ borderRadius: 8, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{s.side}</span>
                <span className="pill" style={{ background: { pos: 'var(--zs-pos-fill)', warn: 'var(--zs-warn-fill)', muted: 'var(--zs-surface)' }[s.tone], color: { pos: 'var(--zs-pos)', warn: 'var(--zs-warn)', muted: 'var(--zs-fg-muted)' }[s.tone], borderColor: 'transparent', height: 18, fontSize: 10 }}>{s.dir}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <div>
                  <div className="kicker">opener</div>
                  <div className="font-mono tabular" style={{ fontSize: 18, color: 'var(--zs-fg-muted)' }}>{s.open.toFixed(2)}</div>
                </div>
                <div style={{ color: 'var(--zs-fg-muted)', fontSize: 18 }}>→</div>
                <div>
                  <div className="kicker">now</div>
                  <div className="font-mono tabular" style={{ fontSize: 18, color: 'var(--zs-fg)', fontWeight: 600 }}>{s.now.toFixed(2)}</div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <div className="kicker">Δ implied</div>
                  <div className="font-mono tabular" style={{ fontSize: 14, color: { pos: 'var(--zs-pos)', warn: 'var(--zs-warn)', muted: 'var(--zs-fg-muted)' }[s.tone] }}>
                    {(((1/s.now)-(1/s.open))*100).toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* placeholder chart */}
        <div className="bg-elev border-zs" style={{ borderRadius: 8, height: 240, padding: 16, display: 'flex', flexDirection: 'column' }}>
          <div className="kicker">price over time · sparkline placeholder</div>
          <svg viewBox="0 0 800 180" style={{ width: '100%', flex: 1, marginTop: 8 }}>
            <defs>
              <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.745 0.155 155)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="oklch(0.745 0.155 155)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0 90 L 100 80 L 200 100 L 300 70 L 400 60 L 500 50 L 600 40 L 700 35 L 800 30 L 800 180 L 0 180 Z" fill="url(#g1)" />
            <path d="M0 90 L 100 80 L 200 100 L 300 70 L 400 60 L 500 50 L 600 40 L 700 35 L 800 30" stroke="oklch(0.745 0.155 155)" strokeWidth="2" fill="none" />
            <path d="M0 110 L 100 115 L 200 105 L 300 120 L 400 130 L 500 135 L 600 140 L 700 145 L 800 150" stroke="oklch(0.800 0.140 80)" strokeWidth="2" fill="none" strokeDasharray="4 3" opacity="0.7" />
          </svg>
        </div>
      </div>
    </div>
  );
};
