-- MVP: tablas para RMs por alumno y logs de ejecución de sets.

CREATE TABLE IF NOT EXISTS student_rms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  lift_key TEXT NOT NULL CHECK (lift_key IN ('squat','bench_press','deadlift','overhead_press')),
  one_rep_max_kg NUMERIC(6,2) NOT NULL CHECK (one_rep_max_kg > 0),
  tested_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, lift_key)
);

CREATE INDEX IF NOT EXISTS idx_student_rms_gym_student ON student_rms(gym_id, student_id);

CREATE TABLE IF NOT EXISTS exercise_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  routine_id UUID REFERENCES routines(id) ON DELETE SET NULL,
  routine_day_id UUID REFERENCES routine_days(id) ON DELETE SET NULL,
  exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  exercise_name TEXT NOT NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  set_number INTEGER,
  planned_reps TEXT,
  actual_reps TEXT,
  planned_weight_kg NUMERIC(6,2),
  actual_weight_kg NUMERIC(6,2),
  rpe_reported NUMERIC(3,1),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exercise_logs_student_performed_at
  ON exercise_logs(student_id, performed_at DESC);
