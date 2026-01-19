use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct MatchPrediction {
    pub xg_home: f64,
    pub xg_away: f64,
    pub win_prob: f64,
    pub draw_prob: f64,
    pub lose_prob: f64,
    pub over_2_5_prob: f64,
    pub btts_prob: f64,
}

// Helper: Get league average goals (home and away)
fn get_league_averages(conn: &Connection) -> Result<(f64, f64)> {
    // Only count matches that have scores from football_stats
    let mut stmt = conn.prepare("
        SELECT 
            AVG(fs.home_score) as avg_home, 
            AVG(fs.away_score) as avg_away 
        FROM events e
        JOIN football_stats fs ON e.id = fs.event_id
        WHERE e.sport_id = 'football' AND fs.home_score IS NOT NULL
    ")?;
    
    let mut rows = stmt.query([])?;
    if let Some(row) = rows.next()? {
        let avg_home: Option<f64> = row.get(0)?;
        let avg_away: Option<f64> = row.get(1)?;
        // Default to typical football averages (e.g. 1.5 home, 1.2 away) if DB is empty or null
        Ok((avg_home.unwrap_or(1.5), avg_away.unwrap_or(1.2))) 
    } else {
        Ok((1.5, 1.2))
    }
}

// Helper: Get aggregated recent stats for a team
fn get_team_recent_stats(conn: &Connection, team_id: i64, limit: usize) -> Result<(f64, f64)> {
    let sql = r#"
        SELECT 
            AVG(CASE WHEN e.home_team_id = ?1 THEN fs.home_score ELSE fs.away_score END) as scored,
            AVG(CASE WHEN e.home_team_id = ?1 THEN fs.away_score ELSE fs.home_score END) as conceded
        FROM events e
        JOIN football_stats fs ON e.id = fs.event_id
        WHERE (e.home_team_id = ?1 OR e.away_team_id = ?1) 
          AND e.sport_id = 'football'
          AND fs.home_score IS NOT NULL
        ORDER BY e.date DESC
        LIMIT ?2
    "#;
    
    let mut stmt = conn.prepare(sql)?;
    let mut rows = stmt.query(params![team_id, limit as i64])?;
    
    if let Some(row) = rows.next()? {
         let scored: Option<f64> = row.get(0)?;
         let conceded: Option<f64> = row.get(1)?;
         
         if let (Some(s), Some(c)) = (scored, conceded) {
             Ok((s, c))
         } else {
             Err(rusqlite::Error::QueryReturnedNoRows)
         }
    } else {
        Err(rusqlite::Error::QueryReturnedNoRows)
    }
}

// Poisson Probability Mass Function
fn poisson_pmf(k: i32, lambda: f64) -> f64 {
    let k_fact: f64 = (1..=k).fold(1.0, |acc, x| acc * x as f64);
    (lambda.powi(k) * (-lambda).exp()) / k_fact
}

// Main Analysis Function
pub fn analyze_match(conn: &Connection, home_team_id: i64, away_team_id: i64) -> Result<MatchPrediction> {
    // 1. Get League Averages
    let (league_avg_home, league_avg_away) = get_league_averages(conn)?;
    
    // 2. Get Recent Stats (Last 20 games)
    let (home_scored_avg, home_conceded_avg) = get_team_recent_stats(conn, home_team_id, 20)?;
    let (away_scored_avg, away_conceded_avg) = get_team_recent_stats(conn, away_team_id, 20)?;
    
    // 3. Calculate Attack/Defence Strengths
    // Home Attack Strength = Home Scored Avg / League Home Avg
    let home_att_strength = if league_avg_home > 0.0 { home_scored_avg / league_avg_home } else { 1.0 };
    // Home Defence Strength = Home Conceded Avg / League Away Avg (How well they defend against away teams)
    let home_def_strength = if league_avg_away > 0.0 { home_conceded_avg / league_avg_away } else { 1.0 };
    
    // Away Attack Strength = Away Scored Avg / League Away Avg
    let away_att_strength = if league_avg_away > 0.0 { away_scored_avg / league_avg_away } else { 1.0 };
    // Away Defence Strength = Away Conceded Avg / League Home Avg
    let away_def_strength = if league_avg_home > 0.0 { away_conceded_avg / league_avg_home } else { 1.0 };

    // 4. Calculate Projected xG (Lambda)
    // Home xG = Home Att * Away Def * League Avg Home
    let xg_home = home_att_strength * away_def_strength * league_avg_home;
    
    // Away xG = Away Att * Home Def * League Avg Away
    let xg_away = away_att_strength * home_def_strength * league_avg_away;
    
    // 5. Poisson Simulation (Markets)
    let mut win_prob = 0.0;
    let mut draw_prob = 0.0;
    let mut lose_prob = 0.0;
    let mut over_2_5_prob = 0.0;
    let mut btts_prob = 0.0;
    
    // Iterate scores from 0-0 to 9-9 (sufficient range)
    for home_goals in 0..10 {
        let p_home = poisson_pmf(home_goals, xg_home);
        
        for away_goals in 0..10 {
            let p_away = poisson_pmf(away_goals, xg_away);
            let prob_score = p_home * p_away;
            
            // 1X2 Probabilities
            if home_goals > away_goals {
                win_prob += prob_score;
            } else if home_goals == away_goals {
                draw_prob += prob_score;
            } else {
                lose_prob += prob_score;
            }
            
            // Over 2.5
            if (home_goals + away_goals) as f64 > 2.5 {
                over_2_5_prob += prob_score;
            }
            
            // BTTS (Both Teams To Score)
            if home_goals > 0 && away_goals > 0 {
                btts_prob += prob_score;
            }
        }
    }
    
    // Normalize probabilities (in case sum != 1.0 due to truncation range, though negligible with lambda < 5)
    let total_prob = win_prob + draw_prob + lose_prob;
    if total_prob > 0.0 {
        win_prob /= total_prob;
        draw_prob /= total_prob;
        lose_prob /= total_prob;
    }

    Ok(MatchPrediction {
        xg_home,
        xg_away,
        win_prob,
        draw_prob,
        lose_prob,
        over_2_5_prob, // Not normalizing independent markets against 1x2 total
        btts_prob,
    })
}
