# ROADMAP.md

> **Current Phase**: Not started
> **Milestone**: v1.0 (Football MVP)

## Must-Haves (from SPEC)
- [ ] Mapeo de Probabilidades Fútbol (1X2, Goals)
- [ ] Integración Odds-API (Mercado Real)
- [ ] Cálculo de EV+ (Real vs Market)
- [ ] Arquitectura Polimórfica (Support Future Sports)

## Phases

### Phase 1: Foundation & Polymorphism
**Status**: ✅ Completed
**Objective**: Refactorizar la arquitectura actual para soportar "Deportes" como entidades abstractas y preparar la BD para múltiples tipos de stats.
**Key Deliverables**:
- Esquema DB migrado a `Events`, `Sports`, `MarketData`.
- Refactorización de Rust structs para usar Traits/Generics donde aplique.
- Interfaz básica con selector de deportes (solo Fútbol activo).

### Phase 2: Data Pipeline & Analytics Core
**Status**: 🚧 In Progress
**Objective**: Establecer un pipeline de datos robusto (bypass antibot) y perfeccionar el modelo de fútbol.
**Key Deliverables**:
- **Infrastructure**: Integración de **FlareSolverr** para scraping robusto (bypass Cloudflare).
- **Scraper Rework**: Adaptación del bot para usar FlareSolverr y manejo de errores resiliente.
- **Model**: Modelo Poisson expandido a Córners y Tarjetas.
- **Data**: Limpieza de datos y normalización de nombres de equipos.
- **UI**: Visualización de "Caja de Cristal" (Probabilidades crudas).

### Phase 3: Market Integration (The Scanner)
**Status**: ⬜ Not Started
**Objective**: Conectar Odds-API e implementar la lógica de detección de valor.
**Key Deliverables**:
- Integración cliente Odds-API en Rust.
- Motor de comparación: `MyProb` vs `MarketOdds`.
- UI de Alertas EV+ y Dashboard de oportunidades.

### Phase 4: UX & Polish
**Status**: ⬜ Not Started
**Objective**: Unificar todo en la "Terminal Financiera" con diseño premium.
**Key Deliverables**:
- Diseño "Dark Mode" financiero/profesional.
- Navegación fluida entre partidos y análisis.
- Packaging y release local v1.0.
