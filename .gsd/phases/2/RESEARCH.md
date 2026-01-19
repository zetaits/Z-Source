# Research: Robust Scraping Infrastructure with FlareSolverr

**Date**: 2026-01-19
**Context**: The current scraping mechanism (direct `reqwest` calls) is failing due to Cloudflare anti-bot protection ("0 matches found"). The user proposed using **FlareSolverr**.

## Problem Analysis
- **Symptom**: Scraper returns 0 matches or hangs.
- **Root Cause**: Target site (FBref) uses Cloudflare. Standard HTTP clients are blocked or challenged (CAPTCHA).
- **Requirement**: A mechanism to bypass Cloudflare challenges transparently and return clean HTML.

## Solution: FlareSolverr
FlareSolverr is a proxy server that bypasses Cloudflare protection.

### Architecture
1. **FlareSolverr Service**: Runs as a separate process (Docker container or local binary) on port `8191`.
2. **Rust Scraper**: Instead of calling `fbref.com` directly, it calls `localhost:8191/v1` with a POST request containing the target URL.
3. **Response**: FlareSolverr handles the browser instance (Headless Chrome), solves the challenge, and returns the HTML source to our Rust scraper.

### Implementation Strategy
1. **Infrastructure**:
   - User needs to run FlareSolverr. We can provide a `docker-compose.yml` or instructions to run the binary.
   - For `dev` mode, we'll assume it's running on `localhost:8191`.

2. **Rust Client modification (`shared-lib/src/scraper.rs` equivalent)**:
   - Identify where HTTP requests are made.
   - Replace `reqwest::get(url)` with a POST to FlareSolverr.

### JSON Request Format (FlareSolverr)
```json
{
  "cmd": "request.get",
  "url": "https://fbref.com/...",
  "maxTimeout": 60000
}
```

### Risks & Mitigations
- **Performance**: Slower than direct HTTP (browser overhead). *Mitigation*: Caching and parallel processing (already in roadmap).
- **Dependency**: Requires an external service. *Mitigation*: Graceful fallback or clear error message if FlareSolverr is not reachable ("Please start FlareSolverr").

## Decision
- **Adopt FlareSolverr**. It's the standard solution for this problem in personal scraping projects.
- **Phase 2 Priority**: This is the blocked prerequisite for all analytics.
