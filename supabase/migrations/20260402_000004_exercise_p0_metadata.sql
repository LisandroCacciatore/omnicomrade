-- P0 exercise-list metadata for safer and more guided exercise selection
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS main_goal TEXT,
  ADD COLUMN IF NOT EXISTS movement_pattern TEXT,
  ADD COLUMN IF NOT EXISTS safety_level TEXT,
  ADD COLUMN IF NOT EXISTS technical_cue TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exercises_main_goal_check'
  ) THEN
    ALTER TABLE exercises
      ADD CONSTRAINT exercises_main_goal_check
      CHECK (main_goal IS NULL OR main_goal IN (
        'fuerza','hipertrofia','resistencia_muscular','movilidad','potencia','readaptacion'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exercises_movement_pattern_check'
  ) THEN
    ALTER TABLE exercises
      ADD CONSTRAINT exercises_movement_pattern_check
      CHECK (movement_pattern IS NULL OR movement_pattern IN (
        'empuje_horizontal','empuje_vertical','traccion_horizontal','traccion_vertical',
        'dominante_rodilla','dominante_cadera','core_anti_extension','core_anti_rotacion','locomocion'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exercises_safety_level_check'
  ) THEN
    ALTER TABLE exercises
      ADD CONSTRAINT exercises_safety_level_check
      CHECK (safety_level IS NULL OR safety_level IN (
        'sin_alerta','precaucion','supervision_recomendada','alerta_alta'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_exercises_main_goal ON exercises(main_goal);
CREATE INDEX IF NOT EXISTS idx_exercises_movement_pattern ON exercises(movement_pattern);
CREATE INDEX IF NOT EXISTS idx_exercises_safety_level ON exercises(safety_level);
