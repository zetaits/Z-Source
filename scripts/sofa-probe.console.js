/**
 * SofaScore browser-side probe.
 *
 * Paste inside the running Tauri app DevTools console (or a plain
 * Chrome tab on any https origin) and call:
 *   await sofaProbe(14025034)
 *
 * Uses the WebView's native fetch → real Chrome TLS fingerprint →
 * bypasses the 403 that node/curl get from api.sofascore.com.
 */
(() => {
  const BASE = "https://api.sofascore.com/api/v1";

  const hit = async (label, url) => {
    const t0 = performance.now();
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      const text = await res.text();
      const ms = Math.round(performance.now() - t0);
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {}
      console.log(
        `[${label}] ${res.status} ${ms}ms · ${text.length}B · ${url}`,
      );
      return { status: res.status, json };
    } catch (e) {
      console.log(`[${label}] NETWORK ERROR · ${e.message} · ${url}`);
      return { status: 0, json: null };
    }
  };

  const summarize = (label, evts) => {
    if (!Array.isArray(evts)) {
      console.log(`  ${label}: not an array`);
      return;
    }
    const finished = evts.filter((e) => e?.status?.type === "finished");
    console.log(`  ${label}: ${evts.length} total · ${finished.length} finished`);
    for (const e of evts.slice(0, 3)) {
      const date = e?.startTimestamp
        ? new Date(e.startTimestamp * 1000).toISOString().slice(0, 10)
        : "?";
      const h = e?.homeTeam?.name ?? "?";
      const a = e?.awayTeam?.name ?? "?";
      const hs = e?.homeScore?.current ?? e?.homeScore?.display ?? "-";
      const as = e?.awayScore?.current ?? e?.awayScore?.display ?? "-";
      const st = e?.status?.type ?? "?";
      console.log(`    ${date}  ${h} ${hs}-${as} ${a}  [${st}]`);
    }
  };

  window.sofaProbe = async (matchId) => {
    console.log(`\n=== SofaScore probe · matchId=${matchId} ===`);

    const ev = await hit("event", `${BASE}/event/${matchId}`);
    if (!ev.json?.event) {
      console.log("  ! no `event` key — aborting");
      return;
    }
    const event = ev.json.event;
    const homeId = event.homeTeam?.id;
    const awayId = event.awayTeam?.id;
    const kickoff = event.startTimestamp
      ? new Date(event.startTimestamp * 1000).toISOString()
      : "?";
    console.log(
      `  ${event.homeTeam?.name} (sofaId=${homeId}) vs ${event.awayTeam?.name} (sofaId=${awayId})`,
    );
    console.log(`  kickoff=${kickoff} · status=${event.status?.type}`);

    const pages = await Promise.all([
      hit("home/last/0", `${BASE}/team/${homeId}/events/last/0`),
      hit("home/last/1", `${BASE}/team/${homeId}/events/last/1`),
      hit("away/last/0", `${BASE}/team/${awayId}/events/last/0`),
      hit("away/last/1", `${BASE}/team/${awayId}/events/last/1`),
      hit("home/next/0", `${BASE}/team/${homeId}/events/next/0`),
      hit("away/next/0", `${BASE}/team/${awayId}/events/next/0`),
    ]);
    for (const p of pages) summarize("events", p.json?.events);

    // Inferred H2H · same logic as sofaScoreHistoryProvider.fetchMeetingsViaTeamEvents
    const seen = new Set();
    const union = [];
    for (const p of pages.slice(0, 4)) {
      for (const ev of p.json?.events ?? []) {
        if (seen.has(ev.id)) continue;
        seen.add(ev.id);
        union.push(ev);
      }
    }
    const h2hMeetings = union.filter(
      (ev) =>
        (ev.homeTeam?.id === homeId && ev.awayTeam?.id === awayId) ||
        (ev.homeTeam?.id === awayId && ev.awayTeam?.id === homeId),
    );
    console.log(
      `\ninferred H2H (app path): ${h2hMeetings.length} meetings out of ${union.length} union events`,
    );
    summarize("h2h meetings", h2hMeetings);

    console.log("=== done ===");
    return { event, homeId, awayId, h2hMeetings };
  };

  console.log("sofaProbe(matchId) ready. Try: await sofaProbe(14025034)");
})();
