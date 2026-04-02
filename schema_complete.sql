-- ============================================================
-- TECHFITNESS — SCHEMA COMPLETO
-- Todas las migraciones en orden de ejecución
-- Última actualización: Etapa 5 completa
-- ============================================================
-- Para ejecutar: pegar completo en Supabase SQL Editor
-- ATENCIÓN: Elimina y recrea todo desde cero.
-- ============================================================


-- ══════════════════════════════════════════════════════════════
-- 0. LIMPIEZA PREVENTIVA
-- ══════════════════════════════════════════════════════════════

-- Vistas
DROP VIEW IF EXISTS v_athlete_risk     CASCADE;
DROP VIEW IF EXISTS v_stagnation_check CASCADE;
DROP VIEW IF EXISTS v_weekly_volume    CASCADE;
DROP VIEW IF EXISTS v_exercise_progress CASCADE;

-- Tablas (orden inverso de dependencias)
DROP TABLE IF EXISTS wellbeing_logs          CASCADE;
DROP TABLE IF EXISTS attendance_logs         CASCADE;
DROP TABLE IF EXISTS workout_exercise_logs   CASCADE;
DROP TABLE IF EXISTS workout_sessions        CASCADE;
DROP TABLE IF EXISTS student_programs        CASCADE;
DROP TABLE IF EXISTS program_templates       CASCADE;
DROP TABLE IF EXISTS routine_day_exercises   CASCADE;
DROP TABLE IF EXISTS routine_days            CASCADE;
DROP TABLE IF EXISTS exercises               CASCADE;
DROP TABLE IF EXISTS routines                CASCADE;
DROP TABLE IF EXISTS memberships             CASCADE;
DROP TABLE IF EXISTS students                CASCADE;
DROP TABLE IF EXISTS profiles                CASCADE;
DROP TABLE IF EXISTS gyms                    CASCADE;

-- Funciones
DROP FUNCTION IF EXISTS get_current_gym_id()              CASCADE;
DROP FUNCTION IF EXISTS get_current_role()                 CASCADE;
DROP FUNCTION IF EXISTS handle_user_role_sync()            CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column()         CASCADE;
DROP FUNCTION IF EXISTS update_updated_at()                CASCADE;
DROP FUNCTION IF EXISTS calculate_membership_end_date()    CASCADE;
DROP FUNCTION IF EXISTS sync_student_membership_status()   CASCADE;
DROP FUNCTION IF EXISTS update_exercises_updated_at()      CASCADE;
DROP FUNCTION IF EXISTS update_rde_updated_at()            CASCADE;
DROP FUNCTION IF EXISTS set_wellbeing_log_check_date()     CASCADE;


-- ══════════════════════════════════════════════════════════════
-- 1. FUNCIONES CORE
-- ══════════════════════════════════════════════════════════════

-- Devuelve el gym_id del usuario autenticado
CREATE OR REPLACE FUNCTION get_current_gym_id()
RETURNS uuid AS $$
DECLARE result uuid;
BEGIN
  SELECT gym_id INTO result FROM public.profiles WHERE id = auth.uid();
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Devuelve el rol del usuario autenticado
CREATE OR REPLACE FUNCTION get_current_role()
RETURNS text AS $$
DECLARE result text;
BEGIN
  SELECT role INTO result FROM public.profiles WHERE id = auth.uid();
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- updated_at genérico
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ══════════════════════════════════════════════════════════════
-- 2. GYMS (Tenants)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE gyms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  logo_url    TEXT,
  color       TEXT DEFAULT '#3B82F6',
  plan        TEXT DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  available_equipment JSONB NOT NULL DEFAULT '["barra","mancuernas","maquina","cable","peso_corporal","banda","kettlebell","otros"]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gyms_select" ON gyms
  FOR SELECT USING (id = get_current_gym_id());

CREATE POLICY "gyms_update" ON gyms
  FOR UPDATE USING (id = get_current_gym_id() AND get_current_role() = 'gim_admin');

-- Seed
INSERT INTO gyms (id, name, slug)
VALUES ('c0a80121-7ac0-4e3b-b461-7509f6b64b15', 'Gimnasio TechFitness', 'techfitness-demo')
ON CONFLICT (id) DO NOTHING;


