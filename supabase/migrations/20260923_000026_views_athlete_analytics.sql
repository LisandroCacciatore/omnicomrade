-- ============================================================
-- Migration: 20260923_000026_views_athlete_analytics
-- Author:    Lisandro Cacciatore
-- Date:      2026-09-23
--
-- Purpose:
--   1. Version the 3 athlete analytics views that existed in production
--      but were never captured in repo migrations (schema drift):
--        - v_athlete_weekly_load
--        - v_athlete_wellbeing_trend
--        - v_exercise_progression
--   2. Ensure security_invoker = true on those 3 views.
--   3. Ensure security_invoker = true on v_gym_pain_summary,
--      created in 20260406_000022 without the setting.
--
-- Idempotent: uses CREATE OR REPLACE VIEW and SET (security_invoker = true).
-- Requires PostgreSQL 15+ (security_invoker).
--
-- Context: on 2026-09-23 an RLS bypass was found in v_athlete_risk and
-- four sibling views. They were fixed live via SQL Editor. These three
-- views were identified as drift (present in prod, absent from repo).
-- Versioning them closes the drift and makes the schema auditable.
-- ============================================================

-- 1. v_athlete_weekly_load
create or replace view public.v_athlete_weekly_load as
 SELECT wel.gym_id,
    ws.student_id,
    date_trunc('week'::text, ws.completed_at)::date AS week_start,
    count(DISTINCT ws.id) AS sessions,
    count(wel.id) AS total_sets,
    sum(COALESCE(wel.weight_used, 0::numeric) * COALESCE(wel.reps_actual::integer, 0)::numeric) AS total_volume_kg,
    round(avg(
        CASE wel.effort_level
            WHEN 'facil'::text THEN 1
            WHEN 'normal'::text THEN 2
            WHEN 'muy_pesado'::text THEN 3
            WHEN 'al_fallo'::text THEN 4
            ELSE 2
        END), 2) AS avg_effort_score,
    count(
        CASE
            WHEN wel.status = ANY (ARRAY['fallido'::text, 'ajustado'::text]) THEN 1
            ELSE NULL::integer
        END) AS failed_sets
   FROM workout_sessions ws
     JOIN workout_exercise_logs wel ON wel.session_id = ws.id
  WHERE ws.completed_at IS NOT NULL
  GROUP BY wel.gym_id, ws.student_id, (date_trunc('week'::text, ws.completed_at)::date);

alter view public.v_athlete_weekly_load set (security_invoker = true);


-- 2. v_athlete_wellbeing_trend
create or replace view public.v_athlete_wellbeing_trend as
 WITH weekly AS (
         SELECT wellbeing_logs.gym_id,
            wellbeing_logs.student_id,
            date_trunc('week'::text, wellbeing_logs.checked_at)::date AS week_start,
            round(avg(wellbeing_logs.sleep), 2) AS avg_sleep,
            round(avg(wellbeing_logs.pain), 2) AS avg_pain,
            round(avg(wellbeing_logs.energy), 2) AS avg_energy,
            round(avg(wellbeing_logs.sleep) / 5.0 * 30::numeric + avg(wellbeing_logs.energy) / 5.0 * 40::numeric + (6::numeric - avg(wellbeing_logs.pain)) / 5.0 * 30::numeric, 1) AS wb_score,
            count(*) AS checkins
           FROM wellbeing_logs
          GROUP BY wellbeing_logs.gym_id, wellbeing_logs.student_id, (date_trunc('week'::text, wellbeing_logs.checked_at)::date)
        )
 SELECT gym_id,
    student_id,
    week_start,
    avg_sleep,
    avg_pain,
    avg_energy,
    wb_score,
    checkins,
    round(wb_score - lag(wb_score) OVER (PARTITION BY student_id ORDER BY week_start), 1) AS wb_score_delta
   FROM weekly w;

alter view public.v_athlete_wellbeing_trend set (security_invoker = true);


-- 3. v_exercise_progression
create or replace view public.v_exercise_progression as
 WITH per_session AS (
         SELECT wel.gym_id,
            ws.student_id,
            wel.exercise_name,
            wel.muscle_group,
            ws.completed_at,
            max(wel.weight_used) AS max_weight,
            sum(
                CASE
                    WHEN wel.status = 'fallido'::text THEN 1
                    ELSE 0
                END) AS failed_sets,
            sum(
                CASE
                    WHEN wel.effort_level = 'al_fallo'::text THEN 1
                    ELSE 0
                END) AS fallo_sets,
            count(*) AS total_sets,
            row_number() OVER (PARTITION BY ws.student_id, wel.exercise_name ORDER BY ws.completed_at DESC) AS session_rank
           FROM workout_sessions ws
             JOIN workout_exercise_logs wel ON wel.session_id = ws.id
          WHERE ws.completed_at IS NOT NULL AND wel.weight_used > 0::numeric
          GROUP BY wel.gym_id, ws.student_id, wel.exercise_name, wel.muscle_group, ws.completed_at
        ), aggregated AS (
         SELECT per_session.gym_id,
            per_session.student_id,
            per_session.exercise_name,
            per_session.muscle_group,
            max(
                CASE
                    WHEN per_session.session_rank = 1 THEN per_session.max_weight
                    ELSE NULL::numeric
                END) AS last_weight,
            max(
                CASE
                    WHEN per_session.session_rank = 1 THEN per_session.failed_sets
                    ELSE NULL::bigint
                END) AS last_failed,
            max(
                CASE
                    WHEN per_session.session_rank = 1 THEN per_session.fallo_sets
                    ELSE NULL::bigint
                END) AS last_fallo,
            max(
                CASE
                    WHEN per_session.session_rank = 1 THEN per_session.total_sets
                    ELSE NULL::bigint
                END) AS last_total_sets,
            max(
                CASE
                    WHEN per_session.session_rank = 2 THEN per_session.max_weight
                    ELSE NULL::numeric
                END) AS prev_weight,
            count(DISTINCT
                CASE
                    WHEN per_session.session_rank <= 8 THEN per_session.completed_at
                    ELSE NULL::timestamp with time zone
                END) AS sessions_tracked
           FROM per_session
          GROUP BY per_session.gym_id, per_session.student_id, per_session.exercise_name, per_session.muscle_group
        )
 SELECT gym_id,
    student_id,
    exercise_name,
    muscle_group,
    last_weight,
    last_failed,
    last_fallo,
    last_total_sets,
    prev_weight,
    sessions_tracked,
    round((last_weight - prev_weight) / NULLIF(prev_weight, 0::numeric) * 100::numeric, 1) AS progression_pct,
        CASE
            WHEN last_failed >= 2 THEN 'bajar'::text
            WHEN last_fallo >= 1 THEN 'mantener'::text
            WHEN last_failed = 0 AND last_fallo = 0 AND sessions_tracked >= 2 THEN 'subir'::text
            ELSE 'mantener'::text
        END AS auto_progression
   FROM aggregated a;

alter view public.v_exercise_progression set (security_invoker = true);


-- 4. v_gym_pain_summary — created in 20260406_000022 without security_invoker
alter view public.v_gym_pain_summary set (security_invoker = true);


-- ============================================================
-- Verification: all 4 views must show security_invoker=true
-- ============================================================
select c.relname, c.reloptions
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v'
  and c.relname in (
    'v_athlete_weekly_load',
    'v_athlete_wellbeing_trend',
    'v_exercise_progression',
    'v_gym_pain_summary'
  )
order by c.relname;