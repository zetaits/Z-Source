# Architecture Decision Record (ADR)

## ADR-001: Polymorphic Database Design
**Status**: Proposed
**Context**: We need to support multiple sports (Football, Basketball, Tennis) with vastly different statistical structures but common event properties (Time, Teams/Players, Odds).
**Decision**: Use a relational "Core" table (`events`) linked to sport-specific extension tables (`football_stats`, `basketball_stats`) or JSONB columns for flexible schema, to be decided in Phase 1 planning.
