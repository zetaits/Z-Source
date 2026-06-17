use tauri::{WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_sql::{Migration, MigrationKind};

// Injected into the hidden SofaScore webview. Runs in the real sofascore.com
// document context (which solves the DataDome challenge on load), so fetches to
// api.sofascore.com are same-site, carry the clearance cookie + Referer, and
// pass. Bridges requests/responses to the main window over Tauri events.
const SOFA_BRIDGE_JS: &str = r#"
(function () {
  // initialization_script runs in EVERY frame. The page embeds dozens of
  // cross-origin ad/consent/captcha iframes (doubleclick, openx, cloudflare
  // turnstile, about:blank...). Those frames have no sofascore cookies, so their
  // fetch to api.sofascore.com 403s — and since events broadcast to all frames,
  // that 403 raced the cleared main frame's response and won. Only run in the
  // top sofascore.com document.
  if (window.top !== window.self) return;
  if (!/(^|\.)sofascore\.com$/i.test(location.hostname)) return;
  if (window.__sofaBridgeInstalled) return;
  window.__sofaBridgeInstalled = true;
  function log() { try { console.log.apply(console, ['[sofa-bridge]'].concat([].slice.call(arguments))); } catch (e) {} }
  function api() { return window.__TAURI__ && window.__TAURI__.event; }
  async function doFetch(url) {
    // Try credentialed first (sends the DataDome clearance cookie); if that
    // throws (e.g. CORS wildcard + credentials), fall back to a plain fetch.
    try {
      var r = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'include' });
      return { status: r.status, body: await r.text(), mode: 'include' };
    } catch (e1) {
      log('include threw', String(e1));
      var r2 = await fetch(url, { headers: { Accept: 'application/json' } });
      return { status: r2.status, body: await r2.text(), mode: 'plain' };
    }
  }
  function install() {
    var ev = api();
    if (!ev) { setTimeout(install, 200); return; }
    log('installed @', location.href);
    ev.listen('sofa-fetch-req', async function (e) {
      var id = e.payload.id, url = e.payload.url;
      log('req', url);
      try {
        var res = await doFetch(url);
        log('res', res.mode, res.status, String(res.body).slice(0, 120));
        ev.emit('sofa-fetch-res', { id: id, status: res.status, body: res.body });
      } catch (err) {
        log('error', url, String(err));
        ev.emit('sofa-fetch-res', { id: id, status: 0, body: String(err) });
      }
    });
    ev.emit('sofa-proxy-ready', {});
  }
  install();
})();
"#;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "init schema",
            sql: include_str!("../../../src/storage/migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "multi provider (match_resolution + providers_quota)",
            sql: include_str!("../../../src/storage/migrations/002_multi_provider.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "splits_cache",
            sql: include_str!("../../../src/storage/migrations/003_splits_cache.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "history_cache",
            sql: include_str!("../../../src/storage/migrations/004_history_cache.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "pick_outcomes",
            sql: include_str!("../../../src/storage/migrations/005_pick_outcomes.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "historical_odds",
            sql: include_str!("../../../src/storage/migrations/006_historical_odds.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "drop historical_odds (backtest removed)",
            sql: include_str!("../../../src/storage/migrations/007_drop_historical_odds.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:z-source.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            // Hidden webview parked on sofascore.com to host DataDome-cleared
            // API fetches. Best-effort: if it fails, history simply degrades.
            let url = WebviewUrl::External(
                "https://www.sofascore.com/".parse().expect("valid sofascore url"),
            );
            // TEMP DEBUG: visible so its devtools can be opened to inspect the
            // in-page fetch / DataDome behaviour. Flip back to false once working.
            if let Err(err) = WebviewWindowBuilder::new(app, "sofa-proxy", url)
                .visible(true)
                .focused(false)
                .title("Z-Source · SofaScore proxy (debug)")
                .initialization_script(SOFA_BRIDGE_JS)
                .build()
            {
                eprintln!("[sofa-proxy] failed to create proxy webview: {err}");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
