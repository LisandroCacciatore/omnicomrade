# Smoke Test — Flujo Alumno con Workout Intents

## Precondiciones
- Migraciones aplicadas incluyendo `20260403_000015_student_coach_and_workout_logging.sql`.
- API backend corriendo con `/api/workouts/*` habilitado.
- Usuario alumno con `student_id` activo en el gimnasio.

## Pasos
1. Entrar a `student-profile.html` y lanzar sesión de entrenamiento.
2. En `wellbeing-check.html`, completar sueño/dolor/energía y presionar **Comenzar**.
3. Verificar en DB que se creó/actualizó `workout_intents` con `status = wellbeing_done`.
4. Abrir `workout-session.html` y verificar que al cargar pase a `status = started` y exista `session_id`.
5. Completar todos los sets.
6. Verificar en DB:
   - `workout_sessions.completed_at` no nulo.
   - `workout_exercise_logs` insertados (con `logged_at`).
   - `workout_intents.status = completed`.
7. Repetir cancelando a mitad para validar que al menos quede el intent con estado iniciable/no completado.

## Query rápida de validación
```sql
select id, student_id, status, started_at, completed_at, updated_at
from workout_intents
order by created_at desc
limit 5;

select id, student_id, started_at, completed_at, duration_minutes
from workout_sessions
order by created_at desc
limit 5;

select session_id, exercise_name, set_number, logged_at
from workout_exercise_logs
order by created_at desc
limit 20;
```