-- ══════════════════════════════════════════════════════════════
-- 3. PROFILES (extensión de auth.users)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gym_id      UUID NOT NULL REFERENCES gyms(id),
  full_name   TEXT NOT NULL,
  avatar_url  TEXT,
  role        TEXT NOT NULL CHECK (role IN ('gim_admin', 'profesor', 'alumno')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (gym_id = get_current_gym_id());

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Trigger: sincroniza role y gym_id al JWT (raw_app_meta_data)
CREATE OR REPLACE FUNCTION handle_user_role_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_metadata =
    raw_app_metadata ||
    jsonb_strip_nulls(jsonb_build_object('role', NEW.role, 'gym_id', NEW.gym_id))
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_update_sync_role
  AFTER INSERT OR UPDATE OF role, gym_id ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_user_role_sync();


-- ══════════════════════════════════════════════════════════════
-- 4. STUDENTS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE students (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id                   UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  profile_id               UUID REFERENCES profiles(id),
  full_name                TEXT NOT NULL,
  email                    TEXT,
  phone                    TEXT,
  birth_date               DATE,
  avatar_url               TEXT,
  objetivo                 TEXT CHECK (objetivo IN ('fuerza','estetica','rendimiento','rehabilitacion','general')),
  membership_status        TEXT DEFAULT 'pendiente'
                             CHECK (membership_status IN ('activa','vencida','suspendida','pendiente')),
  coach_notes              TEXT,
  medical_certificate_url  TEXT,
  routine_id               UUID,
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at               TIMESTAMPTZ,
  UNIQUE(gym_id, email)
);

CREATE INDEX idx_students_gym_id       ON students(gym_id);
CREATE INDEX idx_students_deleted_at   ON students(deleted_at);
CREATE INDEX idx_students_profile_id   ON students(profile_id);
CREATE INDEX idx_students_routine_id   ON students(routine_id);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students_select" ON students
  FOR SELECT USING (gym_id = get_current_gym_id() AND deleted_at IS NULL);

CREATE POLICY "students_insert" ON students
  FOR INSERT WITH CHECK (gym_id = get_current_gym_id()
    AND get_current_role() IN ('gim_admin','profesor'));

CREATE POLICY "students_update" ON students
  FOR UPDATE USING (gym_id = get_current_gym_id()
    AND get_current_role() IN ('gim_admin','profesor'));

CREATE TRIGGER set_students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ══════════════════════════════════════════════════════════════
-- 5. MEMBERSHIPS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE memberships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id          UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  plan            TEXT NOT NULL CHECK (plan IN ('mensual','trimestral','anual')),
  amount          NUMERIC(10,2),
  payment_method  TEXT CHECK (payment_method IN ('efectivo','transferencia')),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_memberships_gym_id      ON memberships(gym_id);
CREATE INDEX idx_memberships_student_id  ON memberships(student_id);
CREATE INDEX idx_memberships_end_date    ON memberships(end_date);

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memberships_select" ON memberships
  FOR SELECT USING (gym_id = get_current_gym_id());

CREATE POLICY "memberships_insert" ON memberships
  FOR INSERT WITH CHECK (gym_id = get_current_gym_id()
    AND get_current_role() IN ('gim_admin','profesor'));

CREATE POLICY "memberships_update" ON memberships
  FOR UPDATE USING (gym_id = get_current_gym_id()
    AND get_current_role() IN ('gim_admin','profesor'));

-- Trigger: calcula end_date automáticamente según plan
CREATE OR REPLACE FUNCTION calculate_membership_end_date()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.plan = 'mensual'     THEN NEW.end_date := NEW.start_date + INTERVAL '1 month';
  ELSIF NEW.plan = 'trimestral' THEN NEW.end_date := NEW.start_date + INTERVAL '3 months';
  ELSIF NEW.plan = 'anual'    THEN NEW.end_date := NEW.start_date + INTERVAL '1 year';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER calc_membership_end_date
  BEFORE INSERT ON memberships
  FOR EACH ROW EXECUTE FUNCTION calculate_membership_end_date();

-- Trigger: sincroniza membership_status en students
CREATE OR REPLACE FUNCTION sync_student_membership_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE students
  SET membership_status = CASE
    WHEN NEW.end_date >= CURRENT_DATE THEN 'activa'
    ELSE 'vencida'
  END,
  updated_at = NOW()
  WHERE id = NEW.student_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_membership_status
  AFTER INSERT OR UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION sync_student_membership_status();

CREATE TRIGGER set_memberships_updated_at
  BEFORE UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ══════════════════════════════════════════════════════════════
-- 6. ROUTINES
-- ══════════════════════════════════════════════════════════════

CREATE TABLE routines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id            UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  description       TEXT,
  objetivo          TEXT NOT NULL CHECK (objetivo IN ('fuerza','estetica','rendimiento','rehabilitacion','general')),
  difficulty        TEXT CHECK (difficulty IN ('principiante','intermedio','avanzado')),
  duration_weeks    INT CHECK (duration_weeks BETWEEN 1 AND 52),
  days_per_week     INT CHECK (days_per_week BETWEEN 1 AND 7),
  source_program    TEXT,       -- slug del programa base (si viene de routine-builder)
  source_rm_values  JSONB,      -- 1RMs usados al generar desde programa
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_routines_gym_id     ON routines(gym_id);
CREATE INDEX idx_routines_objetivo   ON routines(objetivo);
CREATE INDEX idx_routines_deleted_at ON routines(deleted_at);

ALTER TABLE routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "routines_select" ON routines
  FOR SELECT USING (gym_id = get_current_gym_id() AND deleted_at IS NULL);

CREATE POLICY "routines_insert" ON routines
  FOR INSERT WITH CHECK (gym_id = get_current_gym_id()
    AND get_current_role() IN ('gim_admin','profesor'));

CREATE POLICY "routines_update" ON routines
  FOR UPDATE USING (gym_id = get_current_gym_id()
    AND get_current_role() IN ('gim_admin','profesor'));

CREATE TRIGGER set_routines_updated_at
  BEFORE UPDATE ON routines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE students
  ADD CONSTRAINT students_routine_id_fkey
  FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION validate_student_routine_assignment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.routine_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM routines r
    WHERE r.id = NEW.routine_id
      AND r.gym_id = NEW.gym_id
      AND r.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'La rutina asignada no pertenece al gimnasio del alumno o está eliminada';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_students_routine_assignment
  BEFORE INSERT OR UPDATE OF routine_id, gym_id ON students
  FOR EACH ROW EXECUTE FUNCTION validate_student_routine_assignment();

-- Días de una rutina (routine-builder)
CREATE TABLE routine_days (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id  UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  day_number  INT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(routine_id, day_number)
);

CREATE INDEX idx_routine_days_routine_id ON routine_days(routine_id);

ALTER TABLE routine_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "routine_days_select" ON routine_days
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM routines r WHERE r.id = routine_days.routine_id
    AND r.gym_id = get_current_gym_id() AND r.deleted_at IS NULL
  ));

