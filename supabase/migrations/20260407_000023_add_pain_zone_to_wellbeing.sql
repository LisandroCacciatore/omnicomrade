-- Agregar columna pain_zone a wellbeing_logs (faltaba en el schema)
ALTER TABLE wellbeing_logs
  ADD COLUMN IF NOT EXISTS pain_zone TEXT;

CREATE INDEX IF NOT EXISTS idx_wl_pain_zone ON wellbeing_logs(pain_zone) WHERE pain_zone IS NOT NULL;
