# SPEC.md — Project Specification

> **Status**: `FINALIZED`

## Vision
Z-Source is a scalable sports intelligence infrastructure designed to be the "central operating system" for sports investors. It maps cross-sport probabilities (goals in football, points in basketball, etc.) against market prices to detect Expected Value (EV+) opportunities. It unifies financial analysis with deep sports analytics in a single "Bloomberg Terminal" style interface.

## Goals
1.  **Validar MVP de Fútbol (Fase 1)**: Implementar una "Caja de Cristal" analítica para fútbol que muestre probabilidades estimadas para todos los mercados principales (1X2, Over/Under, BTTS) y secundarios (Córners, Tarjetas) usando modelos adaptados (Poisson, etc.).
2.  **Sistema de Detección de Valor (EV+ Scanner)**: Integrar Odds-API para comparar nuestras probabilidades matemáticas contra las cuotas del mercado en tiempo real y alertar automáticamente sobre oportunidades EV+.
3.  **Arquitectura Polimórfica Escalable**: Refactorizar el backend para soportar múltiples deportes (Fútbol hoy, NBA/Tenis mañana) con una base de datos flexible y plugins de ingesta modulares.
4.  **UX Premium "Terminal Financiera"**: Desarrollar una interfaz densa en datos pero clara, que permita distinguir instantáneamente entre "alta probabilidad" y "alto valor", con navegación por deportes.

## Non-Goals (Out of Scope for Phase 1)
-   Implementación activa de módulos de NBA, Tenis o NFL (solo la arquitectura debe estar preparada).
-   Apuestas automáticas (bot de ejecución); el sistema es solo informativo/analítico.
-   Gestión de bankroll compleja o contabilidad de usuario avanzada (foco en análisis de mercado).

## Users
-   **Inversores Deportivos / Bettors Cuantitativos**: Buscan ineficiencias del mercado basándose en datos y no en intuición. Necesitan ver "el precio justo" vs "el precio de mercado".
-   **Analistas de Datos Deportivos**: Usuarios que quieren explorar datos crudos (xG, métricas de jugadores) para sacar sus propias conclusiones.

## Constraints
-   **Tech Stack**: React/Vite (Frontend) + Tauri/Rust (Backend) + SQLite (Local DB).
-   **Data Source**: FBref (Scraping para estadísticas) + Odds-API (para cuotas de mercado).
-   **Modelos**: Poisson para fútbol (inicial), extensible a otros modelos.

## Success Criteria
-   [ ] **Coverage**: El sistema muestra probabilidades "Real vs Market" para partidos de Premier League (como PoC).
-   [ ] **EV+ Detection**: Al menos una alerta de valor identificada correctamente basada en discrepancia de cuotas.
-   [ ] **Polymorphism**: La base de datos permite guardar una estructura base de "Evento" diferenciada para un deporte futuro sin romper el esquema actual.
-   [ ] **Analitic Clarity**: La UI presenta claramente la diferencia entre Probabilidad (%) y Valor (EV).
