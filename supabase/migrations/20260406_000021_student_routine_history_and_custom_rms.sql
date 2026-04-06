-- Permite historial de reemplazo de rutina por alumno (sin borrar rutinas).
CREATE TABLE IF NOT EXISTS student_routine_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  old_routine_id UUID REFERENCES routines(id) ON DELETE SET NULL,
  new_routine_id UUID REFERENCES routines(id) ON DELETE SET NULL,
  replaced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_student_routine_history_student_date
  ON student_routine_history(student_id, replaced_at DESC);

-- Habilita lifts personalizados en RM Profile.
ALTER TABLE student_rms
  ADD COLUMN IF NOT EXISTS exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS label TEXT;

ALTER TABLE student_rms
  ALTER COLUMN lift_key DROP NOT NULL;

ALTER TABLE student_rms
  DROP CONSTRAINT IF EXISTS student_rms_lift_key_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'student_rms'
      AND constraint_name = 'student_rms_lift_or_exercise_chk'
  ) THEN
    ALTER TABLE student_rms
      ADD CONSTRAINT student_rms_lift_or_exercise_chk
      CHECK (lift_key IS NOT NULL OR exercise_id IS NOT NULL OR label IS NOT NULL);
  END IF;
END$$;
