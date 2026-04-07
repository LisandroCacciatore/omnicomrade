-- Dashboard de prevención: agregación de dolor por zona en ventana móvil (30 días)
CREATE OR REPLACE VIEW v_gym_pain_summary AS
WITH recent AS (
  SELECT
    gym_id,
    student_id,
    pain_zone,
    pain,
    checked_at,
    notes
  FROM wellbeing_logs
  WHERE checked_at >= NOW() - INTERVAL '30 days'
),
zone_counts AS (
  SELECT
    gym_id,
    pain_zone,
    COUNT(*) AS reports,
    COUNT(DISTINCT student_id) AS students_affected,
    AVG(pain)::numeric(4,2) AS avg_pain
  FROM recent
  WHERE pain_zone IS NOT NULL AND pain >= 3
  GROUP BY gym_id, pain_zone
),
base AS (
  SELECT
    gym_id,
    COUNT(*) AS total_logs
  FROM recent
  GROUP BY gym_id
)
SELECT
  z.gym_id,
  z.pain_zone,
  z.reports,
  z.students_affected,
  z.avg_pain,
  b.total_logs,
  CASE
    WHEN b.total_logs > 0 THEN ROUND((z.reports::numeric / b.total_logs::numeric) * 100, 2)
    ELSE 0
  END AS intensity_pct
FROM zone_counts z
LEFT JOIN base b ON b.gym_id = z.gym_id;
