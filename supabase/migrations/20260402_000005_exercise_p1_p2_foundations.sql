-- P1/P2 foundations: complexity and progression-regression links
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS complexity_level SMALLINT,
  ADD COLUMN IF NOT EXISTS regression_exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS progression_exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exercises_complexity_level_check'
  ) THEN
    ALTER TABLE exercises
      ADD CONSTRAINT exercises_complexity_level_check
      CHECK (complexity_level IS NULL OR complexity_level BETWEEN 1 AND 5);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_exercises_complexity_level ON exercises(complexity_level);
CREATE INDEX IF NOT EXISTS idx_exercises_regression_ex_id ON exercises(regression_exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercises_progression_ex_id ON exercises(progression_exercise_id);
