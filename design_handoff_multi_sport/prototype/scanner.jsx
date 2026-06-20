// ============================================================================
// Z-SOURCE — SCANNER ("Fixture Board") + app root
// Triage tool: "which fixtures are worth opening?" Fixtures are GROUPED BY
// LEAGUE (matching the production board), with a NEXT UP highlight and a
// pre-analysis BEST EDGE signal. The sport selector (analysis desk) is the
// head of the page; everything else here is account-general.
// ============================================================================

function verdictColor(v) {
  return v === 'PLAY' ? 'var(--pos)' : v === 'LEAN' ? 'var(--accent)' : 'var(--fg-muted)';
}
function relLabel(f) {
  if (f.status === 'FT') return 'FINAL';
  if (f.status === 'LIVE') return 'LIVE NOW';
  const h = Math.floor(f.mins / 60), m = f.mins % 60;
  return 'in ' + (h ? h + 'h ' : '') + m + 'm';
}
function fmtCountdown(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return (h ? h + 'h ' : '') + m + 'm';
}

// ---------------------------------------------------------------------------
// DESK SELECTOR — the sport switcher, head of the Scanner.
// ---------------------------------------------------------------------------
function DeskSelector({ activeId, onPick }) {
  const totalEdges = SPORTS.filter(s => s.enabled).reduce((a, s) => a + edgeCount(s), 0);
  const liveSports = SPORTS.filter(s => s.enabled && s.live).length;
  return (
    <div style={{ border: '1px solid var(--border)', background: 'var(--bg-2)', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 16px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-muted)', letterSpacing: '0.18em' }}>ANALYSIS DESK</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-dim)', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 5, height: 5, background: 'var(--pos)' }} className="zs-pulse" />
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{totalEdges}</span> live edges
          <span style={{ color: 'var(--fg-faint)' }}>·</span>{liveSports} sports active
        </span>
      </div>
      <div className="zs-scroll" style={{ display: 'flex', overflowX: 'auto' }}>
        {SPORTS.map((s) => {
          const active = s.id === activeId, disabled = !s.enabled, edges = edgeCount(s);
          return (
            <button key={s.id} onClick={() => !disabled && onPick(s.id)} title={disabled ? `${s.label} — coming soon` : `${s.label} desk`}
              className="zs-desk" data-active={active ? '1' : undefined}
              style={{
                position: 'relative', flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 13, padding: '15px 22px',
                borderRight: '1px solid var(--border)', borderTop: '2px solid', borderTopColor: active ? 'var(--accent)' : 'transparent',
                background: active ? 'var(--surface)' : 'transparent', cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.4 : 1, transition: 'background 140ms var(--ease-snap)',
              }}>
              <SportGlyph sport={s} size={38} iconSize={23} active={active} />
              <span style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', textTransform: 'uppercase', lineHeight: 1, whiteSpace: 'nowrap', color: active ? 'var(--accent)' : 'var(--fg)' }}>{s.label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', whiteSpace: 'nowrap', color: 'var(--fg-muted)' }}>
                  {disabled ? <span>{s.code} · SOON</span> : <>{s.code} · <span style={{ color: edges > 0 ? 'var(--pos)' : 'var(--fg-muted)', fontWeight: 600 }}>{edges} edge{edges === 1 ? '' : 's'}</span></>}
                </span>
              </span>
              {s.live && s.enabled && (<span className={active ? 'zs-pulse' : ''} style={{ position: 'absolute', top: 11, right: 12, width: 5, height: 5, background: active ? 'var(--accent)' : 'var(--pos)' }} />)}
            </button>
          );
        })}
        <button title="Add sport" className="zs-desk-add" style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '0 22px', minWidth: 86, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', borderTop: '2px solid transparent' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, lineHeight: 1 }}>+</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.10em' }}>ADD</span>
        </button>
      </div>
    </div>
  );
}

