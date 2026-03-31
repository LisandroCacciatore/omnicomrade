# Release Notes (short) — 2026-03-31

## Scope
Testing hardening + routing consistency + build safety.

## Included
- Unified role routing to keep `alumno -> student-profile.html` and normalize `coach -> profesor`.
- Added modular testable helpers:
  - `js/route-map.js`
  - `js/training-math.js`
  - `js/routine-builder-utils.js`
- Build hardening with `scripts/generate-supabase-config.cjs`:
  - validates `SUPABASE_URL` and `SUPABASE_ANON_KEY`
  - supports `SUPABASE_CONFIG_PATH`
  - creates missing output directories
- Test coverage expanded:
  - Unit (`tests/unit/*`)
  - Contract (`tests/contract/*`)
  - Smoke/E2E (`tests/e2e/*`)
- NPM scripts:
  - `test:unit`
  - `test:contract`
  - `test:e2e`
  - `test:all`

## Result
- Current backlog status:
  - P0 complete
  - Sprint 1 complete
  - Sprint 2 complete

## Notes for merge/deploy
- This file is intentionally under `release-history/` to keep implementation docs separated from product docs.
- Safe to keep in branch history; optional to exclude from final production branch if desired.
