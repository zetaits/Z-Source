// ============================================================================
// Z-SOURCE — SPORT SWITCHER PROPOSAL (interactive demo)
// Everything below reads from window.SPORTS_DATA. Add a sport there → it
// shows up here automatically. Three placement variants for comparison.
// ============================================================================

const { useState, useEffect, useRef } = React;
const SPORTS = window.SPORTS_DATA;

// --------- COUNT-UP (borrowed from the real terminal) ---------------------
function CountUp({ value, format, duration = 520, style = {} }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      setV(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  const fmt = format || ((n) => n.toFixed(0));
  return <span style={style}>{fmt(v)}</span>;
}

function verdictColor(v) {
  return v === 'PLAY' ? 'var(--pos)' : v === 'LEAN' ? 'var(--accent)' : 'var(--fg-muted)';
}

// ===========================================================================
// SPORT ICONS — monoline glyphs tuned to the terminal aesthetic.
// Keyed by sport id. SCALABLE: a sport with no entry here automatically
// falls back to its 2-letter `mono`, so adding a sport never breaks the rail.
// To give a new sport an icon: add one entry below (24×24, currentColor).
// ===========================================================================
function Svg({ children }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter">
      {children}
    </svg>
  );
}
const SPORT_ICONS = {
  football: (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8.8 L15.04 11.01 L13.88 14.59 L10.12 14.59 L8.96 11.01 Z" />
      <path d="M12 8.8 L12 3.2 M15.04 11.01 L20.4 9.2 M13.88 14.59 L17.1 19.2 M10.12 14.59 L6.9 19.2 M8.96 11.01 L3.6 9.2" />
    </Svg>
  ),
  basketball: (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3 L12 21 M3 12 L21 12" />
      <path d="M12 3 Q4 12 12 21 M12 3 Q20 12 12 21" />
    </Svg>
  ),
  baseball: (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.4 3.7 Q4 12 8.4 20.3" />
      <path d="M15.6 3.7 Q20 12 15.6 20.3" />
      <path d="M6.4 8 L7.9 8.6 M6 11.5 L7.6 11.7 M6 14.5 L7.6 14.3 M6.6 17.5 L8 16.9" />
      <path d="M17.6 8 L16.1 8.6 M18 11.5 L16.4 11.7 M18 14.5 L16.4 14.3 M17.4 17.5 L16 16.9" />
    </Svg>
  ),
  tennis: (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M5 7 Q12 11.5 19 7" />
      <path d="M5 17 Q12 12.5 19 17" />
    </Svg>
  ),
  amfootball: (
    <Svg>
      <path d="M4 12 Q4 6.5 12 6.5 Q20 6.5 20 12 Q20 17.5 12 17.5 Q4 17.5 4 12 Z" />
      <path d="M12 9.4 L12 14.6" />
      <path d="M10.4 10.6 L13.6 10.6 M10.4 12 L13.6 12 M10.4 13.4 L13.6 13.4" />
      <path d="M5.6 10.6 L5.6 13.4 M18.4 10.6 L18.4 13.4" />
    </Svg>
  ),
};

