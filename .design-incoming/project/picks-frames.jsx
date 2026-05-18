/* global React */
const { useState } = React;

/* ===========================================================
   Shared bits
=========================================================== */

window.MatchHeader = function MatchHeader({ home = "Atlético Madrid", away = "Sevilla", kickoff = "Tomorrow · 21:00", league = "LaLiga · MD32" }) {
  return (
    <div className="matchhdr">
      <div className="team home">
        <span className="team-bullet" />
        <span>{home}</span>
      </div>
      <div className="vs">
        <div style={{ marginBottom: 4, color: 'var(--zs-fg-muted)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{league}</div>
        <div style={{ color: 'var(--zs-fg)', fontSize: 13 }}>{kickoff}</div>
      </div>
      <div className="team away">
        <span className="team-bullet" />
        <span>{away}</span>
      </div>
    </div>
  );
};

window.TabStrip = function TabStrip({ active = "picks" }) {
  const tabs = ["picks", "lines", "matchup", "trends", "splits", "sentiment", "intangibles"];
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--zs-border)', padding: '0 28px', background: 'var(--zs-bg)' }}>
      {tabs.map(t => (
        <span key={t} className={`tab ${t === active ? 'active' : ''}`}>{t}</span>
      ))}
    </div>
  );
};

/* Annotation callout used in mockups */
window.Annot = function Annot({ kind = 'info', children, style }) {
  return <div className={`annot ${kind === 'good' ? 'annot-good' : kind === 'warn' ? '' : 'annot-info'}`} style={style}>{children}</div>;
};

