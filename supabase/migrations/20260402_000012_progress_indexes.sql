-- Índices para endpoint de progreso
CREATE INDEX IF NOT EXISTS idx_workout_sessions_student_completed
  ON workout_sessions(student_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_workout_logs_session_exercise
  ON workout_exercise_logs(session_id, exercise_name);
