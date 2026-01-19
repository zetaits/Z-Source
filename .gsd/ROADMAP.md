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
**Status**: ⬜ Not Started
**Objective**: Refactorizar la arquitectura actual para soportar "Deportes" como entidades abstractas y preparar la BD para múltiples tipos de stats.
**Key Deliverables**:
- Esquema DB migrado a `Events`, `Sports`, `MarketData`.
- Refactorización de Rust structs para usar Traits/Generics donde aplique.
- Interfaz básica con selector de deportes (solo Fútbol activo).

### Phase 2: Football Analytics Core (Refinement)
**Status**: ⬜ Not Started
**Objective**: Perfeccionar el modelo de fútbol actual, añadiendo mercados secundarios y limpieza de datos.
**Key Deliverables**:
- Modelo Poisson expandido a Córners y Tarjetas (usando promedios simples si Poisson no aplica perfecto).
- Scraping robusto de datos necesarios para estos mercados.
- Visualización de "Caja de Cristal" (Probabilidades crudas).

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
