// ============================================================================
// Z-SOURCE — shared chrome (faithful to the real shell): icons, sidebar,
// topbar, ticker. Nav order matches production. Nav is GENERAL — no sport
// state leaks into it, because only the Scanner is sport-scoped.
// ============================================================================

const { useState, useEffect, useRef } = React;
const SPORTS = window.SPORTS_DATA;

// --------- count-up -------------------------------------------------------
function CountUp({ value, format, duration = 620, style = {} }) {
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

// --------- monoline sport icons (currentColor → auto-invert) --------------
function Svg({ size = 22, children }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter">
      {children}
    </svg>
  );
}
const SPORT_ICONS = {
  football: (s) => (<Svg size={s}><circle cx="12" cy="12" r="9" /><path d="M12 8.8 L15.04 11.01 L13.88 14.59 L10.12 14.59 L8.96 11.01 Z" /><path d="M12 8.8 L12 3.2 M15.04 11.01 L20.4 9.2 M13.88 14.59 L17.1 19.2 M10.12 14.59 L6.9 19.2 M8.96 11.01 L3.6 9.2" /></Svg>),
  basketball: (s) => (<Svg size={s}><circle cx="12" cy="12" r="9" /><path d="M12 3 L12 21 M3 12 L21 12" /><path d="M12 3 Q4 12 12 21 M12 3 Q20 12 12 21" /></Svg>),
  baseball: (s) => (<Svg size={s}><circle cx="12" cy="12" r="9" /><path d="M8.4 3.7 Q4 12 8.4 20.3" /><path d="M15.6 3.7 Q20 12 15.6 20.3" /><path d="M6.4 8 L7.9 8.6 M6 11.5 L7.6 11.7 M6 14.5 L7.6 14.3 M6.6 17.5 L8 16.9" /><path d="M17.6 8 L16.1 8.6 M18 11.5 L16.4 11.7 M18 14.5 L16.4 14.3 M17.4 17.5 L16 16.9" /></Svg>),
  tennis: (s) => (<Svg size={s}><circle cx="12" cy="12" r="9" /><path d="M5 7 Q12 11.5 19 7" /><path d="M5 17 Q12 12.5 19 17" /></Svg>),
  amfootball: (s) => (<Svg size={s}><path d="M4 12 Q4 6.5 12 6.5 Q20 6.5 20 12 Q20 17.5 12 17.5 Q4 17.5 4 12 Z" /><path d="M12 9.4 L12 14.6" /><path d="M10.4 10.6 L13.6 10.6 M10.4 12 L13.6 12 M10.4 13.4 L13.6 13.4" /><path d="M5.6 10.6 L5.6 13.4 M18.4 10.6 L18.4 13.4" /></Svg>),
};
// Icon tile w/ mono-letter fallback. SCALABLE: no icon entry → shows `mono`.
function SportGlyph({ sport, size = 32, iconSize = 20, active = false, ghost = false }) {
  const icon = SPORT_ICONS[sport.id];
  return (
    <span style={{
      width: size, height: size, flex: `0 0 ${size}px`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '1px solid', borderColor: active ? 'var(--accent)' : 'var(--border-hot)',
      background: active ? 'var(--accent)' : ghost ? 'transparent' : 'var(--surface)',
      color: active ? 'var(--bg)' : 'var(--fg-dim)',
      fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: Math.round(size * 0.36),
      transition: 'color 140ms var(--ease-snap), background 140ms var(--ease-snap), border-color 140ms var(--ease-snap)',
    }}>
      {icon ? icon(iconSize) : sport.mono}
    </span>
  );
}

// helper: playable edges for a sport
function edgeCount(sport) { return sport.fixtures.filter(f => f.verdict !== 'PASS').length; }