CREATE POLICY "routine_days_insert" ON routine_days
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM routines r WHERE r.id = routine_days.routine_id
    AND r.gym_id = get_current_gym_id()
  ) AND get_current_role() IN ('gim_admin','profesor'));

CREATE POLICY "routine_days_update" ON routine_days
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM routines r WHERE r.id = routine_days.routine_id
    AND r.gym_id = get_current_gym_id()
  ) AND get_current_role() IN ('gim_admin','profesor'));

CREATE POLICY "routine_days_delete" ON routine_days
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM routines r WHERE r.id = routine_days.routine_id
    AND r.gym_id = get_current_gym_id()
  ) AND get_current_role() IN ('gim_admin','profesor'));


-- ══════════════════════════════════════════════════════════════
-- 7. EXERCISES (Biblioteca global + custom por gym)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE exercises (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id       UUID REFERENCES gyms(id) ON DELETE CASCADE,  -- NULL si is_global
  is_global    BOOLEAN NOT NULL DEFAULT FALSE,
  name         TEXT NOT NULL,
  description  TEXT,
  muscle_group TEXT NOT NULL CHECK (muscle_group IN (
                 'pecho','espalda','hombros','biceps','triceps',
                 'core','piernas','gluteos','cardio','otros')),
  category     TEXT CHECK (category IN ('fuerza','hipertrofia','resistencia','movilidad','tecnica')),
  difficulty   TEXT CHECK (difficulty IN ('principiante','intermedio','avanzado')),
  main_goal    TEXT CHECK (main_goal IN (
                 'fuerza','hipertrofia','resistencia_muscular',
                 'movilidad','potencia','readaptacion')),
  movement_pattern TEXT CHECK (movement_pattern IN (
                 'empuje_horizontal','empuje_vertical',
                 'traccion_horizontal','traccion_vertical',
                 'dominante_rodilla','dominante_cadera',
                 'core_anti_extension','core_anti_rotacion','locomocion')),
  safety_level TEXT CHECK (safety_level IN (
                 'sin_alerta','precaucion','supervision_recomendada','alerta_alta')),
  technical_cue TEXT,
  complexity_level SMALLINT CHECK (complexity_level BETWEEN 1 AND 5),
  regression_exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  progression_exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  equipment    TEXT CHECK (equipment IN (
                 'barra','mancuernas','maquina','cable',
                 'peso_corporal','banda','kettlebell','otros')),
  video_url    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ,
  CONSTRAINT exercises_gym_or_global CHECK (
    (is_global = TRUE AND gym_id IS NULL) OR
    (is_global = FALSE AND gym_id IS NOT NULL)
  )
);

CREATE INDEX idx_exercises_gym_id      ON exercises(gym_id);
CREATE INDEX idx_exercises_is_global   ON exercises(is_global);
CREATE INDEX idx_exercises_muscle      ON exercises(muscle_group);
CREATE INDEX idx_exercises_main_goal   ON exercises(main_goal);
CREATE INDEX idx_exercises_pattern     ON exercises(movement_pattern);
CREATE INDEX idx_exercises_safety      ON exercises(safety_level);
CREATE INDEX idx_exercises_complexity  ON exercises(complexity_level);
CREATE INDEX idx_exercises_regression  ON exercises(regression_exercise_id);
CREATE INDEX idx_exercises_progression ON exercises(progression_exercise_id);
CREATE INDEX idx_exercises_deleted_at  ON exercises(deleted_at);

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercises_select" ON exercises
  FOR SELECT USING (
    deleted_at IS NULL AND (
      is_global = TRUE OR gym_id = get_current_gym_id()
    )
  );

CREATE POLICY "exercises_insert" ON exercises
  FOR INSERT WITH CHECK (
    is_global = FALSE AND gym_id = get_current_gym_id()
    AND get_current_role() IN ('gim_admin','profesor')
  );

CREATE POLICY "exercises_update" ON exercises
  FOR UPDATE USING (
    is_global = FALSE AND gym_id = get_current_gym_id()
    AND get_current_role() IN ('gim_admin','profesor')
  );

CREATE OR REPLACE FUNCTION update_exercises_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER set_exercises_updated_at
  BEFORE UPDATE ON exercises
  FOR EACH ROW EXECUTE FUNCTION update_exercises_updated_at();

CREATE TABLE exercise_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, exercise_id)
);

CREATE TABLE exercise_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exercise_favorites_user_id ON exercise_favorites(user_id);
CREATE INDEX idx_exercise_favorites_exercise_id ON exercise_favorites(exercise_id);
CREATE INDEX idx_exercise_usage_user_id ON exercise_usage_events(user_id);
CREATE INDEX idx_exercise_usage_exercise_id ON exercise_usage_events(exercise_id);
CREATE INDEX idx_exercise_usage_used_at ON exercise_usage_events(used_at DESC);

ALTER TABLE exercise_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercise_favorites_select_own" ON exercise_favorites
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "exercise_favorites_insert_own" ON exercise_favorites
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM exercises e
      WHERE e.id = exercise_id
        AND e.deleted_at IS NULL
        AND (e.is_global = TRUE OR e.gym_id = get_current_gym_id())
    )
  );

CREATE POLICY "exercise_favorites_delete_own" ON exercise_favorites
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "exercise_usage_select_own" ON exercise_usage_events
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "exercise_usage_insert_own" ON exercise_usage_events
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM exercises e
      WHERE e.id = exercise_id
        AND e.deleted_at IS NULL
        AND (e.is_global = TRUE OR e.gym_id = get_current_gym_id())
    )
  );

-- Ejercicios dentro de un día (routine-builder)
CREATE TABLE routine_day_exercises (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_day_id  UUID NOT NULL REFERENCES routine_days(id) ON DELETE CASCADE,
  exercise_id     UUID REFERENCES exercises(id) ON DELETE SET NULL,
  exercise_name   TEXT,        -- override o custom sin exercise_id
  order_index     INT NOT NULL DEFAULT 0,
  sets            INT,
  reps            TEXT,
  rest_seconds    INT,
  rpe             NUMERIC(3,1),
  weight_kg       NUMERIC(6,2),
  weight_pct      NUMERIC(5,2),
  weight_ref      TEXT,        -- 'sq', 'bp', 'dl', etc.
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rde_routine_day_id ON routine_day_exercises(routine_day_id);
CREATE INDEX idx_rde_exercise_id    ON routine_day_exercises(exercise_id);

ALTER TABLE routine_day_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rde_select" ON routine_day_exercises
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM routine_days rd JOIN routines r ON r.id = rd.routine_id
    WHERE rd.id = routine_day_exercises.routine_day_id
    AND r.gym_id = get_current_gym_id() AND r.deleted_at IS NULL
  ));

CREATE POLICY "rde_insert" ON routine_day_exercises
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM routine_days rd JOIN routines r ON r.id = rd.routine_id
    WHERE rd.id = routine_day_exercises.routine_day_id
    AND r.gym_id = get_current_gym_id()
  ) AND get_current_role() IN ('gim_admin','profesor'));

CREATE POLICY "rde_update" ON routine_day_exercises
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM routine_days rd JOIN routines r ON r.id = rd.routine_id
    WHERE rd.id = routine_day_exercises.routine_day_id
    AND r.gym_id = get_current_gym_id()
  ) AND get_current_role() IN ('gim_admin','profesor'));

CREATE POLICY "rde_delete" ON routine_day_exercises
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM routine_days rd JOIN routines r ON r.id = rd.routine_id
    WHERE rd.id = routine_day_exercises.routine_day_id
    AND r.gym_id = get_current_gym_id()
  ) AND get_current_role() IN ('gim_admin','profesor'));

CREATE OR REPLACE FUNCTION update_rde_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER set_rde_updated_at
  BEFORE UPDATE ON routine_day_exercises
  FOR EACH ROW EXECUTE FUNCTION update_rde_updated_at();


-- ══════════════════════════════════════════════════════════════
-- 8. PROGRAM TEMPLATES & STUDENT PROGRAMS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE program_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  author        TEXT,
  description   TEXT,
  level         TEXT CHECK (level IN ('principiante','intermedio','avanzado')),
  focus         TEXT[],
  weeks         INT,
  days_per_week INT,
  is_global     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE program_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "program_templates_select" ON program_templates
  FOR SELECT USING (is_global = TRUE);

-- Seed programas
INSERT INTO program_templates (slug, name, author, description, level, focus, weeks, days_per_week) VALUES
('starting-strength',  'Starting Strength',   'Mark Rippetoe',  'Progresión lineal para principiantes con los 5 movimientos fundamentales.',       'principiante', ARRAY['fuerza','tecnica'],         12, 3),
('stronglifts-5x5',    'StrongLifts 5×5',      'Mehdi Hadim',    '5×5 en los básicos con dos sesiones alternadas. Mayor volumen técnico que SS.',   'principiante', ARRAY['fuerza','hipertrofia'],     12, 3),
('gzclp',              'GZCLP',                'Sayit Garip',    'Progresión lineal por tiers T1/T2/T3. Cuando falla T1, cambia el scheme.',        'intermedio',   ARRAY['fuerza','hipertrofia'],     10, 4),
('wendler-531',        'Wendler 5/3/1',         'Jim Wendler',    'Ciclos de 4 semanas sobre Training Max al 90%. AMRAP en la serie tope.',          'intermedio',   ARRAY['fuerza','resistencia'],     4,  4),
('cube-method',        'The Cube Method',       'Brandon Lilly',  'Rotación Heavy/Explosive/Reps. Nunca todo pesado al mismo tiempo.',               'avanzado',     ARRAY['fuerza','potencia'],        3,  3),
('ppl',                'Push / Pull / Legs',    'Método clásico', 'PPL doble por semana. Alto volumen para hipertrofia con 6 días.',                 'intermedio',   ARRAY['hipertrofia','estetica'],   8,  6);