// ===========================================================================
// VARIANT A — SPORT RAIL (recommended)
// Icon tile + code label. Falls back to mono letters when no icon exists.
// ===========================================================================
function SportRail({ activeId, onPick }) {
  return (
    <aside style={{
      width: 70, flex: '0 0 70px', height: '100vh',
      background: 'var(--bg)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      position: 'sticky', top: 0,
    }}>
      {/* brand mark */}
      <div style={{
        height: 46, width: '100%', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 30, height: 30, background: 'var(--accent)', color: 'var(--bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20, letterSpacing: '-0.04em',
        }}>Z</div>
      </div>

      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--fg-muted)',
        letterSpacing: '0.18em', padding: '12px 0 6px',
      }}>SPORT</div>

      <div className="zs-scroll" style={{ flex: 1, width: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, paddingBottom: 8 }}>
        {SPORTS.map(s => {
          const active = s.id === activeId;
          const disabled = !s.enabled;
          const icon = SPORT_ICONS[s.id];
          return (
            <button
              key={s.id}
              onClick={() => !disabled && onPick(s.id)}
              title={disabled ? `${s.label} — coming soon` : s.label}
              className="zs-rail-item"
              data-active={active ? '1' : undefined}
              style={{
                position: 'relative',
                width: 58, padding: '8px 0 6px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                background: 'transparent', border: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.34 : 1,
              }}
            >
              {/* active spine */}
              <span style={{
                position: 'absolute', left: 0, top: 6, bottom: 6, width: 2,
                background: active ? 'var(--accent)' : 'transparent',
                transition: 'background 120ms var(--ease-snap)',
              }} />
              <span className="zs-rail-tile" style={{
                width: 40, height: 40,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, letterSpacing: '0.02em',
                border: '1px solid',
                borderColor: active ? 'var(--accent)' : 'var(--border-hot)',
                background: active ? 'var(--accent)' : 'var(--surface)',
                color: active ? 'var(--bg)' : 'var(--fg-dim)',
                transition: 'color 120ms var(--ease-snap), background 120ms var(--ease-snap), border-color 120ms var(--ease-snap)',
              }}>
                {icon || s.mono}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: active ? 700 : 500, letterSpacing: '0.08em',
                color: active ? 'var(--accent)' : 'var(--fg-muted)',
                textTransform: 'uppercase', whiteSpace: 'nowrap',
                transition: 'color 120ms var(--ease-snap)',
              }}>{s.code}</span>
              {/* live dot */}
              {s.live && s.enabled && (
                <span className={active ? 'zs-pulse' : ''} style={{
                  position: 'absolute', top: 9, right: 9, width: 5, height: 5,
                  background: active ? 'var(--bg)' : 'var(--pos)',
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* add sport */}
      <button className="zs-rail-add" style={{
        width: '100%', padding: '12px 0', borderTop: '1px solid var(--border)',
        background: 'transparent', border: 'none', borderTop: '1px solid var(--border)',
        color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: 18, cursor: 'pointer',
      }} title="Add sport">+</button>
    </aside>
  );
}

// ===========================================================================
// VARIANT B — SIDEBAR HEADER DROPDOWN
// The active sport lives at the top of the existing sidebar as a selector.
// ===========================================================================
function SportDropdown({ activeId, onPick }) {
  const [open, setOpen] = useState(false);
  const active = SPORTS.find(s => s.id === activeId);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--fg-muted)', letterSpacing: '0.20em', marginBottom: 6 }}>── SPORT ──</div>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border-hot)',
        cursor: 'pointer', color: 'var(--fg)',
      }}>
        <span style={{
          width: 26, height: 26, flex: '0 0 26px', background: 'var(--accent)', color: 'var(--bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12,
        }}>{active.mono}</span>
        <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em', textTransform: 'uppercase' }}>{active.label}</span>
          <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-muted)', letterSpacing: '0.08em' }}>{active.code}</span>
        </span>
        <span style={{ color: 'var(--accent)', fontSize: 11, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }}>▾</span>
      </button>
      {open && (
        <div className="zs-enter-up" style={{
          position: 'absolute', left: 14, right: 14, top: '100%', zIndex: 50,
          background: 'var(--bg-2)', border: '1px solid var(--border-hot)', marginTop: -1,
        }}>
          {SPORTS.map(s => {
            const isActive = s.id === activeId;
            return (
              <button key={s.id} disabled={!s.enabled}
                onClick={() => { onPick(s.id); setOpen(false); }}
                className="zs-nav-item"
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                  background: isActive ? 'var(--accent-fill)' : 'transparent', border: 'none',
                  cursor: s.enabled ? 'pointer' : 'not-allowed', opacity: s.enabled ? 1 : 0.4,
                  color: isActive ? 'var(--accent)' : 'var(--fg-dim)',
                }}>
                <span style={{
                  width: 22, height: 22, flex: '0 0 22px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 10,
                  border: '1px solid', borderColor: isActive ? 'var(--accent)' : 'var(--border-hot)',
                  background: isActive ? 'var(--accent)' : 'transparent', color: isActive ? 'var(--bg)' : 'var(--fg-dim)',
                }}>{s.mono}</span>
                <span style={{ flex: 1, textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{s.label}</span>
                {!s.enabled && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--fg-muted)', letterSpacing: '0.10em' }}>SOON</span>}
                {s.live && s.enabled && <span style={{ width: 5, height: 5, background: 'var(--pos)' }} />}
              </button>
            );
          })}
          <button className="zs-nav-item" style={{
            width: '100%', textAlign: 'left', padding: '9px 10px', borderTop: '1px solid var(--border)',
            background: 'transparent', border: 'none', borderTop: '1px solid var(--border)',
            color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.10em', cursor: 'pointer',
          }}>+ ADD SPORT</button>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// VARIANT C — TOPBAR SEGMENTED TABS
// ===========================================================================
function SportTabs({ activeId, onPick }) {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', borderRight: '1px solid var(--border)' }}>
      {SPORTS.filter(s => s.enabled).map(s => {
        const active = s.id === activeId;
        return (
          <button key={s.id} onClick={() => onPick(s.id)} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '0 14px',
            background: active ? 'var(--accent-fill)' : 'transparent',
            border: 'none', borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer', color: active ? 'var(--accent)' : 'var(--fg-muted)',
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: active ? 700 : 500, letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            <span style={{ fontWeight: 700 }}>{s.mono}</span>
            <span>{s.label}</span>
            {s.live && <span className={active ? 'zs-pulse' : ''} style={{ width: 5, height: 5, background: active ? 'var(--accent)' : 'var(--pos)' }} />}
          </button>
        );
      })}
      <button title="Add sport" style={{
        padding: '0 12px', background: 'transparent', border: 'none',
        color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: 16, cursor: 'pointer',
      }}>+</button>
    </div>
  );
}

// ===========================================================================
// NAV SIDEBAR (shared) — labels adapt to sport terminology
// ===========================================================================
function NavSidebar({ sport, variant }) {
  const NAV = [
    { section: 'WORK', items: [
      { label: 'COMMAND', sc: '1' },
      { label: 'SCANNER', sc: '2', active: true },
      { label: sport.unit.toUpperCase() + '·LIVE', sc: '3' },
    ]},
    { section: 'PERFORMANCE', items: [
      { label: 'BANKROLL', sc: '4' }, { label: 'METRICS', sc: '5' }, { label: 'STRATEGY', sc: '6' },
    ]},
    { section: 'CFG', items: [ { label: 'SETTINGS', sc: '7' } ]},
  ];
  return (
    <aside style={{
      width: 232, flex: '0 0 232px', height: '100vh', background: 'var(--bg)',
      borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
      position: 'sticky', top: 0,
    }}>
      {variant === 'rail' ? (
        <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, letterSpacing: '-0.01em' }}>Z—SOURCE</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-muted)', letterSpacing: '0.12em' }}>{sport.code}</span>
        </div>
      ) : variant === 'header' ? (
        <SportDropdown activeId={sport.id} onPick={window.__pickSport} />
      ) : (
        <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 28, height: 28, background: 'var(--accent)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18 }}>Z</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, letterSpacing: '-0.01em' }}>Z—SOURCE</span>
        </div>
      )}

      <nav style={{ flex: 1, padding: '14px 0', overflow: 'auto' }}>
        {NAV.map(g => (
          <div key={g.section} style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-muted)', letterSpacing: '0.20em', padding: '0 18px 8px' }}>── {g.section} ──</div>
            {g.items.map(it => (
              <div key={it.label} className={`zs-nav-item ${it.active ? 'active' : ''}`} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 18px', background: it.active ? 'var(--accent-fill)' : 'transparent',
                color: it.active ? 'var(--accent)' : 'var(--fg-dim)', fontFamily: 'var(--font-mono)',
                fontSize: 11, fontWeight: it.active ? 700 : 500, letterSpacing: '0.08em', cursor: 'pointer',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--accent)', width: 8 }}>{it.active ? '▸' : ' '}</span>{it.label}
                </span>
                <span style={{ fontSize: 9, color: 'var(--fg-faint)' }}>{it.sc}</span>
              </div>
            ))}
          </div>
        ))}
      </nav>

      <div style={{ borderTop: '1px solid var(--border)', padding: '11px 18px', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-muted)', letterSpacing: '0.10em' }}>
        FEED · {sport.competitions.split('·')[0].trim()} <span style={{ color: 'var(--pos)' }}>● OK</span>
      </div>
    </aside>
  );
}

