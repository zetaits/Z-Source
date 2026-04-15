# Z-Source

Z-Source is an advanced EV+ (Positive Expected Value) Sports Betting Analytics desktop application. Built specifically to analyze the sports betting market at scale, it identifies high-value plays by combining the proprietary Bonded Betting Methodology with customizable heuristic rulesets. 

The system operates as a comprehensive suite for professional sports analytics, featuring real-time multi-provider odds aggregation, dynamic web-scraping for historical data and market splits, and advanced bankroll management with fractional Kelly Criterion position sizing.

[Imagen]

---

## Key Capabilities

### Bonded Analysis Engine
The core engine evaluates market opportunities across five distinct pillars (Matchup, Trends, Lines, Sharp vs. Square, and Intangibles) to generate a consolidated `PlayCandidate` score. 
*   **Pluggable Ruleset:** Implements advanced betting concepts out-of-the-box, such as Vig-Adjusted Edge calculation, Reverse Line Movement (Sharp vs. Square), Public Underdog Trap, Form Divergence, and Rest/Congestion discrepancies.
*   **Reasoning Trace:** Every recommendation output by the engine includes a detailed, deterministic reasoning trace, ensuring full transparency behind every generated edge.
*   **Dynamic Stake Sizing:** Automatically calculates recommended stake units based on confidence multipliers and fractional Kelly strategies to strictly manage exposure.

[Imagen]

### Multi-Provider Data Ingestion
Z-Source maximizes external API quotas while ensuring high data fidelity through a strict fallback mechanism and local caching.
*   **Odds Aggregation:** Consumes odds directly from primary providers (e.g., odds-api.io) with seamless failovers (e.g., the-odds-api.com) built directly into the client.
*   **Action Splits & Sentiment:** Scrapes public ticket and money percentages from leading sports consensus networks to power the Sharp vs. Square analysis rules.
*   **Catalog & History:** Leverages intelligent scraping (e.g., SofaScore) for match catalogs, recent team forms, head-to-head records, and team congestion schedules without exhausting paid API quotas.

### Bankroll & Ledger Management
Complete local portfolio tracking ensuring privacy and robust statistical analysis of past performance.
*   **Equity Curve & Yield:** Auto-generated performance charts tracking ROI, units won/lost, and active market exposure.
*   **Closing Line Value (CLV) Tracking:** Automatically captures the final odds before kickoff to analyze whether placed bets consistently beat the closing line.
*   **Data Portability:** Full support for importing and exporting ledger data and betting strategies via CSV and JSON formats.

[Imagen]

---

## Technical Architecture

Z-Source is distributed as a secure, fast, cross-platform desktop application powered by **Tauri v2**. The local-first architecture ensures analytical speed without central cloud bottlenecks.

*   **Frontend Ecosystem:** React 18, TypeScript, TailwindCSS, and shadcn/ui.
*   **Application State & Caching:** TanStack Query for server-state synchronization with local persistence.
*   **Backend & Interoperability:** Rust (Tauri), utilizing `tauri-plugin-sql` for local SQLite migrations, `tauri-plugin-store` for secure credential management, and `tauri-plugin-http` for bypassing browser CORS limitations during data scraping.
*   **Data Validation:** Zod schemas applied to all provider responses and engine outputs.

[Imagen]

---

## Local Development

### Prerequisites
*   Node.js (v18+)
*   Rust toolchain (cargo, rustc)
*   Tauri dependencies installed for your operating system

### Setup & Run

1.  **Install Application Dependencies:**
    ```bash
    npm install
    ```

2.  **Start the Development Environment:**
    ```bash
    npm run tauri:dev
    ```
    This command will concurrently start the Vite development server and compile the Rust binary, launching the application window.

3.  **Build for Production:**
    ```bash
    npm run tauri:build
    ```

---

*Notice: This software is designed strictly for analytical and educational purposes.*