// --------- SIDEBAR (real nav order; general, sport-agnostic) --------------
function Sidebar({ current, onNav }) {
  const NAV = [
    { section: 'WORK', items: [
      { id: 'command', label: 'COMMAND', sc: '1' },
      { id: 'scanner', label: 'SCANNER', sc: '2' },
      { id: 'match', label: 'MATCH·LIVE', sc: '3' },
    ]},
    { section: 'PERFORMANCE', items: [
      { id: 'bankroll', label: 'BANKROLL', sc: '4' },
      { id: 'metrics', label: 'METRICS', sc: '5' },
      { id: 'strategy', label: 'STRATEGY', sc: '6' },
    ]},
    { section: 'CFG', items: [ { id: 'settings', label: 'SETTINGS', sc: '7' } ]},
  ];
  const feeds = [
    { id: 'pinnacle', used: '4.1k', cap: '5k', ok: true },
    { id: 'betfair-x', used: '2.3k', cap: '5k', ok: true },
    { id: 'oddsjam', used: '880', cap: null, ok: false },
  ];
  return (
    <aside style={{
      width: 240, flex: '0 0 240px', height: '100vh', background: 'var(--bg)',
      borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
      position: 'sticky', top: 0,
    }}>
      <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: 'var(--accent)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22, letterSpacing: '-0.04em' }}>Z</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em', lineHeight: 1 }}>Z—SOURCE</div>
        </div>
      </div>
      <nav style={{ flex: 1, padding: '14px 0', overflow: 'auto' }}>
        {NAV.map(group => (
          <div key={group.section} style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-muted)', letterSpacing: '0.20em', padding: '0 18px 8px' }}>── {group.section} ──</div>
            {group.items.map(item => {
              const active = current === item.id;
              return (
                <button key={item.id} onClick={() => onNav(item.id)} className={`zs-nav-item ${active ? 'active' : ''}`} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                  padding: '8px 18px', background: active ? 'var(--accent-fill)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--fg-dim)', fontFamily: 'var(--font-mono)',
                  fontSize: 11, fontWeight: active ? 700 : 500, letterSpacing: '0.08em', textAlign: 'left',
                  border: 'none', cursor: 'pointer',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--accent)', width: 8, opacity: active ? 1 : 0 }}>▸</span>{item.label}
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--fg-faint)' }}>{item.sc}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div style={{ borderTop: '1px solid var(--border)', padding: '12px 18px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-muted)', letterSpacing: '0.18em', marginBottom: 8 }}>── FEEDS ──</div>
        {feeds.map(p => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, marginBottom: 4 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--fg-dim)' }}>
              <span style={{ width: 5, height: 5, background: p.ok ? 'var(--pos)' : 'var(--accent)' }} />{p.id}
            </span>
            <span style={{ color: p.cap ? 'var(--fg)' : 'var(--fg-muted)' }}>{p.cap ? `${p.used}/${p.cap}` : p.used}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

// --------- TOP BAR --------------------------------------------------------
function TopBar() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const KPIS = [
    { k: 'BANKROLL', v: 1462.56, fmt: (n) => '€' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','), tone: 'fg' },
    { k: 'EXPOSURE', v: 0, fmt: (n) => '€' + n.toFixed(2), tone: 'muted' },
    { k: 'CLV·30D', v: 0.80, fmt: (n) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%', tone: 'pos' },
    { k: 'ROI', v: 46.26, fmt: (n) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%', tone: 'pos' },
  ];
  return (
    <header style={{ height: 46, flex: '0 0 46px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'stretch', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px', borderRight: '1px solid var(--border)', minWidth: 200 }}>
        <span style={{ width: 7, height: 7, background: 'var(--pos)' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>{now.toLocaleTimeString('en-GB', { hour12: false })}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-muted)', letterSpacing: '0.10em' }}>SYNC 5s</span>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px', borderRight: '1px solid var(--border)', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        <span style={{ color: 'var(--accent)' }}>{'>>'}</span>
        <span>search fixtures, rules, markets…</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}><span className="zs-kbd">Ctrl</span><span className="zs-kbd">K</span></span>
      </div>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {KPIS.map(s => (
          <div key={s.k} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, padding: '0 18px', borderRight: '1px solid var(--border)', minWidth: 110 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-muted)', letterSpacing: '0.16em' }}>{s.k}</div>
            <CountUp value={s.v} format={s.fmt} style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: s.tone === 'pos' ? 'var(--pos)' : s.tone === 'muted' ? 'var(--fg-muted)' : 'var(--fg)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }} />
          </div>
        ))}
      </div>
    </header>
  );
}

// --------- TICKER ---------------------------------------------------------
function Ticker() {
  const items = [
    { k: 'MCI AH+1.5', v: '+3.08%', tone: 'pos' }, { k: 'LAL/BOS o224.5', v: '+2.71%', tone: 'pos' },
    { k: 'STEAM', v: 'NYK -3.5 ↓', tone: 'fg' }, { k: 'ALC/SIN o22.5', v: '+2.33%', tone: 'pos' },
    { k: 'CLV 30D', v: '+0.80%', tone: 'pos' }, { k: 'LAD RL-1.5', v: '+2.88%', tone: 'pos' },
  ];
  return (
    <div style={{ height: 28, flex: '0 0 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
      <div style={{ flex: '0 0 auto', padding: '0 14px', height: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', color: 'var(--bg)', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', zIndex: 1 }}>EDGE FEED ▸</div>
      <div style={{ overflow: 'hidden', flex: 1 }}>
        <div className="zs-ticker" style={{ padding: '0 24px' }}>
          {[...items, ...items].map((t, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.04em' }}>
              <span style={{ color: 'var(--fg-muted)' }}>{t.k}</span>
              <span style={{ color: t.tone === 'pos' ? 'var(--pos)' : 'var(--fg)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{t.v}</span>
              <span style={{ color: 'var(--fg-faint)' }}>·</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { React, useState, useEffect, useRef, SPORTS, CountUp, SportGlyph, SPORT_ICONS, edgeCount, Sidebar, TopBar, Ticker });
