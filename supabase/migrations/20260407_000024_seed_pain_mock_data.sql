-- ══════════════════════════════════════════════════════════════
-- Seed: Mapa de dolor mock — 2 alumnos con patrones de dolor
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════

-- 1. Agregar columna pain_zone si no existe
ALTER TABLE wellbeing_logs
  ADD COLUMN IF NOT EXISTS pain_zone TEXT;

CREATE INDEX IF NOT EXISTS idx_wl_pain_zone ON wellbeing_logs(pain_zone) WHERE pain_zone IS NOT NULL;

-- 2. Alumnos mock
INSERT INTO students (id, gym_id, full_name, email, membership_status, objetivo)
VALUES
  ('a1111111-1111-1111-1111-111111111001', 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'Marcos López', 'marcos.lopez@mock.com', 'activa', 'fuerza'),
  ('a1111111-1111-1111-1111-111111111002', 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'Valeria Torres', 'valeria.torres@mock.com', 'activa', 'estetica')
ON CONFLICT (id) DO NOTHING;

-- 3. Wellbeing logs: Marcos — patrón sentadilla (rodilla_izq, lumbar, cadera, brazo_izq)
INSERT INTO wellbeing_logs (id, gym_id, student_id, sleep, pain, energy, pain_zone, notes, checked_at, check_date)
VALUES
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111001', 3, 4, 2, 'rodilla_izquierda', 'Molestia al bajar en sentadilla',          NOW() - INTERVAL '1 day',  (NOW() - INTERVAL '1 day')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111001', 4, 3, 3, 'rodilla_izquierda', 'Un poco mejor pero sigue molestando',      NOW() - INTERVAL '3 days', (NOW() - INTERVAL '3 days')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111001', 2, 4, 2, 'lumbar',            'Dolor lumbar después de peso muerto',      NOW() - INTERVAL '5 days', (NOW() - INTERVAL '5 days')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111001', 3, 3, 3, 'lumbar',            'Rigidez en zona baja',                     NOW() - INTERVAL '7 days', (NOW() - INTERVAL '7 days')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111001', 4, 2, 4, 'cadera',            'Leve molestia en cadera',                  NOW() - INTERVAL '10 days',(NOW() - INTERVAL '10 days')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111001', 3, 3, 3, 'rodilla_izquierda', 'Sigue la molestia',                        NOW() - INTERVAL '14 days',(NOW() - INTERVAL '14 days')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111001', 4, 5, 1, 'rodilla_izquierda', 'No puedo flexionar bien, dolor agudo',     NOW() - INTERVAL '2 days', (NOW() - INTERVAL '2 days')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111001', 3, 3, 3, 'brazo_izquierdo',   'Molestia en bíceps después de curl',       NOW() - INTERVAL '8 days', (NOW() - INTERVAL '8 days')::date)
ON CONFLICT DO NOTHING;

-- 4. Wellbeing logs: Valeria — patrón press (hombro_der, cervical, brazo_der)
INSERT INTO wellbeing_logs (id, gym_id, student_id, sleep, pain, energy, pain_zone, notes, checked_at, check_date)
VALUES
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111002', 3, 4, 3, 'hombro_derecho',  'Pinchazo al hacer press militar',          NOW() - INTERVAL '1 day',  (NOW() - INTERVAL '1 day')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111002', 2, 4, 2, 'cervical',        'Contractura cervical',                     NOW() - INTERVAL '2 days', (NOW() - INTERVAL '2 days')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111002', 4, 3, 3, 'hombro_derecho',  'Molestia constante en hombro',             NOW() - INTERVAL '4 days', (NOW() - INTERVAL '4 days')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111002', 3, 3, 3, 'brazo_derecho',   'Dolor irradiado al brazo derecho',         NOW() - INTERVAL '6 days', (NOW() - INTERVAL '6 days')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111002', 4, 3, 4, 'cervical',        'Tensión en cuello',                        NOW() - INTERVAL '9 days', (NOW() - INTERVAL '9 days')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111002', 3, 4, 2, 'hombro_derecho',  'No puedo levantar el brazo',               NOW() - INTERVAL '3 days', (NOW() - INTERVAL '3 days')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111002', 4, 2, 4, 'muneca_derecha',  'Leve molestia en muñeca',                  NOW() - INTERVAL '12 days',(NOW() - INTERVAL '12 days')::date),
  (gen_random_uuid(), 'c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'a1111111-1111-1111-1111-111111111002', 3, 3, 3, 'espalda_alta',    'Tensión entre omóplatos',                  NOW() - INTERVAL '15 days',(NOW() - INTERVAL '15 days')::date)
ON CONFLICT DO NOTHING;

-- 5. Verificar datos
SELECT pain_zone, reports, students_affected, avg_pain, intensity_pct
FROM v_gym_pain_summary
WHERE gym_id = 'c0a80121-7ac0-4e3b-b461-7509f6b64b15'
ORDER BY intensity_pct DESC;
