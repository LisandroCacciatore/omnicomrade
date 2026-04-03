-- Server-side favorites/usage + gym equipment config for exercise compatibility
ALTER TABLE gyms
  ADD COLUMN IF NOT EXISTS available_equipment JSONB NOT NULL DEFAULT '["barra","mancuernas","maquina","cable","peso_corporal","banda","kettlebell","otros"]'::jsonb;

CREATE TABLE IF NOT EXISTS exercise_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, exercise_id)
);

CREATE TABLE IF NOT EXISTS exercise_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exercise_favorites_user_id ON exercise_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_favorites_exercise_id ON exercise_favorites(exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercise_usage_user_id ON exercise_usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_usage_exercise_id ON exercise_usage_events(exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercise_usage_used_at ON exercise_usage_events(used_at DESC);

ALTER TABLE exercise_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exercise_favorites_select_own" ON exercise_favorites;
CREATE POLICY "exercise_favorites_select_own" ON exercise_favorites
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "exercise_favorites_insert_own" ON exercise_favorites;
CREATE POLICY "exercise_favorites_insert_own" ON exercise_favorites
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM exercises e
      WHERE e.id = exercise_id
        AND e.deleted_at IS NULL
        AND (e.is_global = TRUE OR e.gym_id = get_current_gym_id())
    )
  );

DROP POLICY IF EXISTS "exercise_favorites_delete_own" ON exercise_favorites;
CREATE POLICY "exercise_favorites_delete_own" ON exercise_favorites
  FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "exercise_usage_select_own" ON exercise_usage_events;
CREATE POLICY "exercise_usage_select_own" ON exercise_usage_events
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "exercise_usage_insert_own" ON exercise_usage_events;
CREATE POLICY "exercise_usage_insert_own" ON exercise_usage_events
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM exercises e
      WHERE e.id = exercise_id
        AND e.deleted_at IS NULL
        AND (e.is_global = TRUE OR e.gym_id = get_current_gym_id())
    )
  );
