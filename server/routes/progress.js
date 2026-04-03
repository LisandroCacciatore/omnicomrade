import express from 'express';
import { supabase } from '../index.js';

const router = express.Router();

router.get('/students/:studentId/summary', async (req, res) => {
  try {
    const { studentId } = req.params;
    const gymId = req.query.gym_id;

    if (!studentId) {
      return res.status(400).json({ error: 'studentId es obligatorio' });
    }
    if (!gymId) {
      return res.status(400).json({ error: 'gym_id es obligatorio como query param' });
    }

    const weekCutoff = new Date();
    weekCutoff.setDate(weekCutoff.getDate() - 7);

    const [{ data: sessions, error: sessionsError }, { data: progressRows, error: progressError }, { data: stagRows, error: stagError }] = await Promise.all([
      supabase
        .from('workout_sessions')
        .select('id, completed_at')
        .eq('student_id', studentId)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false }),
      supabase
        .from('v_exercise_progress')
        .select('exercise_name, muscle_group, session_date, max_weight, session_id')
        .eq('student_id', studentId)
        .eq('gym_id', gymId)
        .order('session_date', { ascending: true }),
      supabase
        .from('v_stagnation_check')
        .select('exercise_name, muscle_group, is_stagnant, progress_pct, sessions_tracked')
        .eq('student_id', studentId)
        .eq('gym_id', gymId)
    ]);

    if (sessionsError || progressError || stagError) {
      return res.status(422).json({
        success: false,
        error: 'PROGRESS_QUERY_ERROR',
        details: {
          sessions: sessionsError?.message || null,
          progress: progressError?.message || null,
          stagnation: stagError?.message || null
        }
      });
    }

    const sessionList = sessions || [];
    const weekDone = sessionList.filter((s) => new Date(s.completed_at) >= weekCutoff).length;

    const byExercise = {};
    (progressRows || []).forEach((row) => {
      if (!byExercise[row.exercise_name]) {
        byExercise[row.exercise_name] = {
          exercise_name: row.exercise_name,
          muscle_group: row.muscle_group || 'otros',
          all_time_pr: 0,
          points: []
        };
      }
      const parsedWeight = parseFloat(row.max_weight || 0);
      byExercise[row.exercise_name].points.push({
        session_date: row.session_date,
        max_weight: parsedWeight,
        session_id: row.session_id
      });
      if (parsedWeight > byExercise[row.exercise_name].all_time_pr) {
        byExercise[row.exercise_name].all_time_pr = parsedWeight;
      }
    });

    return res.json({
      success: true,
      student_id: studentId,
      gym_id: gymId,
      kpis: {
        total_sessions: sessionList.length,
        week_done: weekDone,
        week_goal: 4,
        stagnation_count: (stagRows || []).filter((s) => s.is_stagnant).length
      },
      exercises: Object.values(byExercise),
      stagnation: stagRows || []
    });
  } catch (error) {
    console.error('Progress summary error:', error);
    return res.status(500).json({ error: 'Internal error', detail: error.message });
  }
});

export default router;