CREATE TABLE student_programs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id        UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  template_id   UUID NOT NULL REFERENCES program_templates(id),
  rm_values     JSONB NOT NULL DEFAULT '{}',
  started_at    DATE,
  current_week  INT NOT NULL DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'activo'
                  CHECK (status IN ('activo','pausado','completado','cancelado')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_student_programs_gym_id     ON student_programs(gym_id);
CREATE INDEX idx_student_programs_student_id ON student_programs(student_id);
CREATE INDEX idx_student_programs_status     ON student_programs(status);
CREATE INDEX idx_student_programs_student_status ON student_programs(student_id, status);

ALTER TABLE student_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_programs_select" ON student_programs
  FOR SELECT USING (gym_id = get_current_gym_id());

CREATE POLICY "student_programs_insert" ON student_programs
  FOR INSERT WITH CHECK (gym_id = get_current_gym_id()
    AND get_current_role() IN ('gim_admin','profesor'));

CREATE POLICY "student_programs_update" ON student_programs
  FOR UPDATE USING (gym_id = get_current_gym_id()
    AND get_current_role() IN ('gim_admin','profesor'));


-- ══════════════════════════════════════════════════════════════
-- 9. WORKOUT SESSIONS & LOGS (Etapa 3)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE workout_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id           UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  routine_name     TEXT,
  day_name         TEXT,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  duration_minutes INT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ws_gym_id      ON workout_sessions(gym_id);
CREATE INDEX idx_ws_student_id  ON workout_sessions(student_id);
CREATE INDEX idx_ws_completed   ON workout_sessions(completed_at DESC NULLS LAST);
CREATE INDEX idx_ws_completed_student ON workout_sessions(student_id, completed_at DESC NULLS LAST)
  WHERE completed_at IS NOT NULL;

ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_select" ON workout_sessions
  FOR SELECT USING (gym_id = get_current_gym_id());
CREATE POLICY "ws_insert" ON workout_sessions
  FOR INSERT WITH CHECK (gym_id = get_current_gym_id());
CREATE POLICY "ws_update" ON workout_sessions
  FOR UPDATE USING (gym_id = get_current_gym_id());

CREATE TABLE workout_exercise_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id           UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  session_id       UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_name    TEXT NOT NULL,
  muscle_group     TEXT,
  set_number       INT,
  reps_target      TEXT,
  reps_actual      TEXT,
  weight_target    NUMERIC(8,2),
  weight_used      NUMERIC(8,2),   -- nombre canónico
  status           TEXT DEFAULT 'logrado'
                     CHECK (status IN ('logrado','ajustado','fallido','omitido')),
  effort_level     TEXT DEFAULT 'normal'
                     CHECK (effort_level IN ('facil','normal','muy_pesado','al_fallo')),
  adjustment_note  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wel_session_id    ON workout_exercise_logs(session_id);
CREATE INDEX idx_wel_gym_id        ON workout_exercise_logs(gym_id);
CREATE INDEX idx_wel_exercise_name ON workout_exercise_logs(exercise_name);

ALTER TABLE workout_exercise_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wel_select" ON workout_exercise_logs
  FOR SELECT USING (gym_id = get_current_gym_id());
CREATE POLICY "wel_insert" ON workout_exercise_logs
  FOR INSERT WITH CHECK (gym_id = get_current_gym_id());


-- ══════════════════════════════════════════════════════════════
-- 10. ATTENDANCE LOGS (Etapa 3)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE attendance_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id         UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  check_in_time  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_al_gym_id     ON attendance_logs(gym_id);
CREATE INDEX idx_al_student_id ON attendance_logs(student_id);
CREATE INDEX idx_al_check_in   ON attendance_logs(check_in_time DESC);

ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "al_select" ON attendance_logs
  FOR SELECT USING (gym_id = get_current_gym_id());
CREATE POLICY "al_insert" ON attendance_logs
  FOR INSERT WITH CHECK (gym_id = get_current_gym_id()
    AND get_current_role() IN ('gim_admin','profesor'));


-- ══════════════════════════════════════════════════════════════
-- 11. WELLBEING LOGS (Etapa 5)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE wellbeing_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id      UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  sleep       SMALLINT NOT NULL CHECK (sleep  BETWEEN 1 AND 5),
  pain        SMALLINT NOT NULL CHECK (pain   BETWEEN 1 AND 5),
  energy      SMALLINT NOT NULL CHECK (energy BETWEEN 1 AND 5),
  notes       TEXT,
  checked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_date  DATE NOT NULL
);