/* Reusable odds grid — the centerpiece of the redesign */
window.OddsGrid = function OddsGrid({ rows }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((row, ri) => (
        <div key={ri}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="kicker" style={{ color: 'var(--zs-fg-dim)' }}>{row.market}</span>
              <span style={{ fontSize: 13, color: 'var(--zs-fg)', fontWeight: 600 }}>{row.label}</span>
              {row.line !== undefined && <span className="font-mono tabular" style={{ fontSize: 12, color: 'var(--zs-fg-muted)' }}>line {row.line}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              {row.movement && <span className="font-mono tabular" style={{ fontSize: 11, color: row.movement.startsWith('+') ? 'var(--zs-pos)' : 'var(--zs-neg)' }}>{row.movement} 24h</span>}
              <span className="kicker">{row.bookCount} books</span>
            </div>
          </div>
          <div className="odds-grid" style={{ gridTemplateColumns: `repeat(${row.cells.length}, 1fr)` }}>
            {row.cells.map((c, ci) => (
              <div key={ci} className={`odds-cell ${c.best ? 'best' : ''} ${c.picked ? 'picked' : ''}`}>
                <span className="lab">{c.label}</span>
                <span className="val">{c.odds}</span>
                <span className="sub">
                  <span className="book-pip" />{c.book}
                  {c.fair && <span style={{ marginLeft: 8, color: 'var(--zs-fg-muted)' }}>fair {c.fair}</span>}
                </span>
                {c.edge !== undefined && (
                  <span className="font-mono tabular" style={{ fontSize: 11, color: c.edge > 0 ? 'var(--zs-pos)' : 'var(--zs-fg-muted)', marginTop: 2 }}>
                    edge {c.edge > 0 ? '+' : ''}{c.edge.toFixed(2)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

/* ===========================================================
   PICKS TAB — odds-visible, with picks
=========================================================== */
window.PicksFrameWithPicks = function PicksFrameWithPicks() {
  const oddsRows = [
    {
      market: "ML_1X2", label: "Match result", bookCount: 14, movement: "+3¢",
      cells: [
        { label: "Home", odds: "2.18", book: "Pinnacle", fair: "44.8%", best: false, picked: false, edge: -2.1 },
        { label: "Draw", odds: "3.55", book: "Bet365", fair: "27.4%", best: false, picked: false, edge: -2.8 },
        { label: "Away", odds: "3.40", book: "Pinnacle", fair: "33.1%", best: true, picked: true, edge: 4.32 },
      ]
    },
    {
      market: "OU_GOALS", label: "Total goals", line: 2.5, bookCount: 12, movement: "−2¢",
      cells: [
        { label: "Over 2.5", odds: "1.92", book: "Bet365", fair: "51.2%", best: false, picked: false, edge: -1.7 },
        { label: "Under 2.5", odds: "1.98", book: "Pinnacle", fair: "48.8%", best: true, picked: true, edge: 1.85 },
      ]
    },
    {
      market: "BTTS", label: "Both teams to score", bookCount: 10,
      cells: [
        { label: "Yes", odds: "1.80", book: "Pinnacle", fair: "57.1%", best: true, picked: false, edge: 0.4 },
        { label: "No", odds: "2.05", book: "Bet365", fair: "42.9%", best: false, picked: false, edge: -2.1 },
      ]
    },
    {
      market: "AH", label: "Asian handicap", line: "+0.25 away", bookCount: 8,
      cells: [
        { label: "Home -0.25", odds: "2.05", book: "Pinnacle", fair: "—", best: false, picked: false },
        { label: "Away +0.25", odds: "1.85", book: "Bet365", fair: "—", best: true, picked: false },
      ]
    },
  ];

  return (
    <div style={{ width: 1280, background: 'var(--zs-bg)', display: 'flex', flexDirection: 'column' }}>
      <MatchHeader />
      <TabStrip active="picks" />

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, padding: 24, alignItems: 'start' }}>

        {/* LEFT — Picks + ODDS BOARD */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Pick callouts (compact) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Picks · 2 candidates</span>
              <span className="kicker">sorted by edge</span>
            </div>
            <span className="kicker">2 of 9 selections cleared threshold</span>
          </div>

          {/* Top pick — slimmer than current PlayCard so the board is the hero */}
          <div style={{ display: 'grid', gridTemplateColumns: '4px 1fr auto', borderRadius: 8, overflow: 'hidden', background: 'var(--zs-bg-elev)', border: '1px solid color-mix(in oklch, var(--zs-pos) 40%, var(--zs-border))' }}>
            <div style={{ background: 'var(--zs-pos)' }} />
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="kicker">ML_1X2</span>
                <span style={{ fontSize: 15, fontWeight: 600 }}>Away · Sevilla</span>
                <span className="pill pill-sharp" style={{ height: 18, fontSize: 10 }}>Strong</span>
              </div>
              <div className="font-mono tabular" style={{ fontSize: 11, color: 'var(--zs-fg-dim)' }}>
                fair 33.1% · 3.40 @ Pinnacle · conf 78 · stake 1.4u
              </div>
            </div>
            <div style={{ padding: '12px 18px', borderLeft: '1px solid var(--zs-border)', background: 'var(--zs-pos-fill)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
              <span className="kicker" style={{ color: 'var(--zs-pos)' }}>Edge</span>
              <span style={{ fontSize: 24, fontWeight: 600, color: 'var(--zs-pos)', lineHeight: 1 }}>+4.32%</span>
            </div>
          </div>

          {/* second pick */}
          <div style={{ display: 'grid', gridTemplateColumns: '4px 1fr auto', borderRadius: 8, overflow: 'hidden', background: 'var(--zs-bg-elev)', border: '1px solid var(--zs-border)' }}>
            <div style={{ background: 'var(--zs-info)', opacity: 0.55 }} />
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="kicker">OU_GOALS</span>
                <span style={{ fontSize: 15, fontWeight: 600 }}>Under 2.5</span>
              </div>
              <div className="font-mono tabular" style={{ fontSize: 11, color: 'var(--zs-fg-dim)' }}>
                fair 48.8% · 1.98 @ Pinnacle · conf 64 · stake 0.8u
              </div>
            </div>
            <div style={{ padding: '12px 18px', borderLeft: '1px solid var(--zs-border)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
              <span className="kicker" style={{ color: 'var(--zs-info)' }}>Edge</span>
              <span style={{ fontSize: 24, fontWeight: 600, color: 'var(--zs-info)', lineHeight: 1 }}>+1.85%</span>
            </div>
          </div>

          {/* THE NEW THING — full odds board, with picks highlighted in-place */}
          <div style={{ borderTop: '1px dashed var(--zs-border)', paddingTop: 16, marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Odds board</span>
                <span className="kicker">all markets · best price</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="pill pill-ghost" style={{ height: 22 }}>Best price</span>
                <span className="pill pill-ghost" style={{ height: 22 }}>Show all books ↓</span>
              </div>
            </div>
            <Annot kind="good" style={{ marginBottom: 12 }}>
              FIX · cuotas siempre visibles aquí. Picks highlighted in green; best non-pick price in cyan. Same grid even when 0 picks clear the threshold.
            </Annot>
            <OddsGrid rows={oddsRows} />
          </div>
        </div>

        {/* RIGHT — reasoning, plus a new "Why this pick" mini-summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 0 }}>
          <div className="bg-elev border-zs" style={{ borderRadius: 8, padding: 16 }}>
            <div className="kicker" style={{ marginBottom: 10 }}>Reasoning · Away ML_1X2</div>

            {/* NEW — plain-language summary */}
            <div style={{ background: 'var(--zs-surface)', borderRadius: 6, padding: '10px 12px', marginBottom: 12, border: '1px solid var(--zs-border)' }}>
              <div className="kicker" style={{ marginBottom: 4, color: 'var(--zs-info)' }}>Summary</div>
              <div style={{ fontSize: 12.5, color: 'var(--zs-fg-dim)', lineHeight: 1.55 }}>
                Sharp money on Sevilla (+8% steam in 6h), Atléti missing 2 KEY defenders, market still pricing home advantage at full strength. Model fair 33.1% vs market 29.4%.
              </div>
            </div>

            {/* trace, condensed */}
            {[
              { label: 'fair from de-vigged composite', v: '33.1%', tone: 'fg' },
              { label: 'market implied (Pinnacle)', v: '29.4%', tone: 'muted' },
              { label: 'sharp move (6h)', v: '+8.1%', tone: 'pos' },
              { label: 'public on home', v: '71%', tone: 'warn' },
              { label: 'KEY injuries home', v: '2', tone: 'neg' },
              { label: 'rest advantage away', v: '+2d', tone: 'pos' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--zs-border)', fontSize: 12 }}>
                <span style={{ color: 'var(--zs-fg-dim)' }}>{r.label}</span>
                <span className="font-mono tabular" style={{ color: r.tone === 'pos' ? 'var(--zs-pos)' : r.tone === 'neg' ? 'var(--zs-neg)' : r.tone === 'warn' ? 'var(--zs-warn)' : r.tone === 'muted' ? 'var(--zs-fg-muted)' : 'var(--zs-fg)' }}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ===========================================================
   PICKS TAB — odds-visible, NO picks (the painful state)
=========================================================== */
window.PicksFrameNoPicks = function PicksFrameNoPicks() {
  const oddsRows = [
    {
      market: "ML_1X2", label: "Match result", bookCount: 14, movement: "+1¢",
      cells: [
        { label: "Home", odds: "1.92", book: "Pinnacle", fair: "53.0%", best: true, picked: false, edge: -1.6 },
        { label: "Draw", odds: "3.60", book: "Bet365", fair: "27.0%", best: true, picked: false, edge: -2.7 },
        { label: "Away", odds: "4.20", book: "Pinnacle", fair: "20.0%", best: true, picked: false, edge: -1.0 },
      ]
    },
    {
      market: "OU_GOALS", label: "Total goals", line: 2.5, bookCount: 12,
      cells: [
        { label: "Over 2.5", odds: "1.95", book: "Pinnacle", fair: "50.5%", best: true, picked: false, edge: -1.5 },
        { label: "Under 2.5", odds: "1.92", book: "Bet365", fair: "49.5%", best: true, picked: false, edge: -1.0 },
      ]
    },
    {
      market: "BTTS", label: "Both teams to score", bookCount: 10,
      cells: [
        { label: "Yes", odds: "1.78", book: "Pinnacle", fair: "55.0%", best: true, picked: false, edge: -2.1 },
        { label: "No", odds: "2.10", book: "Bet365", fair: "45.0%", best: true, picked: false, edge: -5.5 },
      ]
    },
  ];

  return (
    <div style={{ width: 1280, background: 'var(--zs-bg)', display: 'flex', flexDirection: 'column' }}>
      <MatchHeader home="Real Betis" away="Getafe" />
      <TabStrip active="picks" />

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* No-pick banner — keeps the diagnostic but doesn't take over the screen */}
        <div style={{ background: 'var(--zs-bg-elev)', border: '1px solid var(--zs-border)', borderRadius: 8, padding: '14px 18px', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 18, alignItems: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--zs-warn-fill)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--zs-warn)', fontSize: 18 }}>○</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--zs-fg)' }}>No picks cleared the threshold</div>
            <div style={{ fontSize: 12, color: 'var(--zs-fg-muted)', marginTop: 2 }}>
              Best edge was <span className="font-mono">−1.0%</span> on Away ML. Loosen stake policy in Strategy, or scroll to the odds board below to inspect the market yourself.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="pill pill-ghost">Strategy →</span>
            <span className="pill pill-info">Show marginal</span>
          </div>
        </div>

        <Annot kind="good">
          FIX · today the no-pick state shows ONLY the empty banner. Now we always render the full board so you can read the market regardless.
        </Annot>

        {/* Full-width odds board */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Odds board</span>
            <span className="kicker">no plays · viewer mode</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <span className="pill pill-ghost">Best price</span>
            <span className="pill pill-ghost">All books ↓</span>
            <span className="pill pill-ghost">Compare to opener</span>
          </div>
        </div>

        <OddsGrid rows={oddsRows} />

        {/* Mini "closest to threshold" rail — gives the user a scent of why nothing fired */}
        <div className="bg-elev border-zs" style={{ borderRadius: 8, padding: 16 }}>
          <div className="kicker" style={{ marginBottom: 12 }}>Closest to threshold · sorted by edge</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { sel: "Away · ML_1X2", edge: -1.0, fair: '20.0%', mkt: '23.8%', stake: 0 },
              { sel: "Under 2.5 · OU_GOALS", edge: -1.0, fair: '49.5%', mkt: '52.1%', stake: 0 },
              { sel: "Over 2.5 · OU_GOALS", edge: -1.5, fair: '50.5%', mkt: '51.3%', stake: 0 },
            ].map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 80px 90px', alignItems: 'center', gap: 14, fontSize: 12, padding: '6px 8px', borderRadius: 4, background: i === 0 ? 'var(--zs-surface)' : 'transparent' }}>
                <span style={{ color: 'var(--zs-fg)' }}>{r.sel}</span>
                <span className="font-mono tabular text-fg-muted">fair {r.fair}</span>
                <span className="font-mono tabular text-fg-muted">market {r.mkt}</span>
                <span className="font-mono tabular" style={{ color: 'var(--zs-neg)' }}>edge {r.edge}%</span>
                <div className="edge-bar"><span style={{ width: '20%', background: 'var(--zs-neg)' }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { });
