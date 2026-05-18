/* global React */

/* ===========================================================
   ODDS TABLE v2 — terminal-style market board
   - Markets in a left rail (ML / OU / AH / BTTS / DTC / DNB ...)
   - Rows = lines / selections (incl. alternates)
   - Cols = books, with an aggregate "best" column on the left
   - Picks marked with a thin chevron, NOT a filled card
=========================================================== */

const BOOKS = ['Pinnacle', 'Bet365', 'William', 'Betfair', '1xBet'];

/* Each market shape: { key, label, header: ['Sel','Line'?], rows: [{sel, line?, picked?, best:{book,odds,fair?,edge?}, books:{book:{odds, move?}}}] } */

const MARKET_DATA = {
  ML_1X2: {
    label: 'Match result · 1X2',
    cols: ['Selection'],
    rows: [
      { sel: 'Atlético', best: { book: 'Pinnacle', odds: 2.18 }, fair: '44.8%', mkt: '45.9%', edge: -2.1, picked: false,
        books: { Pinnacle: 2.18, Bet365: 2.15, William: 2.12, Betfair: 2.20, '1xBet': 2.16 } },
      { sel: 'Draw', best: { book: 'Bet365', odds: 3.55 }, fair: '27.4%', mkt: '28.2%', edge: -2.8, picked: false,
        books: { Pinnacle: 3.50, Bet365: 3.55, William: 3.45, Betfair: 3.60, '1xBet': 3.50 } },
      { sel: 'Sevilla', best: { book: 'Pinnacle', odds: 3.40 }, fair: '33.1%', mkt: '29.4%', edge: 4.32, picked: true,
        books: { Pinnacle: 3.40, Bet365: 3.30, William: 3.25, Betfair: 3.45, '1xBet': 3.35 } },
    ],
  },
  OU_GOALS: {
    label: 'Total goals',
    cols: ['Side', 'Line'],
    rows: [
      { sel: 'Over',  line: 1.5, best: { book: 'Pinnacle', odds: 1.34 }, fair: '76.8%', mkt: '74.6%', edge: 2.95,
        books: { Pinnacle: 1.34, Bet365: 1.33, William: 1.32, Betfair: 1.35, '1xBet': 1.33 } },
      { sel: 'Under', line: 1.5, best: { book: 'Bet365', odds: 3.40 }, fair: '23.2%', mkt: '29.4%', edge: -21.0,
        books: { Pinnacle: 3.30, Bet365: 3.40, William: 3.20, Betfair: 3.35, '1xBet': 3.25 } },
      { sel: 'Over',  line: 2.0, best: { book: 'Pinnacle', odds: 1.62 }, fair: '64.5%', mkt: '61.7%', edge: 4.51,
        books: { Pinnacle: 1.62, Bet365: 1.60, William: 1.58, Betfair: 1.63, '1xBet': 1.60 } },
      { sel: 'Under', line: 2.0, best: { book: 'Bet365', odds: 2.30 }, fair: '35.5%', mkt: '43.5%', edge: -18.4,
        books: { Pinnacle: 2.25, Bet365: 2.30, William: 2.20, Betfair: 2.28, '1xBet': 2.22 } },
      { sel: 'Over',  line: 2.5, best: { book: 'Bet365', odds: 1.92 }, fair: '51.2%', mkt: '52.1%', edge: -1.7,
        books: { Pinnacle: 1.90, Bet365: 1.92, William: 1.88, Betfair: 1.93, '1xBet': 1.89 } },
      { sel: 'Under', line: 2.5, best: { book: 'Pinnacle', odds: 1.98 }, fair: '48.8%', mkt: '50.5%', edge: 1.85, picked: true,
        books: { Pinnacle: 1.98, Bet365: 1.95, William: 1.92, Betfair: 1.97, '1xBet': 1.94 } },
      { sel: 'Over',  line: 3.0, best: { book: 'Pinnacle', odds: 2.55 }, fair: '38.4%', mkt: '39.2%', edge: -2.0,
        books: { Pinnacle: 2.55, Bet365: 2.50, William: 2.45, Betfair: 2.58, '1xBet': 2.52 } },
      { sel: 'Under', line: 3.0, best: { book: 'Bet365', odds: 1.55 }, fair: '61.6%', mkt: '64.5%', edge: -4.5,
        books: { Pinnacle: 1.52, Bet365: 1.55, William: 1.50, Betfair: 1.54, '1xBet': 1.51 } },
      { sel: 'Over',  line: 3.5, best: { book: 'Pinnacle', odds: 3.80 }, fair: '24.5%', mkt: '26.3%', edge: -6.8 ,
        books: { Pinnacle: 3.80, Bet365: 3.75, William: 3.70, Betfair: 3.85, '1xBet': 3.78 } },
      { sel: 'Under', line: 3.5, best: { book: 'Bet365', odds: 1.27 }, fair: '75.5%', mkt: '78.7%', edge: -4.0,
        books: { Pinnacle: 1.25, Bet365: 1.27, William: 1.24, Betfair: 1.26, '1xBet': 1.25 } },
    ],
  },
  AH: {
    label: 'Asian handicap',
    cols: ['Selection', 'Line'],
    rows: [
      { sel: 'Atlético', line: '−0.75', best: { book: 'Pinnacle', odds: 2.45 }, fair: '40.0%', mkt: '40.8%', edge: -2.0,
        books: { Pinnacle: 2.45, Bet365: 2.40, William: 2.35, Betfair: 2.48, '1xBet': 2.42 } },
      { sel: 'Sevilla',  line: '+0.75', best: { book: 'Bet365', odds: 1.62 }, fair: '60.0%', mkt: '61.7%', edge: -2.8,
        books: { Pinnacle: 1.60, Bet365: 1.62, William: 1.58, Betfair: 1.61, '1xBet': 1.60 } },
      { sel: 'Atlético', line: '−0.5',  best: { book: 'Pinnacle', odds: 2.10 }, fair: '46.0%', mkt: '47.6%', edge: -3.4,
        books: { Pinnacle: 2.10, Bet365: 2.05, William: 2.02, Betfair: 2.12, '1xBet': 2.08 } },
      { sel: 'Sevilla',  line: '+0.5',  best: { book: 'Bet365', odds: 1.85 }, fair: '54.0%', mkt: '54.1%', edge: -0.1,
        books: { Pinnacle: 1.83, Bet365: 1.85, William: 1.80, Betfair: 1.84, '1xBet': 1.82 } },
      { sel: 'Atlético', line: '−0.25', best: { book: 'Pinnacle', odds: 1.92 }, fair: '50.5%', mkt: '52.1%', edge: -3.0,
        books: { Pinnacle: 1.92, Bet365: 1.90, William: 1.88, Betfair: 1.93, '1xBet': 1.90 } },
      { sel: 'Sevilla',  line: '+0.25', best: { book: 'Bet365', odds: 2.02 }, fair: '49.5%', mkt: '49.5%', edge: 0.0,
        books: { Pinnacle: 2.00, Bet365: 2.02, William: 1.98, Betfair: 2.01, '1xBet': 1.99 } },
      { sel: 'Atlético', line: '0',     best: { book: 'Pinnacle', odds: 1.72 }, fair: '60.5%', mkt: '58.1%', edge: 4.13,
        books: { Pinnacle: 1.72, Bet365: 1.70, William: 1.68, Betfair: 1.73, '1xBet': 1.71 } },
      { sel: 'Sevilla',  line: '0',     best: { book: 'Bet365', odds: 2.30 }, fair: '39.5%', mkt: '43.5%', edge: -9.2,
        books: { Pinnacle: 2.25, Bet365: 2.30, William: 2.22, Betfair: 2.28, '1xBet': 2.24 } },
    ],
  },
  BTTS: {
    label: 'Both teams to score',
    cols: ['Selection'],
    rows: [
      { sel: 'Yes', best: { book: 'Pinnacle', odds: 1.80 }, fair: '57.5%', mkt: '55.6%', edge: 0.4,
        books: { Pinnacle: 1.80, Bet365: 1.78, William: 1.75, Betfair: 1.81, '1xBet': 1.79 } },
      { sel: 'No',  best: { book: 'Bet365', odds: 2.05 }, fair: '42.5%', mkt: '48.8%', edge: -2.1,
        books: { Pinnacle: 2.00, Bet365: 2.05, William: 1.98, Betfair: 2.03, '1xBet': 2.00 } },
    ],
  },
  DNB: {
    label: 'Draw no bet',
    cols: ['Selection'],
    rows: [
      { sel: 'Atlético', best: { book: 'Pinnacle', odds: 1.55 }, fair: '63.5%', mkt: '64.5%', edge: -1.6,
        books: { Pinnacle: 1.55, Bet365: 1.53, William: 1.50, Betfair: 1.56, '1xBet': 1.54 } },
      { sel: 'Sevilla',  best: { book: 'Bet365', odds: 2.55 }, fair: '36.5%', mkt: '39.2%', edge: -6.9,
        books: { Pinnacle: 2.50, Bet365: 2.55, William: 2.48, Betfair: 2.52, '1xBet': 2.50 } },
    ],
  },
};

