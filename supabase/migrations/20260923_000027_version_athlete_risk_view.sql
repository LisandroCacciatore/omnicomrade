-- ============================================================
-- Migration: 20260923_000027_version_athlete_risk_view
-- Author:    Lisandro Cacciatore
-- Date:      2026-09-23
--
-- Purpose:
--   Version the LIVE definition of v_athlete_risk into the repo.
--
--   The live view was redesigned by hand (separate abandonment_risk +
--   overload_risk) but never committed. The repo copy
--   (schema_complete.sql) still has the old shape
--   (risk_score, risk_level, wellbeing_score), and the frontend was
--   never updated either. This migration makes the repo match production.
--
-- Context:
--   Discovered 2026-09-23 while auditing a P0 RLS bypass on sibling
--   views. The frontend at js/profesor-dashboard.js:97 queries
--   .order('risk_score'), a column that does not exist in the live view
--   (42703). That screen is broken in production and was previously
--   reported as working - a false positive caught by re-verifying the
--   exact frontend query instead of probing the view directly.
--
-- Idempotent: CREATE OR REPLACE VIEW.
-- Depends on: security_invoker = true (applied below).
-- ============================================================

create or replace view public.v_athlete_risk as
 WITH recent_wb AS (
         SELECT wellbeing_logs.student_id,
            wellbeing_logs.gym_id,
            round(avg(
                CASE
                    WHEN wellbeing_logs.checked_at >= (now() - '7 days'::interval) THEN wellbeing_logs.sleep::numeric / 5.0 * 30::numeric + wellbeing_logs.energy::numeric / 5.0 * 40::numeric + (6 - wellbeing_logs.pain)::numeric / 5.0 * 30::numeric
                    ELSE NULL::numeric
                END), 1) AS wb_7d,
            round(avg(
                CASE
                    WHEN wellbeing_logs.checked_at >= (now() - '30 days'::interval) THEN wellbeing_logs.sleep::numeric / 5.0 * 30::numeric + wellbeing_logs.energy::numeric / 5.0 * 40::numeric + (6 - wellbeing_logs.pain)::numeric / 5.0 * 30::numeric
                    ELSE NULL::numeric
                END), 1) AS wb_30d
           FROM wellbeing_logs
          GROUP BY wellbeing_logs.student_id, wellbeing_logs.gym_id
        ), recent_sessions AS (
         SELECT workout_sessions.student_id,
            workout_sessions.gym_id,
            count(
                CASE
                    WHEN workout_sessions.completed_at >= (now() - '7 days'::interval) THEN 1
                    ELSE NULL::integer
                END) AS sess_7d,
            count(
                CASE
                    WHEN workout_sessions.completed_at >= (now() - '14 days'::interval) THEN 1
                    ELSE NULL::integer
                END) AS sess_14d,
            count(
                CASE
                    WHEN workout_sessions.completed_at >= (now() - '30 days'::interval) THEN 1
                    ELSE NULL::integer
                END) AS sess_30d,
            max(workout_sessions.completed_at) AS last_session
           FROM workout_sessions
          WHERE workout_sessions.completed_at IS NOT NULL
          GROUP BY workout_sessions.student_id, workout_sessions.gym_id
        ), recent_effort AS (
         SELECT ws.student_id,
            wel.gym_id,
            round(avg(
                CASE wel.effort_level
                    WHEN 'facil'::text THEN 1
                    WHEN 'normal'::text THEN 2
                    WHEN 'muy_pesado'::text THEN 3
                    WHEN 'al_fallo'::text THEN 4
                    ELSE NULL::integer
                END), 2) AS avg_effort_7d,
            count(
                CASE
                    WHEN wel.status = 'fallido'::text THEN 1
                    ELSE NULL::integer
                END)::double precision / NULLIF(count(*), 0)::double precision * 100::double precision AS pct_failed_7d
           FROM workout_sessions ws
             JOIN workout_exercise_logs wel ON wel.session_id = ws.id
          WHERE ws.completed_at >= (now() - '7 days'::interval)
          GROUP BY ws.student_id, wel.gym_id
        )
 SELECT s.student_id,
    s.gym_id,
    LEAST(50::bigint, GREATEST(0::bigint, EXTRACT(days FROM now() - s.last_session)::integer * 2 + GREATEST(0::bigint, (s.sess_14d - s.sess_7d * 2) * 5)))::integer AS abandonment_risk,
    LEAST(50::double precision, GREATEST(0::double precision, (COALESCE((e.avg_effort_7d - 2.0) * 15::numeric, 0::numeric) + COALESCE((70.0 - w.wb_7d) * 0.5, 0::numeric))::double precision + COALESCE(e.pct_failed_7d * 0.5::double precision, 0::double precision)))::integer AS overload_risk,
    LEAST(100, GREATEST(0, LEAST(50::bigint, GREATEST(0::bigint, EXTRACT(days FROM now() - s.last_session)::integer * 2 + GREATEST(0::bigint, (s.sess_14d - s.sess_7d * 2) * 5)))::integer + LEAST(50::double precision, GREATEST(0::double precision, (COALESCE((e.avg_effort_7d - 2.0) * 15::numeric, 0::numeric) + COALESCE((70.0 - w.wb_7d) * 0.5, 0::numeric))::double precision + COALESCE(e.pct_failed_7d * 0.5::double precision, 0::double precision)))::integer)) AS total_risk_score,
    w.wb_7d,
    w.wb_30d,
    s.sess_7d,
    s.sess_30d,
    s.last_session,
    e.avg_effort_7d,
    e.pct_failed_7d
   FROM recent_sessions s
     LEFT JOIN recent_wb w ON w.student_id = s.student_id AND w.gym_id = s.gym_id
     LEFT JOIN recent_effort e ON e.student_id = s.student_id AND e.gym_id = s.gym_id;

alter view public.v_athlete_risk set (security_invoker = true);


-- ============================================================
-- Verification
-- ============================================================
select c.relname, c.reloptions
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v'
  and c.relname = 'v_athlete_risk';