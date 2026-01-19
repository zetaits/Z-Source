---
phase: 1
plan: 3
wave: 2
---

# Plan 1.3: Frontend Adaptation

## Objective
Ensure the frontend correctly handles the data from the new backend structure and prepare the UI for multi-sport switching (even if only 1 is active).

## Context
- src/pages/DashboardHome.tsx
- src/types/index.ts (if exists, or define types)

## Tasks

<task type="auto">
  <name>Verify TS Interfaces</name>
  <files>src/pages/DashboardHome.tsx</files>
  <action>
    Check `MatchPreview` interface. It shouldn't strictly require changes if the backend maps the Join back to a flat JSON, but we should add a `sport` field to it to support the UI filtering.
    - Add `sport: string` to `MatchPreview`.
  </action>
  <verify>Frontend compile</verify>
  <done>Interface matches backend JSON</done>
</task>

<task type="auto">
  <name>Add Sport Selector (UI)</name>
  <files>src/pages/DashboardHome.tsx</files>
  <action>
    Add a simple Tabs/Select component in the header to switch sports (Football | Basketball | Tennis).
    - Football (Active)
    - Others (Disabled/Coming Soon)
    - Store selection in local state (default 'football').
  </action>
  <verify>Run dev server, see visual tabs</verify>
  <done>UI shows sport separation</done>
</task>

## Success Criteria
- [ ] Dashboard loads matches successfully
- [ ] "Football" is selected by default
- [ ] Architecture is ready for "Basketball" tab to fire a different API call in future