const MARKET_KEYS = ['ML_1X2', 'OU_GOALS', 'AH', 'BTTS', 'DNB'];
const MARKET_PICK_COUNTS = { ML_1X2: 1, OU_GOALS: 1, AH: 0, BTTS: 0, DNB: 0 };

/* small helpers */
const edgeColor = (e) => e >= 3 ? 'var(--zs-pos)' : e >= 1 ? 'var(--zs-info)' : e >= -1 ? 'var(--zs-fg-dim)' : 'var(--zs-fg-muted)';
const edgeBg = (e) => e >= 3 ? 'var(--zs-pos-fill)' : e >= 1 ? 'var(--zs-info-fill)' : 'transparent';

/* ============== the table itself ============== */
window.OddsBoardV2 = function OddsBoardV2({ defaultMarket = 'OU_GOALS', defaultBookMode = 'best' }) {
  const [marketKey, setMarketKey] = React.useState(defaultMarket);
  const [bookMode, setBookMode] = React.useState(defaultBookMode); // 'best' | 'all'
  const m = MARKET_DATA[marketKey];
  const colsBase = m.cols;
  const showBooks = bookMode === 'all';

  // Per-row min/max odds for color emphasis on the best in row
  const rowsWithStats = m.rows.map(r => {
    const vals = Object.values(r.books);
    return { ...r, max: Math.max(...vals), min: Math.min(...vals) };
  });

  return (
    <div className="bg-elev border-zs" style={{ borderRadius: 8, overflow: 'hidden' }}>
      {/* toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--zs-border)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Odds board</span>
          <span className="kicker">{m.label} · {rowsWithStats.length} lines · {BOOKS.length} books</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="kicker">View</span>
          <div style={{ display: 'inline-flex', background: 'var(--zs-surface)', borderRadius: 5, padding: 2, border: '1px solid var(--zs-border)' }}>
            {[{k:'best',l:'Best price'},{k:'all',l:'All books'}].map(o => (
              <button key={o.k} onClick={() => setBookMode(o.k)} style={{
                border: 'none',
                background: bookMode === o.k ? 'var(--zs-bg-elev)' : 'transparent',
                color: bookMode === o.k ? 'var(--zs-fg)' : 'var(--zs-fg-muted)',
                fontFamily: 'var(--font-mono)', fontSize: 11, padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
              }}>{o.l}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '152px 1fr', minHeight: 0 }}>
        {/* market rail */}
        <div style={{ borderRight: '1px solid var(--zs-border)', padding: '8px 0', background: 'var(--zs-bg)' }}>
          {MARKET_KEYS.map(k => {
            const active = k === marketKey;
            const picks = MARKET_PICK_COUNTS[k] || 0;
            return (
              <button key={k} onClick={() => setMarketKey(k)} style={{
                width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                background: active ? 'var(--zs-bg-elev)' : 'transparent',
                borderLeft: active ? '2px solid var(--zs-info)' : '2px solid transparent',
                padding: '8px 12px',
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                <span className="font-mono" style={{ fontSize: 11, color: active ? 'var(--zs-fg)' : 'var(--zs-fg-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</span>
                <span style={{ fontSize: 11, color: 'var(--zs-fg-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {MARKET_DATA[k].rows.length} lines
                  {picks > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--zs-pos)', fontFamily: 'var(--font-mono)' }}>· <span style={{ width: 5, height: 5, borderRadius: 99, background: 'var(--zs-pos)' }} />{picks} pick</span>}
                </span>
              </button>
            );
          })}
        </div>

        {/* table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--zs-bg)' }}>
                {colsBase.map((c, i) => (
                  <th key={i} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500, color: 'var(--zs-fg-muted)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '1px solid var(--zs-border)', whiteSpace: 'nowrap' }}>{c}</th>
                ))}
                <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500, color: 'var(--zs-fg-muted)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '1px solid var(--zs-border)', whiteSpace: 'nowrap' }}>Fair</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500, color: 'var(--zs-fg-muted)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '1px solid var(--zs-border)', whiteSpace: 'nowrap' }}>Mkt</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500, color: 'var(--zs-fg-muted)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '1px solid var(--zs-border)', whiteSpace: 'nowrap' }}>Edge</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500, color: 'var(--zs-fg-muted)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '1px solid var(--zs-border)', whiteSpace: 'nowrap', borderLeft: '1px solid var(--zs-border)' }}>
                  Best
                </th>
                {showBooks && BOOKS.map(b => (
                  <th key={b} style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 500, color: 'var(--zs-fg-muted)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--zs-border)', whiteSpace: 'nowrap' }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowsWithStats.map((r, i) => {
                const rowBg = r.picked ? 'color-mix(in oklch, var(--zs-pos) 10%, var(--zs-bg-elev))' : (i % 2 ? 'transparent' : 'color-mix(in oklch, var(--zs-bg) 30%, var(--zs-bg-elev))');
                return (
                  <tr key={i} style={{ background: rowBg, position: 'relative' }}>
                    {/* selection */}
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid color-mix(in oklch, var(--zs-border) 50%, transparent)', whiteSpace: 'nowrap', position: 'relative' }}>
                      {r.picked && (
                        <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'var(--zs-pos)' }} />
                      )}
                      <span style={{ color: 'var(--zs-fg)', fontFamily: 'var(--font-ui)', fontSize: 12.5 }}>{r.sel}</span>
                      {r.picked && <span className="pill pill-pos" style={{ marginLeft: 8, height: 16, fontSize: 9, padding: '0 6px' }}>PICK</span>}
                    </td>
                    {/* line */}
                    {colsBase.length > 1 && (
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid color-mix(in oklch, var(--zs-border) 50%, transparent)', color: 'var(--zs-fg-dim)', whiteSpace: 'nowrap' }}>{r.line}</td>
                    )}
                    {/* fair / mkt / edge */}
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid color-mix(in oklch, var(--zs-border) 50%, transparent)', textAlign: 'right', color: 'var(--zs-fg-dim)' }}>{r.fair}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid color-mix(in oklch, var(--zs-border) 50%, transparent)', textAlign: 'right', color: 'var(--zs-fg-muted)' }}>{r.mkt}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid color-mix(in oklch, var(--zs-border) 50%, transparent)', textAlign: 'right', color: edgeColor(r.edge), background: edgeBg(r.edge), fontWeight: 600 }}>
                      {r.edge >= 0 ? '+' : ''}{r.edge.toFixed(2)}%
                    </td>
                    {/* best */}
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid color-mix(in oklch, var(--zs-border) 50%, transparent)', textAlign: 'right', borderLeft: '1px solid var(--zs-border)', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--zs-fg)', fontWeight: 600 }}>{r.best.odds.toFixed(2)}</span>
                      <span style={{ color: 'var(--zs-fg-muted)', marginLeft: 6, fontSize: 10 }}>{r.best.book.slice(0,3).toUpperCase()}</span>
                    </td>
                    {/* all books */}
                    {showBooks && BOOKS.map(b => {
                      const v = r.books[b];
                      const isMax = v === r.max;
                      return (
                        <td key={b} style={{ padding: '9px 10px', borderBottom: '1px solid color-mix(in oklch, var(--zs-border) 50%, transparent)', textAlign: 'right', color: isMax ? 'var(--zs-info)' : 'var(--zs-fg-dim)', fontWeight: isMax ? 600 : 400, background: isMax ? 'color-mix(in oklch, var(--zs-info) 8%, transparent)' : 'transparent' }}>
                          {v.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ============== reasoning panel reused by both states ============== */
function ReasoningPanel() {
  return (
    <div className="bg-elev border-zs" style={{ borderRadius: 8, padding: 16 }}>
      <div className="kicker" style={{ marginBottom: 10 }}>Reasoning · Sevilla ML_1X2</div>
      <div style={{ background: 'var(--zs-surface)', borderRadius: 6, padding: '10px 12px', marginBottom: 12, border: '1px solid var(--zs-border)' }}>
        <div className="kicker" style={{ marginBottom: 4, color: 'var(--zs-info)' }}>Summary</div>
        <div style={{ fontSize: 12.5, color: 'var(--zs-fg-dim)', lineHeight: 1.55 }}>
          Sharp money on Sevilla (+8% steam in 6h), Atléti missing 2 KEY defenders, market still pricing home advantage at full strength. Model fair 33.1% vs market 29.4%.
        </div>
      </div>
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
  );
}
window.ReasoningPanel = ReasoningPanel;
