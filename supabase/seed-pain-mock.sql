-- ══════════════════════════════════════════════════════════════
-- 1. Crear vista v_gym_pain_summary
-- 2. Ampliar constraint pain_zone
-- 3. Seed: 2 alumnos mock con datos de dolor
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════

-- ── Vista de resumen de dolor por zona (30 días) ──
CREATE OR REPLACE VIEW v_gym_pain_summary AS
WITH recent AS (
  SELECT gym_id, student_id, pain_zone, pain, checked_at, notes
  FROM wellbeing_logs
  WHERE checked_at >= NOW() - INTERVAL '30 days'
),
zone_counts AS (
  SELECT gym_id, pain_zone,
    COUNT(*) AS reports,
    COUNT(DISTINCT student_id) AS students_affected,
    AVG(pain)::numeric(4,2) AS avg_pain
  FROM recent
  WHERE pain_zone IS NOT NULL AND pain >= 3
  GROUP BY gym_id, pain_zone
),
base AS (
  SELECT gym_id, COUNT(*) AS total_logs
  FROM recent
  GROUP BY gym_id
)
SELECT
  z.gym_id, z.pain_zone, z.reports, z.students_affected, z.avg_pain,
  b.total_logs,
  CASE
    WHEN b.total_logs > 0 THEN ROUND((z.reports::numeric / b.total_logs::numeric) * 100, 2)
    ELSE 0
  END AS intensity_pct
FROM zone_counts z
LEFT JOIN base b ON b.gym_id = z.gym_id;

-- ── Ampliar constraint pain_zone ──
ALTER TABLE wellbeing_logs DROP CONSTRAINT IF EXISTS wellbeing_logs_pain_zone_check;

ALTER TABLE wellbeing_logs ADD CONSTRAINT wellbeing_logs_pain_zone_check CHECK (
  pain_zone IN (
    'cuello', 'hombro', 'espalda_alta', 'espalda_baja', 'cadera',
    'rodilla', 'tobillo', 'general', 'ninguno',
    'rodilla_izquierda', 'rodilla_derecha',
    'hombro_izquierdo', 'hombro_derecho',
    'brazo_izquierdo', 'brazo_derecho',
    'muneca_izquierda', 'muneca_derecha',
    'tobillo_izquierdo', 'tobillo_derecho',
    'cervical', 'lumbar'
  )
);

CREATE INDEX IF NOT EXISTS idx_wl_pain_zone ON wellbeing_logs(pain_zone) WHERE pain_zone IS NOT NULL;

-- ── Alumnos mock ──
INSERT INTO students (id, gym_id, full_name, email, membership_status, objetivo)
VALUES
  ('a1111111-1111-1111-1111-111111111001', 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'Marcos López', 'marcos.lopez@mock.com', 'activa', 'fuerza'),
  ('a1111111-1111-1111-1111-111111111002', 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'Valeria Torres', 'valeria.torres@mock.com', 'activa', 'estetica')
ON CONFLICT (id) DO NOTHING;

-- ── Logs: Marcos (patrón sentadilla) ──
INSERT INTO wellbeing_logs (id, gym_id, student_id, sleep, pain, energy, pain_zone, notes, checked_at, check_date)
VALUES
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111001', 3, 4, 2, 'rodilla_izquierda', 'Molestia al bajar en sentadilla',      NOW() - INTERVAL '1 day',  (NOW() - INTERVAL '1 day')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111001', 4, 3, 3, 'rodilla_izquierda', 'Un poco mejor pero sigue molestando',  NOW() - INTERVAL '3 days', (NOW() - INTERVAL '3 days')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111001', 2, 4, 2, 'lumbar',            'Dolor lumbar después de peso muerto',  NOW() - INTERVAL '5 days', (NOW() - INTERVAL '5 days')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111001', 3, 3, 3, 'lumbar',            'Rigidez en zona baja',                 NOW() - INTERVAL '7 days', (NOW() - INTERVAL '7 days')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111001', 4, 2, 4, 'cadera',            'Leve molestia en cadera',              NOW() - INTERVAL '10 days',(NOW() - INTERVAL '10 days')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111001', 3, 3, 3, 'rodilla_izquierda', 'Sigue la molestia',                    NOW() - INTERVAL '14 days',(NOW() - INTERVAL '14 days')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111001', 4, 5, 1, 'rodilla_izquierda', 'No puedo flexionar bien, dolor agudo', NOW() - INTERVAL '2 days', (NOW() - INTERVAL '2 days')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111001', 3, 3, 3, 'brazo_izquierdo',   'Molestia en bíceps después de curl',   NOW() - INTERVAL '8 days', (NOW() - INTERVAL '8 days')::date)
ON CONFLICT DO NOTHING;

-- ── Logs: Valeria (patrón press) ──
INSERT INTO wellbeing_logs (id, gym_id, student_id, sleep, pain, energy, pain_zone, notes, checked_at, check_date)
VALUES
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111002', 3, 4, 3, 'hombro_derecho',  'Pinchazo al hacer press militar',    NOW() - INTERVAL '1 day',  (NOW() - INTERVAL '1 day')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111002', 2, 4, 2, 'cervical',        'Contractura cervical',               NOW() - INTERVAL '2 days', (NOW() - INTERVAL '2 days')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111002', 4, 3, 3, 'hombro_derecho',  'Molestia constante en hombro',       NOW() - INTERVAL '4 days', (NOW() - INTERVAL '4 days')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111002', 3, 3, 3, 'brazo_derecho',   'Dolor irradiado al brazo derecho',   NOW() - INTERVAL '6 days', (NOW() - INTERVAL '6 days')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111002', 4, 3, 4, 'cervical',        'Tensión en cuello',                  NOW() - INTERVAL '9 days', (NOW() - INTERVAL '9 days')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111002', 3, 4, 2, 'hombro_derecho',  'No puedo levantar el brazo',         NOW() - INTERVAL '3 days', (NOW() - INTERVAL '3 days')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111002', 4, 2, 4, 'muneca_derecha',  'Leve molestia en muñeca',            NOW() - INTERVAL '12 days',(NOW() - INTERVAL '12 days')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111002', 3, 3, 3, 'espalda_alta',    'Tensión entre omóplatos',            NOW() - INTERVAL '15 days',(NOW() - INTERVAL '15 days')::date)
ON CONFLICT DO NOTHING;

-- ── Verificar ──
SELECT pain_zone, reports, students_affected, avg_pain, intensity_pct
FROM v_gym_pain_summary
WHERE gym_id = 'c0a80121-7ac0-4e3b-b461-7509f6b64b15'
ORDER BY intensity_pct DESC;
