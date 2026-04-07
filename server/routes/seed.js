import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const GYM_ID = 'c0a80121-7ac0-4e3b-b461-7509f6b64b15';
const MARCOS_ID = 'a1111111-1111-1111-1111-111111111001';
const VALERIA_ID = 'a1111111-1111-1111-1111-111111111002';

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function checkDate(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

router.post('/seed-pain-mock', async (req, res) => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabase = createClient(supabaseUrl, serviceKey);
  const results = { students: [], marcos_logs: [], valeria_logs: [], pain_summary: null };

  try {
    // 1. Agregar columna pain_zone si no existe
    await supabase.from('wellbeing_logs').select('pain_zone').limit(1);

    // 2. Insertar alumnos
    const students = [
      {
        id: MARCOS_ID,
        gym_id: GYM_ID,
        full_name: 'Marcos López',
        email: 'marcos.lopez@mock.com',
        membership_status: 'activa',
        objetivo: 'fuerza'
      },
      {
        id: VALERIA_ID,
        gym_id: GYM_ID,
        full_name: 'Valeria Torres',
        email: 'valeria.torres@mock.com',
        membership_status: 'activa',
        objetivo: 'estetica'
      }
    ];
    for (const s of students) {
      const { error } = await supabase
        .from('students')
        .upsert(s, { onConflict: 'id', ignoreDuplicates: true });
      results.students.push({ name: s.full_name, ok: !error, error: error?.message });
    }

    // 3. Logs de Marcos
    const marcosLogs = [
      {
        gym_id: GYM_ID,
        student_id: MARCOS_ID,
        sleep: 3,
        pain: 4,
        energy: 2,
        pain_zone: 'rodilla_izquierda',
        notes: 'Molestia al bajar en sentadilla',
        checked_at: daysAgo(1),
        check_date: checkDate(1)
      },
      {
        gym_id: GYM_ID,
        student_id: MARCOS_ID,
        sleep: 4,
        pain: 3,
        energy: 3,
        pain_zone: 'rodilla_izquierda',
        notes: 'Un poco mejor pero sigue molestando',
        checked_at: daysAgo(3),
        check_date: checkDate(3)
      },
      {
        gym_id: GYM_ID,
        student_id: MARCOS_ID,
        sleep: 2,
        pain: 4,
        energy: 2,
        pain_zone: 'lumbar',
        notes: 'Dolor lumbar después de peso muerto',
        checked_at: daysAgo(5),
        check_date: checkDate(5)
      },
      {
        gym_id: GYM_ID,
        student_id: MARCOS_ID,
        sleep: 3,
        pain: 3,
        energy: 3,
        pain_zone: 'lumbar',
        notes: 'Rigidez en zona baja',
        checked_at: daysAgo(7),
        check_date: checkDate(7)
      },
      {
        gym_id: GYM_ID,
        student_id: MARCOS_ID,
        sleep: 4,
        pain: 2,
        energy: 4,
        pain_zone: 'cadera',
        notes: 'Leve molestia en cadera',
        checked_at: daysAgo(10),
        check_date: checkDate(10)
      },
      {
        gym_id: GYM_ID,
        student_id: MARCOS_ID,
        sleep: 3,
        pain: 3,
        energy: 3,
        pain_zone: 'rodilla_izquierda',
        notes: 'Sigue la molestia',
        checked_at: daysAgo(14),
        check_date: checkDate(14)
      },
      {
        gym_id: GYM_ID,
        student_id: MARCOS_ID,
        sleep: 4,
        pain: 5,
        energy: 1,
        pain_zone: 'rodilla_izquierda',
        notes: 'No puedo flexionar bien, dolor agudo',
        checked_at: daysAgo(2),
        check_date: checkDate(2)
      },
      {
        gym_id: GYM_ID,
        student_id: MARCOS_ID,
        sleep: 3,
        pain: 3,
        energy: 3,
        pain_zone: 'brazo_izquierdo',
        notes: 'Molestia en bíceps después de curl',
        checked_at: daysAgo(8),
        check_date: checkDate(8)
      }
    ];
    for (const log of marcosLogs) {
      const { error } = await supabase.from('wellbeing_logs').insert(log);
      results.marcos_logs.push({
        zone: log.pain_zone,
        pain: log.pain,
        ok: !error,
        error: error?.message
      });
    }

    // 4. Logs de Valeria
    const valeriaLogs = [
      {
        gym_id: GYM_ID,
        student_id: VALERIA_ID,
        sleep: 3,
        pain: 4,
        energy: 3,
        pain_zone: 'hombro_derecho',
        notes: 'Pinchazo al hacer press militar',
        checked_at: daysAgo(1),
        check_date: checkDate(1)
      },
      {
        gym_id: GYM_ID,
        student_id: VALERIA_ID,
        sleep: 2,
        pain: 4,
        energy: 2,
        pain_zone: 'cervical',
        notes: 'Contractura cervical',
        checked_at: daysAgo(2),
        check_date: checkDate(2)
      },
      {
        gym_id: GYM_ID,
        student_id: VALERIA_ID,
        sleep: 4,
        pain: 3,
        energy: 3,
        pain_zone: 'hombro_derecho',
        notes: 'Molestia constante en hombro',
        checked_at: daysAgo(4),
        check_date: checkDate(4)
      },
      {
        gym_id: GYM_ID,
        student_id: VALERIA_ID,
        sleep: 3,
        pain: 3,
        energy: 3,
        pain_zone: 'brazo_derecho',
        notes: 'Dolor irradiado al brazo derecho',
        checked_at: daysAgo(6),
        check_date: checkDate(6)
      },
      {
        gym_id: GYM_ID,
        student_id: VALERIA_ID,
        sleep: 4,
        pain: 3,
        energy: 4,
        pain_zone: 'cervical',
        notes: 'Tensión en cuello',
        checked_at: daysAgo(9),
        check_date: checkDate(9)
      },
      {
        gym_id: GYM_ID,
        student_id: VALERIA_ID,
        sleep: 3,
        pain: 4,
        energy: 2,
        pain_zone: 'hombro_derecho',
        notes: 'No puedo levantar el brazo',
        checked_at: daysAgo(3),
        check_date: checkDate(3)
      },
      {
        gym_id: GYM_ID,
        student_id: VALERIA_ID,
        sleep: 4,
        pain: 2,
        energy: 4,
        pain_zone: 'muneca_derecha',
        notes: 'Leve molestia en muñeca',
        checked_at: daysAgo(12),
        check_date: checkDate(12)
      },
      {
        gym_id: GYM_ID,
        student_id: VALERIA_ID,
        sleep: 3,
        pain: 3,
        energy: 3,
        pain_zone: 'espalda_alta',
        notes: 'Tensión entre omóplatos',
        checked_at: daysAgo(15),
        check_date: checkDate(15)
      }
    ];
    for (const log of valeriaLogs) {
      const { error } = await supabase.from('wellbeing_logs').insert(log);
      results.valeria_logs.push({
        zone: log.pain_zone,
        pain: log.pain,
        ok: !error,
        error: error?.message
      });
    }

    // 5. Consultar vista de resumen
    const { data, error } = await supabase
      .from('v_gym_pain_summary')
      .select('*')
      .eq('gym_id', GYM_ID)
      .order('intensity_pct', { ascending: false });

    if (!error && data) {
      results.pain_summary = data.map((r) => ({
        zone: r.pain_zone,
        reports: r.reports,
        students: r.students_affected,
        avg_pain: r.avg_pain,
        intensity: r.intensity_pct
      }));
    }

    res.json({ ok: true, results });
  } catch (err) {
    console.error('Seed error:', err);
    res.status(500).json({ ok: false, error: err.message, results });
  }
});

export default router;
