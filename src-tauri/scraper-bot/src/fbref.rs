use anyhow::{Context, Result};
use headless_chrome::{Browser, LaunchOptions};
use rand::Rng;
use shared_lib::db::{FootballMatchStats, MatchContext, PlayerStats, TeamStats};
use std::{thread, time::Duration};

pub async fn scrape_match(url: &str) -> Result<FootballMatchStats> {
    // A) Iniciar navegador (Headless)
    let launch_options = LaunchOptions {
        window_size: Some((1920, 1080)),
        ..Default::default()
    };
    let browser = Browser::new(launch_options).context("Failed to launch browser")?;
    let tab = browser.new_tab().context("Failed to create tab")?;

    // Configurar User-Agent (simulación simple de un navegador real)
    tab.set_user_agent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        None,
        None,
    )?;

    // B) Navegar a la URL con sleep aleatorio
    let sleep_secs = rand::thread_rng().gen_range(2..=5);
    thread::sleep(Duration::from_secs(sleep_secs));
    
    println!("Navigating to: {}", url);
    tab.navigate_to(url)?.wait_until_navigated()?;

    // Gestionar Cookies (Banner)
    // Buscamos botones comunes de aceptación de cookies en Fbref/sites similares
    // Esto es un intento "best effort"; en headless a veces no aparecen o son diferentes.
    // Selectores tipicos: button[mode="primary"], .css-47sehv (CMP de ejemplo), etc.
    // En Fbref a veces es un popup simple "AGREE"
    if let Ok(buttons) = tab.find_elements("button, .qc-cmp2-summary-buttons > button:last-child") {
        for button in buttons {
            if let Ok(text) = button.get_inner_text() {
                let text_lower = text.to_lowercase();
                if text_lower.contains("agree") || text_lower.contains("accept") || text_lower.contains("consent") {
                    println!("Clicking cookie banner: {}", text);
                    let _ = button.click();
                    thread::sleep(Duration::from_secs(2)); // Esperar desaparición
                    break;
                }
            }
        }
    }
    
    // C) & D) Extracción
    // Helper para extraer texto limpio y parsear numeros
    let get_text = |selector: &str| -> String {
        match tab.find_element(selector) {
            Ok(el) => el.get_inner_text().unwrap_or_default().trim().to_string(),
            Err(_) => String::new(),
        }
    };
    
    let parse_u32 = |selector: &str| -> u32 {
        get_text(selector).replace(",", "").parse().unwrap_or(0)
    };

    let parse_f32 = |selector: &str| -> f32 {
        get_text(selector).replace(",", "").parse().unwrap_or(0.0)
    };

    // --- Context Parsing ---
    // Referee y Venue suelen estar en el bloque scorebox_meta
    let referee = get_text("div.scorebox_meta > div:nth-child(1) span:nth-child(2)").replace(" (Referee)", ""); // Simplificación
    let venue = get_text("div.scorebox_meta > div:nth-child(2) span:nth-child(2)"); // Simplificación, depende del layout exacto
    let attendance_str = get_text("div.scorebox_meta > div:nth-child(3) span:nth-child(2)").replace(",", "");
    let attendance = attendance_str.parse::<u32>().ok();

    let context = MatchContext {
        referee,
        venue,
        attendance,
    };

    // Helper para extraer stats de un equipo (Home vs Away)
    // Los selectores de Fbref suelen ser #stats_shooting_home_summary, etc.
    // NOTA: La estructura de IDs en Fbref es compleja y dinámica. Usaremos los IDs base dados.
    // Para simplificar, asumiremos que los selectores de "totales" están en el tfoot de la tabla.
    
    let scrape_team_stats = |suffix: &str| -> Result<TeamStats> {
        // Selectores base
        let shooting_sel = format!("#stats_shooting_{} tfoot tr", suffix);
        let passing_sel = format!("#stats_passing_{} tfoot tr", suffix);
        let gca_sel = format!("#stats_gca_{} tfoot tr", suffix);
        let defense_sel = format!("#stats_defense_{} tfoot tr", suffix);
        let misc_sel = format!("#stats_misc_{} tfoot tr", suffix);
        // let keeper_sel = format!("#keeper_stats_{} tfoot tr", suffix); // Keeper tiene ID distinto a veces

        // Nota: `data-stat` es el atributo clave en Fbref para columnas.
        // headless_chrome no soporta selectores por atributo fácilmente en `find_element` sin CSS complejo,
        // así que usaremos JS evaluation para ser precisos y robustos.
        
        let get_stat = |parent_sel: &str, stat_name: &str| -> String {
             // Script JS para buscar dentro de la fila footer la celda con data-stat correcto
            let script = format!(
                r#"
                (() => {{
                    const row = document.querySelector('{}');
                    if (!row) return "0";
                    const cell = row.querySelector('td[data-stat="{}"]');
                    return cell ? cell.innerText.trim() : "0";
                }})()
                "#,
                parent_sel, stat_name
            );
            
            // Evaluar JS debe devolver RemoteObject, extraemos valor
            match tab.evaluate(&script, false) {
                 Ok(obj) => obj.value.and_then(|v| v.as_str().map(|s| s.to_string())).unwrap_or("0".to_string()),
                 Err(_) => "0".to_string()
            }
        };

        let parse_js_u32 = |parent: &str, stat: &str| -> u32 {
            get_stat(parent, stat).replace(",", "").parse().unwrap_or(0)
        };
        
        let parse_js_f32 = |parent: &str, stat: &str| -> f32 {
            get_stat(parent, stat).replace(",", "").parse().unwrap_or(0.0)
        };

        Ok(TeamStats {
             // General (Possession suele estar en #team_stats_extra o banner, hardcode 0 por ahora if not simple)
             // Possession está difícil de scrapear genéricamente de una celda única sin ID específico en match reports
             possession: parse_js_f32(format!("#team_stats_extra").as_str(), format!("possession_{}", suffix).as_str()), // Intento
             
             xg: parse_js_f32(&shooting_sel, "xg"), 
             xga: 0.0, // xGA es xG del oponente, se puede inferir luego o extraer del otro equipo
             
             // Offensive
             shots: parse_js_u32(&shooting_sel, "shots"),
             shots_on_target: parse_js_u32(&shooting_sel, "shots_on_target"),
             goals: parse_js_u32(&shooting_sel, "goals"),

             // Creation
             sca: parse_js_u32(&gca_sel, "sca"),
             gca: parse_js_u32(&gca_sel, "gca"),

             // Passing
             passes_completed: parse_js_u32(&passing_sel, "passes_completed"),
             passes_progressive: parse_js_u32(&passing_sel, "progressive_passes"),
             passes_final_third: parse_js_u32(&passing_sel, "passes_into_final_third"),
             key_passes: parse_js_u32(&passing_sel, "passes_key"),

             // Defense
             tackles_won: parse_js_u32(&defense_sel, "tackles_won"),
             interceptions: parse_js_u32(&defense_sel, "interceptions"),
             blocks: parse_js_u32(&defense_sel, "blocks"),
             clearances: parse_js_u32(&defense_sel, "clearances"),
             
             // Aerial (Misc table)
             aerials_won: parse_js_u32(&misc_sel, "aerials_won"),
             aerials_lost: parse_js_u32(&misc_sel, "aerials_lost"),

             // Goalkeeping (Keeper table)
             // Nota: Keeper table ID formato #keeper_stats_{ID_EQUIPO} ...
             // Para simplificar, asumiremos 0 por ahora o requeriría más lógica de ID
             saves: 0, 
             psxg: 0.0,

             // Discipline
             fouls: parse_js_u32(&misc_sel, "fouls"),
             yellow_cards: parse_js_u32(&misc_sel, "cards_yellow"),
             red_cards: parse_js_u32(&misc_sel, "cards_red"),

             corners: 0, // A veces en misc, a veces summary

             players: Vec::new(), // Placeholder, requires iteration implementation
        })
    };

    let mut home_stats = scrape_team_stats("home")?;
    let mut away_stats = scrape_team_stats("away")?;
    
    // Cross-assign xGA
    home_stats.xga = away_stats.xg;
    away_stats.xga = home_stats.xg;

    Ok(FootballMatchStats {
        context,
        home_stats,
        away_stats,
    })
}
