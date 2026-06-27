use tauri_plugin_sql::{Migration, MigrationKind};

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
        Migration {
            version: 8,
            description: "bets.actual_result for calibration",
            sql: include_str!("../../../src/storage/migrations/008_bet_actual_result.sql"),
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
