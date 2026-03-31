# Migration Discipline

- Add one migration per schema change under `supabase/migrations`.
- Use timestamped filenames: `YYYYMMDD_HHMMSS_description.sql`.
- Never modify old migrations after release; append a new migration.
- Validate with a staging DB before production rollout.
