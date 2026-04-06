-- Sincroniza columnas de metadata técnica esperadas por el frontend de ejercicios.
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS main_goal TEXT,
  ADD COLUMN IF NOT EXISTS movement_pattern TEXT,
  ADD COLUMN IF NOT EXISTS safety_level TEXT,
  ADD COLUMN IF NOT EXISTS complexity_level INTEGER,
  ADD COLUMN IF NOT EXISTS technical_cue TEXT;

-- Guard rail opcional para mantener complejidad en rango útil.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'exercises'
      AND constraint_name = 'exercises_complexity_level_range_chk'
  ) THEN
    ALTER TABLE exercises
      ADD CONSTRAINT exercises_complexity_level_range_chk
      CHECK (complexity_level IS NULL OR complexity_level BETWEEN 1 AND 5);
  END IF;
END$$;