CREATE OR REPLACE FUNCTION set_wellbeing_log_check_date()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.check_date := (NEW.checked_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_wellbeing_log_check_date
  BEFORE INSERT OR UPDATE OF checked_at ON wellbeing_logs
  FOR EACH ROW EXECUTE FUNCTION set_wellbeing_log_check_date();

CREATE INDEX idx_wl_gym_student ON wellbeing_logs(gym_id, student_id);
CREATE INDEX idx_wl_checked_at  ON wellbeing_logs(checked_at DESC);

-- Un solo check por alumno por día
CREATE UNIQUE INDEX idx_wl_one_per_day
  ON wellbeing_logs(student_id, check_date);

ALTER TABLE wellbeing_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wl_insert" ON wellbeing_logs
  FOR INSERT WITH CHECK (gym_id = get_current_gym_id());
CREATE POLICY "wl_select" ON wellbeing_logs
  FOR SELECT USING (gym_id = get_current_gym_id());


-- ══════════════════════════════════════════════════════════════
-- 12. VISTAS ANALÍTICAS (Etapas 4 y 5)
-- ══════════════════════════════════════════════════════════════

-- ── v_exercise_progress ──────────────────────────────────────
CREATE OR REPLACE VIEW v_exercise_progress AS
SELECT
  wel.gym_id,
  ws.student_id,
  wel.exercise_name,
  wel.muscle_group,
  DATE(ws.completed_at AT TIME ZONE 'America/Argentina/Buenos_Aires') AS session_date,
  MAX(wel.weight_used) AS max_weight,
  COUNT(*) AS total_sets,
  ws.id AS session_id
FROM workout_exercise_logs wel
JOIN workout_sessions ws ON ws.id = wel.session_id
WHERE ws.completed_at IS NOT NULL
  AND wel.weight_used IS NOT NULL
  AND wel.weight_used > 0
  AND wel.status != 'omitido'
GROUP BY wel.gym_id, ws.student_id, wel.exercise_name, wel.muscle_group,
  DATE(ws.completed_at AT TIME ZONE 'America/Argentina/Buenos_Aires'), ws.id
ORDER BY session_date ASC;

ALTER VIEW v_exercise_progress SET (security_invoker = true);

-- ── v_weekly_volume ──────────────────────────────────────────
CREATE OR REPLACE VIEW v_weekly_volume AS
SELECT
  wel.gym_id,
  ws.student_id,
  DATE_TRUNC('week', ws.completed_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE AS week_start,
  COALESCE(wel.muscle_group, 'otros') AS muscle_group,
  SUM(COALESCE(wel.set_number, 1)) AS total_sets,
  COUNT(DISTINCT ws.id) AS sessions_count
FROM workout_exercise_logs wel
JOIN workout_sessions ws ON ws.id = wel.session_id
WHERE ws.completed_at IS NOT NULL AND wel.status != 'omitido'
GROUP BY wel.gym_id, ws.student_id,
  DATE_TRUNC('week', ws.completed_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE,
  COALESCE(wel.muscle_group, 'otros')
ORDER BY week_start ASC;

ALTER VIEW v_weekly_volume SET (security_invoker = true);

-- ── v_stagnation_check ───────────────────────────────────────
CREATE OR REPLACE VIEW v_stagnation_check AS
WITH ranked_sessions AS (
  SELECT gym_id, student_id, exercise_name, muscle_group, session_date, max_weight,
    ROW_NUMBER() OVER (PARTITION BY gym_id, student_id, exercise_name ORDER BY session_date DESC) AS rn
  FROM v_exercise_progress
),
last_4 AS (SELECT * FROM ranked_sessions WHERE rn <= 4),
stagnation AS (
  SELECT
    gym_id, student_id, exercise_name, muscle_group,
    MAX(CASE WHEN rn = 1 THEN max_weight END) AS current_weight,
    MAX(CASE WHEN rn = 2 THEN max_weight END) AS prev1_weight,
    MAX(CASE WHEN rn = 3 THEN max_weight END) AS prev2_weight,
    MAX(CASE WHEN rn = 4 THEN max_weight END) AS prev3_weight,
    MAX(CASE WHEN rn = 1 THEN session_date END) AS last_session_date,
    COUNT(*) AS sessions_with_data
  FROM last_4
  GROUP BY gym_id, student_id, exercise_name, muscle_group
)
SELECT *,
  CASE
    WHEN sessions_with_data >= 3
      AND current_weight IS NOT NULL AND prev1_weight IS NOT NULL AND prev2_weight IS NOT NULL
      AND current_weight <= prev1_weight AND prev1_weight <= prev2_weight
    THEN TRUE ELSE FALSE
  END AS is_stagnant,
  CASE
    WHEN current_weight IS NOT NULL AND prev3_weight IS NOT NULL AND prev3_weight > 0
    THEN ROUND(((current_weight - prev3_weight) / prev3_weight * 100)::numeric, 1)
    ELSE NULL
  END AS progress_pct
FROM stagnation;

ALTER VIEW v_stagnation_check SET (security_invoker = true);

-- ── v_athlete_risk ───────────────────────────────────────────
CREATE OR REPLACE VIEW v_athlete_risk AS
WITH
wellbeing_recent AS (
  SELECT student_id, gym_id,
    ROUND(AVG(sleep)::numeric,  1) AS avg_sleep,
    ROUND(AVG(pain)::numeric,   1) AS avg_pain,
    ROUND(AVG(energy)::numeric, 1) AS avg_energy,
    COUNT(*) AS wellbeing_checks,
    MAX(checked_at) AS last_check_at,
    ROUND(
      ((AVG(sleep) - 1) / 4.0 * 10 * 0.35)
      + ((5 - AVG(pain)) / 4.0 * 10 * 0.35)
      + ((AVG(energy) - 1) / 4.0 * 10 * 0.30)
    ::numeric, 1) AS wellbeing_score
  FROM wellbeing_logs
  WHERE checked_at >= NOW() - INTERVAL '7 days'
  GROUP BY student_id, gym_id
),
volume_current AS (
  SELECT ws.student_id, ws.gym_id,
    SUM(COALESCE(wel.set_number, 1)) AS current_week_sets
  FROM workout_sessions ws
  JOIN workout_exercise_logs wel ON wel.session_id = ws.id
  WHERE ws.completed_at >= DATE_TRUNC('week', NOW()) AND wel.status != 'omitido'
  GROUP BY ws.student_id, ws.gym_id
),
volume_avg AS (
  SELECT ws.student_id, ws.gym_id, AVG(weekly_sets) AS avg_weekly_sets
  FROM (
    SELECT ws.student_id, ws.gym_id,
      DATE_TRUNC('week', ws.completed_at) AS wk,
      SUM(COALESCE(wel.set_number, 1)) AS weekly_sets
    FROM workout_sessions ws
    JOIN workout_exercise_logs wel ON wel.session_id = ws.id
    WHERE ws.completed_at >= NOW() - INTERVAL '5 weeks'
      AND ws.completed_at < DATE_TRUNC('week', NOW())
      AND wel.status != 'omitido'
    GROUP BY ws.student_id, ws.gym_id, DATE_TRUNC('week', ws.completed_at)
  ) weekly
  GROUP BY ws.student_id, ws.gym_id
),
last_session AS (
  SELECT student_id, gym_id,
    MAX(completed_at) AS last_completed_at,
    EXTRACT(EPOCH FROM (NOW() - MAX(completed_at))) / 86400.0 AS days_since_last
  FROM workout_sessions WHERE completed_at IS NOT NULL
  GROUP BY student_id, gym_id
),
stagnation_count AS (
  SELECT student_id, gym_id, COUNT(*) FILTER (WHERE is_stagnant) AS stagnant_exercises
  FROM v_stagnation_check GROUP BY student_id, gym_id
),
combined AS (
  SELECT
    s.id AS student_id, s.gym_id, s.full_name, s.avatar_url,
    COALESCE(wr.wellbeing_score, 5.0) AS wellbeing_score,
    COALESCE(wr.avg_sleep,  3) AS avg_sleep,
    COALESCE(wr.avg_pain,   1) AS avg_pain,
    COALESCE(wr.avg_energy, 3) AS avg_energy,
    COALESCE(wr.wellbeing_checks, 0) AS wellbeing_checks,
    wr.last_check_at,
    COALESCE(vc.current_week_sets, 0) AS current_week_sets,
    COALESCE(va.avg_weekly_sets,   0) AS avg_weekly_sets,
    CASE WHEN COALESCE(va.avg_weekly_sets, 0) > 0
      THEN ROUND((vc.current_week_sets::numeric / va.avg_weekly_sets * 100), 0)
      ELSE 100 END AS volume_spike_pct,
    COALESCE(ls.days_since_last, 999) AS days_since_last,
    ls.last_completed_at,
    COALESCE(sc.stagnant_exercises, 0) AS stagnant_exercises
  FROM students s
  LEFT JOIN wellbeing_recent wr ON wr.student_id = s.id
  LEFT JOIN volume_current   vc ON vc.student_id = s.id AND vc.gym_id = s.gym_id
  LEFT JOIN volume_avg       va ON va.student_id = s.id AND va.gym_id = s.gym_id
  LEFT JOIN last_session     ls ON ls.student_id = s.id AND ls.gym_id = s.gym_id
  LEFT JOIN stagnation_count sc ON sc.student_id = s.id AND sc.gym_id = s.gym_id
  WHERE s.deleted_at IS NULL
)
SELECT *,
  LEAST(100, GREATEST(0, ROUND((
    (1.0 - wellbeing_score / 10.0) * 30
    + CASE WHEN volume_spike_pct > 150 THEN LEAST(30, (volume_spike_pct - 100) * 0.15) ELSE 0 END
    + CASE WHEN days_since_last > 14 THEN 25 WHEN days_since_last > 7 THEN 15 ELSE 0 END
    + LEAST(15, stagnant_exercises * 5)
  )::numeric, 0))) AS risk_score,
  CASE
    WHEN wellbeing_score < 3.5 OR avg_pain >= 4 OR volume_spike_pct > 175 OR days_since_last > 14 THEN 'red'
    WHEN wellbeing_score < 5.5 OR avg_pain >= 3 OR volume_spike_pct > 130 OR days_since_last > 7 OR stagnant_exercises >= 2 THEN 'yellow'
    ELSE 'green'
  END AS risk_level,
  CASE
    WHEN avg_pain >= 4          THEN 'Dolor elevado'
    WHEN wellbeing_score < 3.5  THEN 'Bienestar crítico'
    WHEN volume_spike_pct > 175 THEN 'Spike de volumen'
    WHEN days_since_last > 14   THEN 'Inactivo +14 días'
    WHEN avg_energy < 2         THEN 'Energía muy baja'
    WHEN days_since_last > 7    THEN 'Inactivo +7 días'
    WHEN volume_spike_pct > 130 THEN 'Carga elevada'
    WHEN stagnant_exercises >= 2 THEN 'Múltiples estancamientos'
    WHEN wellbeing_score < 5.5  THEN 'Bienestar bajo'
    ELSE 'Sin alertas'
  END AS risk_reason
FROM combined;

ALTER VIEW v_athlete_risk SET (security_invoker = true);


-- ══════════════════════════════════════════════════════════════
-- 13. SEED: EJERCICIOS GLOBALES (30 ejercicios preset)
-- ══════════════════════════════════════════════════════════════

INSERT INTO exercises (is_global, gym_id, name, description, muscle_group, category, difficulty, equipment) VALUES
-- PECHO
(TRUE,NULL,'Press de banca con barra','Acostado en banco plano, agarre al ancho de hombros. Descender la barra al esternón controlado y empujar hasta extensión completa.','pecho','fuerza','intermedio','barra'),
(TRUE,NULL,'Press de banca inclinado con mancuernas','Banco a 30-45°. Bajar las mancuernas hasta el nivel del pecho con codos a 75° y empujar hacia arriba convergiendo.','pecho','hipertrofia','intermedio','mancuernas'),
(TRUE,NULL,'Fondos en paralelas (pecho)','Inclinarse hacia adelante ~30° para énfasis en pecho. Bajar hasta sentir el estiramiento y empujar hasta extensión.','pecho','fuerza','intermedio','peso_corporal'),
(TRUE,NULL,'Aperturas con mancuernas','Banco plano. Brazos ligeramente flexionados, bajar en arco amplio hasta sentir el estiramiento del pectoral y volver.','pecho','hipertrofia','principiante','mancuernas'),
(TRUE,NULL,'Cruces en cable polea alta','Poleas altas. Jalar los cables hacia abajo y hacia el centro cruzando levemente. Control total en la fase excéntrica.','pecho','hipertrofia','principiante','cable'),
-- ESPALDA
(TRUE,NULL,'Dominadas al frente','Agarre prono al ancho de hombros. Tirar del cuerpo hasta que la barbilla supere la barra, descender de forma controlada.','espalda','fuerza','avanzado','peso_corporal'),
(TRUE,NULL,'Remo con barra','Torso inclinado a ~45°, barra colgando. Remar hacia el abdomen bajo apretando los omóplatos. No usar el impulso lumbar.','espalda','fuerza','intermedio','barra'),
(TRUE,NULL,'Jalón al pecho en polea','Sentado en máquina, agarrar la barra amplia. Jalar hacia el pecho tocando el esternón, codos hacia abajo y atrás.','espalda','hipertrofia','principiante','cable'),
(TRUE,NULL,'Remo en polea sentado','Sentado, espalda erguida. Tirar el maneral hacia el abdomen manteniendo el torso estático. Apretar escápulas.','espalda','hipertrofia','principiante','cable'),
(TRUE,NULL,'Pull-over con mancuerna','Acostado transversal en banco. Mancuerna sobre el pecho, bajar detrás de la cabeza manteniendo el codo levemente flexionado.','espalda','hipertrofia','intermedio','mancuernas'),
-- HOMBROS
(TRUE,NULL,'Press militar con barra de pie','Barra a la altura del cuello, agarre al ancho de hombros. Empujar verticalmente sobre la cabeza hasta extensión.','hombros','fuerza','intermedio','barra'),
(TRUE,NULL,'Elevaciones laterales con mancuernas','De pie, brazos al costado. Elevar lateralmente hasta hombros, codos ligeramente flexionados. Descender lento.','hombros','hipertrofia','principiante','mancuernas'),
(TRUE,NULL,'Pájaro (posterior) con mancuernas','Inclinado a 90°, elevar las mancuernas lateralmente enfatizando el deltoides posterior. No balancear el tronco.','hombros','hipertrofia','principiante','mancuernas'),
-- BICEPS
(TRUE,NULL,'Curl con barra recta','De pie, agarre supino al ancho de hombros. Flexionar los codos elevando la barra hasta los hombros. Control total.','biceps','fuerza','principiante','barra'),
(TRUE,NULL,'Curl martillo con mancuernas','Agarre neutro (pulgares hacia arriba). Flexionar alternando. Trabaja el braquial y braquiorradial además del bíceps.','biceps','hipertrofia','principiante','mancuernas'),
(TRUE,NULL,'Curl concentrado','Sentado, codo apoyado en la cara interna del muslo. Flexionar lentamente maximizando el pico del bíceps.','biceps','hipertrofia','principiante','mancuernas'),
-- TRICEPS
(TRUE,NULL,'Press francés (Skull Crusher)','Banco plano, barra EZ. Bajar la barra hacia la frente doblando los codos. Extender hasta arriba. Codos fijos.','triceps','hipertrofia','intermedio','barra'),
(TRUE,NULL,'Extensión de tríceps en polea','Polea alta, agarre en cuerda. Empujar hacia abajo hasta extensión completa separando las puntas al final.','triceps','hipertrofia','principiante','cable'),
(TRUE,NULL,'Fondos en banco','Manos en banco detrás, piernas estiradas. Bajar doblando los codos a 90° y subir. Codos apuntando hacia atrás.','triceps','fuerza','principiante','peso_corporal'),
-- CORE
(TRUE,NULL,'Plancha frontal','Apoyado en antebrazos y pies. Cuerpo recto, glúteos activos, sin hundir las caderas. Mantener la posición.','core','resistencia','principiante','peso_corporal'),
(TRUE,NULL,'Crunch abdominal','Acostado, rodillas flexionadas. Elevar solo la parte superior del torso contrayendo el abdomen. No jalar del cuello.','core','hipertrofia','principiante','peso_corporal'),
(TRUE,NULL,'Rueda abdominal','De rodillas con la rueda. Extender los brazos rodando hacia adelante hasta casi tocar el suelo y volver.','core','fuerza','avanzado','otros'),
-- PIERNAS
(TRUE,NULL,'Sentadilla con barra (Back Squat)','Barra en trapecios, pies al ancho de hombros. Descender manteniendo el torso erguido hasta muslos paralelos.','piernas','fuerza','intermedio','barra'),
(TRUE,NULL,'Peso muerto convencional','Pies a la cadera, agarre al ancho de hombros. Empujar el suelo, caderas al frente, barra pegada a las piernas.','piernas','fuerza','avanzado','barra'),
(TRUE,NULL,'Prensa de piernas','Sentado en máquina. Pies al ancho de hombros. Bajar hasta 90° de rodilla y empujar sin bloquear la articulación.','piernas','hipertrofia','principiante','maquina'),
(TRUE,NULL,'Zancada con mancuernas','Dar un paso adelante y bajar la rodilla trasera al suelo. Volver y alternar. Torso erguido durante todo el movimiento.','piernas','hipertrofia','principiante','mancuernas'),
(TRUE,NULL,'Curl femoral en máquina','Acostado en máquina. Flexionar la rodilla hasta llevar los talones a los glúteos. Fase excéntrica lenta.','piernas','hipertrofia','principiante','maquina'),
-- GLUTEOS
(TRUE,NULL,'Hip Thrust con barra','Hombros apoyados en banco, barra sobre caderas. Empujar la cadera hacia arriba apretando glúteos al final.','gluteos','fuerza','intermedio','barra'),
(TRUE,NULL,'Patada trasera en cable','Tobillo en polea baja. Empujar hacia atrás y arriba extendiendo la cadera. Mantener el core activo.','gluteos','hipertrofia','principiante','cable'),
-- CARDIO
(TRUE,NULL,'Burpees','Desde de pie: agacharse, saltar piernas atrás a posición de plancha, volver y saltar vertical con palmada arriba.','cardio','resistencia','intermedio','peso_corporal'),
(TRUE,NULL,'Mountain Climbers','En plancha alta, llevar las rodillas alternadamente hacia el pecho a máxima velocidad manteniendo las caderas bajas.','cardio','resistencia','principiante','peso_corporal');


-- ══════════════════════════════════════════════════════════════
-- 14. STORAGE BUCKETS (ejecutar también en el Dashboard de Supabase)
-- ══════════════════════════════════════════════════════════════
-- Los buckets se crean desde Storage > New Bucket en el Dashboard.
-- Nombres: 'medical-certificates', 'gym-logos', 'avatars'
-- Todos privados (public: false)
-- Límite: 2 MB, tipos: image/png, image/jpeg, image/webp
-- (para medical-certificates también: application/pdf)
--
-- Las policies de storage se aplican automáticamente si usás
-- las funciones get_current_gym_id() y auth.uid() en el Dashboard.
-- ══════════════════════════════════════════════════════════════