// segmented control (status filter)
function Segmented({ options, value, onChange }) {
  return (
    <span style={{ display: 'inline-flex', border: '1px solid var(--border-hot)' }}>
      {options.map((o, i) => {
        const active = o.id === value;
        return (
          <button key={o.id} onClick={() => onChange(o.id)} style={{
            padding: '4px 11px', background: active ? 'var(--accent)' : 'transparent', color: active ? 'var(--bg)' : 'var(--fg-dim)',
            border: 'none', borderLeft: i ? '1px solid var(--border-hot)' : 'none', cursor: 'pointer',
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: '0.10em',
          }}>{o.label}</button>
        );
      })}
    </span>
  );
}

// best-edge cell (bar + %). Pre-analysis projection; '—' when none/settled.
function EdgeMeter({ f, max }) {
  if (f.status === 'FT' || f.edge <= 0) return <span style={{ color: 'var(--fg-faint)' }}>—</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
      <span style={{ width: 50, height: 4, background: 'var(--surface-2)', position: 'relative', overflow: 'hidden' }}>
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: (f.edge / max * 100) + '%', background: 'var(--pos)' }} />
      </span>
      <span style={{ color: 'var(--pos)', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 12, minWidth: 50 }}>+{f.edge.toFixed(2)}%</span>
    </span>
  );
}

