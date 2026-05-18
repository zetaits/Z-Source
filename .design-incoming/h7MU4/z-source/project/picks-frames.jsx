/* global React */

window.MatchHeader = function MatchHeader({ home = "Atlético Madrid", away = "Sevilla", kickoff = "Tomorrow · 21:00", league = "LaLiga · MD32" }) {
  return (
    <div className="matchhdr">
      <div className="team home"><span className="team-bullet" /><span>{home}</span></div>
      <div className="vs">
        <div style={{ marginBottom: 4, color: 'var(--zs-fg-muted)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{league}</div>
        <div style={{ color: 'var(--zs-fg)', fontSize: 13 }}>{kickoff}</div>
      </div>
      <div className="team away"><span className="team-bullet" /><span>{away}</span></div>
    </div>
  );
};

window.TabStrip = function TabStrip({ active = "picks" }) {
  const tabs = ["picks", "lines", "matchup", "trends", "splits", "sentiment", "intangibles"];
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--zs-border)', padding: '0 28px', background: 'var(--zs-bg)' }}>
      {tabs.map(t => <span key={t} className={`tab ${t === active ? 'active' : ''}`}>{t}</span>)}
    </div>
  );
};

window.Annot = function Annot({ kind = 'info', children, style }) {
  return <div className={`annot ${kind === 'good' ? 'annot-good' : kind === 'warn' ? '' : 'annot-info'}`} style={style}>{children}</div>;
};

/* Compact pick row — one line, no card weight */
function PickRow({ label, market, fair, odds, book, conf, stake, edge, tier }) {
  const tone = tier === 'prime' ? 'var(--zs-pos)' : tier === 'standard' ? 'var(--zs-info)' : 'var(--zs-warn)';
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '4px 1fr auto',
      background: 'var(--zs-bg-elev)',
      border: '1px solid ' + (tier === 'prime' ? 'color-mix(in oklch, var(--zs-pos) 40%, var(--zs-border))' : 'var(--zs-border)'),
      borderRadius: 6,
      overflow: 'hidden',
    }}>
      <div style={{ background: tone, opacity: tier === 'prime' ? 1 : 0.55 }} />
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span className="kicker">{market}</span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
          {tier === 'prime' && <span className="pill pill-sharp" style={{ height: 16, fontSize: 9, padding: '0 6px' }}>Strong</span>}
        </div>
        <div className="font-mono tabular" style={{ fontSize: 11, color: 'var(--zs-fg-dim)' }}>
          fair {fair} · {odds} @ {book} · conf {conf} · stake {stake}u
        </div>
      </div>
      <div style={{ padding: '10px 16px', borderLeft: '1px solid var(--zs-border)', background: tier === 'prime' ? 'var(--zs-pos-fill)' : 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
        <span className="kicker" style={{ color: tone }}>Edge</span>
        <span style={{ fontSize: 22, fontWeight: 600, color: tone, lineHeight: 1 }}>+{edge}%</span>
      </div>
    </div>
  );
}

/* ===========================================================
   PICKS · WITH PICKS (board is the centerpiece)
=========================================================== */
window.PicksFrameWithPicks = function PicksFrameWithPicks() {
  return (
    <div style={{ width: 1280, background: 'var(--zs-bg)' }}>
      <MatchHeader />
      <TabStrip active="picks" />
      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20, alignItems: 'start' }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* compact picks list */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Picks</span>
                <span className="kicker">2 candidates · sorted by edge</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <PickRow label="Sevilla" market="ML_1X2" fair="33.1%" odds="3.40" book="Pinnacle" conf={78} stake={1.4} edge="4.32" tier="prime" />
              <PickRow label="Under 2.5" market="OU_GOALS" fair="48.8%" odds="1.98" book="Pinnacle" conf={64} stake={0.8} edge="1.85" tier="standard" />
            </div>
          </div>

          {/* odds board v2 */}
          <Annot kind="good">
            FIX · tabla densa estilo terminal: mercados en rail izquierdo (incluye AH, OU con todas las líneas alternativas), filas = selecciones/líneas, columna "Best" siempre visible, "All books" expandible. Picks marcados con barra fina + chip — no compiten visualmente con las cards de pick.
          </Annot>
          <window.OddsBoardV2 defaultMarket="OU_GOALS" defaultBookMode="best" />
        </div>

        <div style={{ position: 'sticky', top: 0 }}>
          <window.ReasoningPanel />
        </div>
      </div>
    </div>
  );
};

/* ===========================================================
   PICKS · NO PICKS (board still front and center)
=========================================================== */
window.PicksFrameNoPicks = function PicksFrameNoPicks() {
  return (
    <div style={{ width: 1280, background: 'var(--zs-bg)' }}>
      <MatchHeader home="Real Betis" away="Getafe" />
      <TabStrip active="picks" />
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div style={{ background: 'var(--zs-bg-elev)', border: '1px solid var(--zs-border)', borderLeft: '3px solid var(--zs-warn)', borderRadius: 6, padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 18, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--zs-fg)' }}>No picks cleared the threshold</div>
            <div style={{ fontSize: 12, color: 'var(--zs-fg-muted)', marginTop: 2 }}>
              Best edge was <span className="font-mono">−1.0%</span> on Away ML. Inspect the full market below or loosen stake policy in Strategy.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="pill pill-ghost">Strategy →</span>
            <span className="pill pill-info">Show marginal</span>
          </div>
        </div>

        <Annot kind="good">
          FIX · el board se renderiza igual sin picks; la tabla es la misma estructura, simplemente sin filas marcadas como PICK. Ahora puedes leer el mercado completo en lugar de un placeholder vacío.
        </Annot>

        <window.OddsBoardV2 defaultMarket="ML_1X2" defaultBookMode="all" />
      </div>
    </div>
  );
};