// ===========================================================================
// TOP BAR (shared)
// ===========================================================================
function TopBar({ sport, variant }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <header style={{ height: 46, flex: '0 0 46px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'stretch', background: 'var(--bg)' }}>
      {variant === 'tabs'
        ? <SportTabs activeId={sport.id} onPick={window.__pickSport} />
        : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', borderRight: '1px solid var(--border)', minWidth: 170 }}>
            <span style={{ width: 7, height: 7, background: 'var(--pos)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>{now.toLocaleTimeString('en-GB', { hour12: false })}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-muted)', letterSpacing: '0.10em' }}>SYNC 5s</span>
          </div>
        )}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', borderRight: '1px solid var(--border)', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        <span style={{ color: 'var(--accent)' }}>{'>>'}</span>
        <span>search {sport.unit}, rules, markets…</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}><span className="zs-kbd">Ctrl</span><span className="zs-kbd">K</span></span>
      </div>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {[{ k: 'BANKROLL', v: '€1,462.56', t: 'fg' }, { k: 'EXPOSURE', v: '€0.00', t: 'muted' }, { k: 'ROI', v: '+46.26%', t: 'pos' }].map(s => (
          <div key={s.k} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, padding: '0 16px', borderRight: '1px solid var(--border)', minWidth: 104 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-muted)', letterSpacing: '0.16em' }}>{s.k}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em', color: s.t === 'pos' ? 'var(--pos)' : s.t === 'muted' ? 'var(--fg-muted)' : 'var(--fg)' }}>{s.v}</div>
          </div>
        ))}
      </div>
    </header>
  );
}