function StatusTag({ status }) {
  const map = {
    LIVE: { c: 'var(--pos)', pulse: true }, SCHEDULED: { c: 'var(--fg-dim)' }, FT: { c: 'var(--fg-muted)' },
  };
  const s = map[status] || map.SCHEDULED;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.10em', color: s.c }}>
      {s.pulse && <span className="zs-pulse" style={{ width: 5, height: 5, background: 'var(--pos)' }} />}{status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// NEXT UP — highlight of the soonest upcoming fixture for the active sport.
// ---------------------------------------------------------------------------
function NextUp({ sport, max }) {
  const upcoming = sport.fixtures.filter(f => f.status === 'SCHEDULED').sort((a, b) => a.mins - b.mins)[0]
    || sport.fixtures.filter(f => f.status === 'LIVE')[0];
  if (!upcoming) return null;
  return (
    <div style={{ border: '1px solid var(--accent)', background: 'var(--accent-fill)', display: 'flex', alignItems: 'center', gap: 16, padding: '13px 16px', marginBottom: 22, flexWrap: 'wrap' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent)', color: 'var(--bg)', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', padding: '4px 9px' }}>▸ NEXT UP</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontFamily: 'var(--font-display)', fontSize: 17, letterSpacing: '-0.01em' }}>
        <span style={{ color: 'var(--fg)', fontWeight: 700 }}>{upcoming.a}</span>
        <span style={{ color: 'var(--fg-muted)', fontSize: 12 }}>vs</span>
        <span style={{ color: 'var(--fg)', fontWeight: 700 }}>{upcoming.b}</span>
      </span>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 18 }}>
        <EdgeMeter f={upcoming} max={max} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-dim)', letterSpacing: '0.04em' }}>{upcoming.comp}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg)', fontVariantNumeric: 'tabular-nums' }}>
          {upcoming.time} <span style={{ color: 'var(--fg-muted)' }}>· {relLabel(upcoming)}</span>
        </span>
        <button className="zs-analyse-btn" style={{ background: 'var(--accent)', color: 'var(--bg)', border: 'none', padding: '7px 13px', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', cursor: 'pointer' }}>ANALYSE →</button>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LEAGUE GROUP — a competition header followed by its fixtures.
// ---------------------------------------------------------------------------
function LeagueGroup({ comp, items, sport, max }) {
  const times = items.map(f => f.time).sort();
  return (
    <div className="zs-block" style={{ marginBottom: 16 }}>
      <div className="zs-block-head">
        <span className="l" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ color: 'var(--accent)' }}>▛</span>
          <SportGlyph sport={sport} size={18} iconSize={12} />
          {comp}
        </span>
        <span className="r" style={{ color: 'var(--fg-muted)' }}>{items.length} {sport.unit.toUpperCase()} · {times[0]}–{times[times.length - 1]}</span>
      </div>
      <div>
        {items.map((f, i) => {
          const ft = f.status === 'FT';
          return (
            <div key={i} className="zs-fix-row" style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: '13px 16px',
              borderTop: i ? '1px solid var(--rule)' : 'none', opacity: ft ? 0.5 : 1,
            }}>
              {/* time + countdown */}
              <div style={{ width: 84, flex: '0 0 84px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{f.time}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: f.status === 'LIVE' ? 'var(--pos)' : 'var(--fg-muted)', letterSpacing: '0.06em', marginTop: 4 }}>{relLabel(f)}</div>
              </div>
              {/* matchup */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-muted)', border: '1px solid var(--border-hot)', padding: '1px 4px' }}>{f.aS}</span>
                <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{f.a}</span>
                <span style={{ color: 'var(--fg-faint)' }}>vs</span>
                <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{f.b}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-muted)', border: '1px solid var(--border-hot)', padding: '1px 4px' }}>{f.bS}</span>
              </div>
              {/* best edge */}
              <div style={{ width: 150, flex: '0 0 150px', textAlign: 'right' }}><EdgeMeter f={f} max={max} /></div>
              {/* verdict */}
              <div style={{ width: 92, flex: '0 0 92px' }}>
                {ft ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-muted)', letterSpacing: '0.08em' }}>SETTLED</span>
                  : <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', color: verdictColor(f.verdict), border: `1px solid ${verdictColor(f.verdict)}`, padding: '2px 7px' }}>
                    {f.verdict === 'PLAY' ? '▲' : f.verdict === 'LEAN' ? '◆' : '▽'} {f.verdict}
                  </span>}
              </div>
              {/* status */}
              <div style={{ width: 88, flex: '0 0 88px' }}><StatusTag status={f.status} /></div>
              {/* analyse */}
              <button className="zs-row-analyse" style={{ flex: '0 0 auto', background: 'transparent', border: '1px solid var(--border-hot)', color: 'var(--fg-dim)', padding: '6px 11px', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', cursor: 'pointer' }}>ANALYSE →</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SCANNER
// ---------------------------------------------------------------------------
function Scanner({ sportId, onPick }) {
  const [status, setStatus] = useState('all');   // all | SCHEDULED | LIVE | FT
  const [sort, setSort] = useState('kickoff');   // kickoff | edge
  const [nonce, setNonce] = useState(0);         // refresh → replay enter anim
  const sport = SPORTS.find(s => s.id === sportId);

  const all = sport.fixtures;
  const maxEdge = Math.max(0.01, ...all.map(f => f.edge));
  const nextWhistle = all.filter(f => f.status === 'SCHEDULED').sort((a, b) => a.mins - b.mins)[0];

  let shown = all.filter(f => status === 'all' ? true : f.status === status);
  shown = [...shown].sort((a, b) => sort === 'edge' ? b.edge - a.edge : a.mins - b.mins);

  // group by league, preserving first-seen order
  const groups = [];
  shown.forEach(f => {
    let g = groups.find(x => x.comp === f.comp);
    if (!g) { g = { comp: f.comp, items: [] }; groups.push(g); }
    g.items.push(f);
  });

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short' }).toUpperCase();

  return (
    <div>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.20em', marginBottom: 10 }}>[ SCANNER · {sport.label.toUpperCase()} · 72H WINDOW ]</div>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 34, letterSpacing: '-0.02em', lineHeight: 1 }}>Fixture Board</h1>
          <p style={{ margin: '10px 0 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)', letterSpacing: '0.06em' }}>
            {today} · {all.length} {sport.unit} · {sport.nextLabel} {nextWhistle ? 'in ' + fmtCountdown(nextWhistle.mins) : '—'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setNonce(n => n + 1)} className="zs-ghost-btn" style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--surface)', border: '1px solid var(--border-hot)', color: 'var(--fg-dim)', padding: '8px 13px', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', cursor: 'pointer' }}>↻ REFRESH</button>
          <button className="zs-ghost-btn" style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--accent)', border: '1px solid var(--accent)', color: 'var(--bg)', padding: '8px 13px', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', cursor: 'pointer' }}>LEAGUES →</button>
        </div>
      </div>

      {/* DESK SELECTOR */}
      <DeskSelector activeId={sportId} onPick={onPick} />

      <div key={sport.id + ':' + nonce} className="zs-page-enter">
        {/* NEXT UP */}
        <NextUp sport={sport} max={maxEdge} />

        {/* filter / sort bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-muted)', letterSpacing: '0.14em' }}>STATUS</span>
          <Segmented value={status} onChange={setStatus} options={[
            { id: 'all', label: 'ALL' }, { id: 'SCHEDULED', label: 'SCHEDULED' }, { id: 'LIVE', label: 'LIVE' }, { id: 'FT', label: 'FT' },
          ]} />
          <span style={{ width: 1, height: 18, background: 'var(--border)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-muted)', letterSpacing: '0.14em' }}>SORT</span>
          <button onClick={() => setSort(s => s === 'kickoff' ? 'edge' : 'kickoff')} style={{ background: 'var(--surface)', border: '1px solid var(--border-hot)', cursor: 'pointer', color: 'var(--fg-dim)', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.10em', padding: '4px 11px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--accent)' }}>{sort === 'kickoff' ? 'KICKOFF ↑' : 'BEST EDGE ↓'}</span>
          </button>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-muted)', letterSpacing: '0.10em' }}>SHOWING {shown.length}</span>
        </div>

        {/* league groups */}
        {groups.map(g => (<LeagueGroup key={g.comp} comp={g.comp} items={g.items} sport={sport} max={maxEdge} />))}
        {groups.length === 0 && (
          <div className="zs-block" style={{ padding: '52px 0', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)', letterSpacing: '0.06em' }}>
            {all.length === 0 ? `── ${sport.label} feed not yet enabled · coming soon ──` : '── no fixtures match this filter ──'}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// stubs for the general (non-sport) views
// ---------------------------------------------------------------------------
function StubView({ label }) {
  return (
    <div className="zs-page-enter">
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.20em', marginBottom: 10 }}>[ {label} ]</div>
      <h1 style={{ margin: '0 0 6px', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 34, letterSpacing: '-0.02em' }}>{label[0] + label.slice(1).toLowerCase()}</h1>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)', letterSpacing: '0.08em', margin: '0 0 26px' }}>account-wide · all sports · not sport-scoped</p>
      <div style={{ border: '1px dashed var(--border-hot)', padding: '64px 0', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)', letterSpacing: '0.08em' }}>── {label} is a general view · no sport selector here ──</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// APP
// ---------------------------------------------------------------------------
function App() {
  const enabled = SPORTS.filter(s => s.enabled);
  const [view, setView] = useState('scanner');
  const [sportId, setSportId] = useState('football');

  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if ((e.key === '[' || e.key === ']') && view === 'scanner') {
        const idx = enabled.findIndex(s => s.id === sportId);
        const next = e.key === ']' ? (idx + 1) % enabled.length : (idx - 1 + enabled.length) % enabled.length;
        setSportId(enabled[next].id);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [sportId, view]);

  const LABELS = { command: 'COMMAND', match: 'MATCH·LIVE', bankroll: 'BANKROLL', metrics: 'METRICS', strategy: 'STRATEGY', settings: 'SETTINGS' };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar current={view} onNav={setView} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh' }}>
        <TopBar />
        <Ticker />
        <main className="zs-scroll" style={{ flex: 1, overflow: 'auto', padding: '26px 30px 90px', minWidth: 0 }}>
          {view === 'scanner' ? <Scanner sportId={sportId} onPick={setSportId} /> : <StubView label={LABELS[view]} />}
        </main>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
