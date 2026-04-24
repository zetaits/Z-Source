/**
 * Action Network public-betting JSON API probe.
 *
 * Paste in DevTools console of the running Tauri app (or any https Chrome tab)
 * and call:
 *   await anApiProbe("20260421")   // YYYYMMDD, no dashes
 *
 * Verifies:
 *   - 200 vs 403 (TLS/DataDome)
 *   - CORS: whether window.fetch can read the body cross-origin
 *   - Top-level shape + sample game structure with bet_info percentages
 */
(() => {
  const URL_FOR = (d) =>
    `https://api.actionnetwork.com/web/v2/scoreboard/publicbetting/soccer?date=${d}`;

  window.anApiProbe = async (dateYYYYMMDD) => {
    if (!/^\d{8}$/.test(dateYYYYMMDD)) {
      console.error('pass date as YYYYMMDD (8 digits, no dashes)');
      return;
    }
    const url = URL_FOR(dateYYYYMMDD);
    console.log(`\n=== Action Network API probe · date=${dateYYYYMMDD} ===`);
    console.log(`url=${url}`);

    const t0 = performance.now();
    let res, text, json = null;
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' } });
      text = await res.text();
    } catch (e) {
      console.log(`NETWORK ERROR · ${e.message}`);
      console.log('Likely CORS (no Access-Control-Allow-Origin) or network block.');
      return { ok: false, error: e.message };
    }
    const ms = Math.round(performance.now() - t0);
    console.log(`${res.status} ${ms}ms · ${text.length}B`);
    console.log('response headers:');
    res.headers.forEach((v, k) => console.log(`  ${k}: ${v}`));
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.log('JSON parse failed:', e.message);
      console.log('sample:', text.slice(0, 400));
      return { ok: false };
    }

    const games = json.games ?? [];
    console.log(`games: ${games.length}`);
    if (games.length === 0) {
      console.log('sample top-level keys:', Object.keys(json));
      return { ok: true, empty: true, json };
    }

    const g = games[0];
    console.log(`game[0] keys:`, Object.keys(g));
    console.log(`  id=${g.id} league=${g.league_name} start=${g.start_time}`);
    console.log(`  home_team_id=${g.home_team_id} away_team_id=${g.away_team_id}`);
    console.log(`  teams:`, g.teams?.map((t) => `${t.id}:${t.full_name}`).join(' | '));
    const bookIds = Object.keys(g.markets ?? {});
    console.log(`  markets book_ids: [${bookIds.join(', ')}]`);
    if (bookIds[0]) {
      const book = g.markets[bookIds[0]];
      const types = Object.keys(book.event ?? {});
      console.log(`  book ${bookIds[0]} market types: [${types.join(', ')}]`);
      const ml = book.event?.moneyline;
      if (Array.isArray(ml) && ml[0]) {
        console.log(`  moneyline[0]:`, {
          type: ml[0].type,
          side: ml[0].side,
          team_id: ml[0].team_id,
          odds: ml[0].odds,
          bet_info: ml[0].bet_info,
        });
      } else {
        console.log('  no moneyline array on first book');
      }
    }

    // Summarize how many games actually have bet_info.percent populated
    let gamesWithPcts = 0;
    for (const gm of games) {
      const books = Object.values(gm.markets ?? {});
      const ml = books.flatMap((b) => b.event?.moneyline ?? []);
      if (ml.some((o) => o.bet_info?.tickets?.percent != null)) gamesWithPcts += 1;
    }
    console.log(`games with moneyline bet_info.tickets.percent: ${gamesWithPcts}/${games.length}`);

    console.log('=== done ===');
    return { ok: true, games: games.length, gamesWithPcts, sample: games[0] };
  };

  console.log('anApiProbe(dateYYYYMMDD) ready. Try: await anApiProbe("20260421")');
})();