// ===========================================================================
// CONTENT — sport-aware scanner. Re-renders entirely from sport config.
// ===========================================================================
function ScannerView({ sport }) {
  const playable = sport.fixtures.filter(f => f.verdict !== 'PASS').length;
  return (
    <div key={sport.id} className="zs-page-enter">
      {/* heading */}
      <div className="zs-screen-h" style={{ marginBottom: 4 }}>
        <span className="bracket">[ SCANNER ]</span>
        <span className="title">{sport.label}</span>
        <span className="sub">{sport.competitions}</span>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-dim)', margin: '10px 0 22px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 6, height: 6, background: 'var(--pos)' }} className="zs-pulse" />
        <CountUp value={sport.fixtures.length} style={{ color: 'var(--fg)', fontWeight: 600 }} /> {sport.unit} in window
        <span style={{ color: 'var(--fg-faint)' }}>·</span>
        <span style={{ color: 'var(--accent)' }}>{playable} playable</span>
        <span style={{ color: 'var(--fg-faint)' }}>·</span>
        <span>{sport.nextLabel} {sport.fixtures[0]?.time || '—'}</span>
      </div>

      {/* market chips — sport specific */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-muted)', letterSpacing: '0.12em', alignSelf: 'center', marginRight: 4 }}>MARKETS</span>
        {sport.markets.map((m, i) => (
          <span key={m} className={`zs-tag ${i === 0 ? 'amber' : ''}`}>{m}</span>
        ))}
      </div>

      {/* fixtures block */}
      <div className="zs-block">
        <div className="zs-block-head">
          <span className="l">{sport.unit.toUpperCase()} · {sport.eventLabel.toUpperCase()} WINDOW</span>
          <span className="r" style={{ color: 'var(--fg-muted)' }}>SORT ▾ {sport.eventLabel.toUpperCase()} ↑</span>
        </div>
        <table className="zs-table">
          <thead>
            <tr>
              <th style={{ width: 70 }}>{sport.eventLabel}</th>
              <th>matchup</th>
              <th>competition</th>
              <th className="num">best edge</th>
              <th className="num">picks</th>
              <th style={{ width: 90 }}>verdict</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {sport.fixtures.map((f, i) => (
              <tr key={i}>
                <td className="row-key" style={{ fontVariantNumeric: 'tabular-nums' }}>{f.time}</td>
                <td>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-muted)', border: '1px solid var(--border-hot)', padding: '1px 4px' }}>{f.aS}</span>
                    <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{f.a}</span>
                    <span style={{ color: 'var(--fg-faint)' }}>vs</span>
                    <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{f.b}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-muted)', border: '1px solid var(--border-hot)', padding: '1px 4px' }}>{f.bS}</span>
                  </span>
                </td>
                <td className="muted" style={{ fontSize: 10, letterSpacing: '0.06em' }}>{f.comp}</td>
                <td className="num" style={{ color: f.edge > 0 ? 'var(--pos)' : 'var(--fg-muted)' }}>{f.edge > 0 ? '+' + f.edge.toFixed(2) + '%' : '—'}</td>
                <td className="num">{f.picks || '—'}</td>
                <td>
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', color: verdictColor(f.verdict), border: `1px solid ${verdictColor(f.verdict)}`, padding: '2px 7px' }}>
                    {f.verdict === 'PLAY' ? '▲' : f.verdict === 'LEAN' ? '◆' : '▽'} {f.verdict}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-muted)', letterSpacing: '0.08em' }}>ANALYZE ›</span>
                </td>
              </tr>
            ))}
            {sport.fixtures.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                ── no {sport.unit} in window · feed not yet enabled ──
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===========================================================================
// PLACEMENT CONTROL (compare the 3 variants)
// ===========================================================================
function PlacementControl({ variant, setVariant }) {
  const opts = [
    { id: 'rail', label: 'Rail', desc: 'vertical workspace switcher' },
    { id: 'header', label: 'Sidebar', desc: 'dropdown in sidebar header' },
    { id: 'tabs', label: 'Topbar', desc: 'segmented tabs' },
  ];
  return (
    <div style={{
      position: 'fixed', bottom: 18, right: 18, zIndex: 200,
      background: 'var(--bg-2)', border: '1px solid var(--border-hot)', padding: 12, width: 232,
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-muted)', letterSpacing: '0.16em', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
        <span>┏━ SWITCHER PLACEMENT</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {opts.map(o => {
          const active = variant === o.id;
          return (
            <button key={o.id} onClick={() => setVariant(o.id)} style={{
              display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start',
              padding: '7px 10px', background: active ? 'var(--accent-fill)' : 'var(--surface)',
              border: '1px solid', borderColor: active ? 'var(--accent)' : 'var(--border)',
              cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: active ? 'var(--accent)' : 'var(--fg)', textTransform: 'uppercase' }}>
                {active ? '▸ ' : '  '}{o.label}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-muted)', letterSpacing: '0.04em' }}>{o.desc}</span>
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 10, paddingTop: 9, borderTop: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-faint)', letterSpacing: '0.04em', lineHeight: 1.6 }}>
        switch sport: click · or <span className="zs-kbd" style={{ fontSize: 9, height: 15 }}>[</span> <span className="zs-kbd" style={{ fontSize: 9, height: 15 }}>]</span> to cycle
      </div>
    </div>
  );
}

// ===========================================================================
// APP
// ===========================================================================
function App() {
  const enabled = SPORTS.filter(s => s.enabled);
  const [sportId, setSportId] = useState('football');
  const [variant, setVariant] = useState('rail');
  const sport = SPORTS.find(s => s.id === sportId);

  // expose picker for sub-components rendered in shared chrome
  window.__pickSport = setSportId;

  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === '[' || e.key === ']') {
        const idx = enabled.findIndex(s => s.id === sportId);
        const next = e.key === ']' ? (idx + 1) % enabled.length : (idx - 1 + enabled.length) % enabled.length;
        setSportId(enabled[next].id);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [sportId]);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {variant === 'rail' && <SportRail activeId={sportId} onPick={setSportId} />}
      <NavSidebar sport={sport} variant={variant} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh' }}>
        <TopBar sport={sport} variant={variant} />
        <main className="zs-scroll" style={{ flex: 1, overflow: 'auto', padding: '26px 30px 90px', minWidth: 0 }}>
          <ScannerView sport={sport} />
        </main>
      </div>
      <PlacementControl variant={variant} setVariant={setVariant} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
