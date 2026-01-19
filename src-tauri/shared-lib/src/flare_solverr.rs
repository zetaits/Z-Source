use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Duration;
use anyhow::{Result, Context};

const FLARESOLVERR_URL: &str = "http://127.0.0.1:8191/v1";

#[derive(Serialize)]
struct FlareRequest {
    cmd: String,
    url: String,
    #[serde(rename = "maxTimeout")]
    max_timeout: u64,
}

#[derive(Deserialize, Debug)]
pub struct FlareResponse {
    pub status: String,
    pub message: String,
    pub solution: Option<FlareSolution>,
    #[serde(default)] // In case startTimestamp/endTimestamp are missing or different types
    pub start_timestamp: u64,
}

#[derive(Deserialize, Debug)]
pub struct FlareSolution {
    pub url: String,
    pub status: u16,
    pub response: String, // The HTML content
    // cookies, userAgent exist too but we mostly need response
}

pub async fn get_html(url: &str) -> Result<String> {
    let client = reqwest::Client::new();
    
    // 1. Try Direct Request First (Optimization)
    println!(">>> [Scraper] Attempting Direct Request to: {}", url);
    let direct_resp = client.get(url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(Duration::from_secs(10))
        .send()
        .await;

    let mut use_flaresolverr = false;
    let mut html_content = String::new();

    match direct_resp {
        Ok(resp) => {
             if resp.status().is_success() {
                 let text = resp.text().await.unwrap_or_default();
                 // Naive check for Cloudflare challenge page
                 if text.contains("running directly") || text.contains("Just a moment...") || text.contains("Enable JavaScript") {
                     println!(">>> [Scraper] Cloudflare Challenge Detected in Direct Request.");
                     use_flaresolverr = true;
                 } else {
                     return Ok(text);
                 }
             } else {
                 println!(">>> [Scraper] Direct Request Failed Status: {}", resp.status());
                 // 403/503 usually means blocked
                 if resp.status() == reqwest::StatusCode::FORBIDDEN || resp.status() == reqwest::StatusCode::SERVICE_UNAVAILABLE {
                     use_flaresolverr = true;
                 }
             }
        },
        Err(e) => {
            println!(">>> [Scraper] Direct Request Error: {}", e);
            use_flaresolverr = true;
        }
    }

    if !use_flaresolverr {
        // If we got here, maybe empty or other error, but let's try FS anyway if empty? 
        // Or just fail.
        // If html_content is empty and we didn't flag FS, return empty (likely 0 matches found logic handles it)
        // But for safety, let's enforce FS if we suspect failure.
    }

    // 2. FlareSolverr Fallback
    println!(">>> [Scraper] Engaging FlareSolverr at {}...", FLARESOLVERR_URL);

    // Health Check
    let health_url = "http://127.0.0.1:8191/"; 
    println!(">>> [Scraper] Checking FlareSolverr Health at {}...", health_url);
    if let Err(e) = client.get(health_url).timeout(Duration::from_secs(2)).send().await {
         let msg = format!("FlareSolverr Health Check Failed (is it running?): {}", e);
         println!(">>> [Scraper] {}", msg);
         return Err(anyhow::anyhow!(msg));
    }
    println!(">>> [Scraper] FlareSolverr is ALIVE. Sending request...");

    let payload = json!({
        "cmd": "request.get",
        "url": url,
        "maxTimeout": 55000 
    });

    let fs_resp = client.post(FLARESOLVERR_URL)
        .header("Content-Type", "application/json")
        .json(&payload)
        .timeout(Duration::from_secs(60))
        .send()
        .await;

    match fs_resp {
        Ok(resp) => {
            if resp.status().is_success() {
                let flare_resp: FlareResponse = match resp.json().await {
                    Ok(r) => r,
                    Err(e) => {
                        let msg = format!("Failed to parse FlareSolverr JSON: {}", e);
                        println!(">>> [Scraper] {}", msg);
                        return Err(anyhow::anyhow!(msg));
                    }
                };

                if flare_resp.status == "ok" {
                        if let Some(sol) = flare_resp.solution {
                            return Ok(sol.response);
                        }
                }
                let msg = format!("FlareSolverr Logic Error: status={}, msg={}", flare_resp.status, flare_resp.message);
                println!(">>> [Scraper] {}", msg);
                Err(anyhow::anyhow!(msg))
            } else {
                 let msg = format!("FlareSolverr Service Error: Status={}", resp.status());
                 println!(">>> [Scraper] {}", msg);
                 Err(anyhow::anyhow!(msg))
            }
        },
        Err(e) => {
             let msg = format!("FlareSolverr Connection Failed: {}. Is it running on {}?", e, FLARESOLVERR_URL);
             println!(">>> [Scraper] {}", msg);
             Err(anyhow::anyhow!(msg))
        }
    }
}
