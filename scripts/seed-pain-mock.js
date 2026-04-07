// Script para aplicar migraciones de pain_zone y seed mock data
// Uso: node scripts/seed-pain-mock.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pugwofiapgdzxpdbbtnn.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1Z3dvZmlhcGdkenhwZGJidG5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMjQ2OTIsImV4cCI6MjA4ODkwMDY5Mn0.18yf_cFDH11GemKdNC7TvFvPMAQdeXj1TTaXBH5L7gE';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

async function main() {
  console.log('🔧 Aplicando migración: agregar pain_zone a wellbeing_logs...');

  // 1. Agregar columna pain_zone si no existe
  const { error: alterError } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE wellbeing_logs ADD COLUMN IF NOT EXISTS pain_zone TEXT;`
  });

  if (alterError) {
    // Puede fallar si no existe la función exec_sql, intentamos directo
    console.log('⚠️ RPC exec_sql no disponible, intentando insertar directamente...');
  } else {
    console.log('✅ Columna pain_zone agregada');
  }

  // 2. Insertar alumnos mock
  console.log('\n👤 Insertando alumnos mock...');
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
    const { data, error } = await supabase
      .from('students')
      .upsert(s, { onConflict: 'id', ignoreDuplicates: true });
    if (error) {
      console.log(`⚠️ Alumno ${s.full_name}: ${error.message}`);
    } else {
      console.log(`✅ ${s.full_name}`);
    }
  }

  // 3. Insertar wellbeing logs de Marcos
  console.log(
    '\n📋 Insertando wellbeing logs de Marcos (rodilla_izq, lumbar, cadera, brazo_izq)...'
  );
  const marcosLogs = [
    {
      gym_id: GYM_ID,
      student_id: MARCOS_ID,
      sleep: 3,
      pain: 4,
      energy: 2,
      pain_zone: 'rodilla_izquierda',
      notes: 'Molestia al bajar en sentadilla, lado izquierdo',
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
      notes: 'Un poco mejor hoy pero sigue molestando',
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
    if (error) {
      if (error.code === '23505') {
        console.log(`⏭️ Log duplicado (día ${log.check_date}), saltando`);
      } else {
        console.log(`⚠️ Error: ${error.message}`);
      }
    } else {
      console.log(`✅ ${log.pain_zone} (pain=${log.pain}, día -${log.check_date})`);
    }
  }

  // 4. Insertar wellbeing logs de Valeria
  console.log('\n📋 Insertando wellbeing logs de Valeria (hombro_der, cervical, brazo_der)...');
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
      notes: 'Contractura cervical, no puedo girar bien',
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
      notes: 'No puedo levantar el brazo por encima del hombro',
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
      notes: 'Leve molestia en muñeca al hacer press',
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
    if (error) {
      if (error.code === '23505') {
        console.log(`⏭️ Log duplicado (día ${log.check_date}), saltando`);
      } else {
        console.log(`⚠️ Error: ${error.message}`);
      }
    } else {
      console.log(`✅ ${log.pain_zone} (pain=${log.pain}, día -${log.check_date})`);
    }
  }

  // 5. Verificar datos en la vista
  console.log('\n📊 Consultando v_gym_pain_summary...');
  const { data, error } = await supabase
    .from('v_gym_pain_summary')
    .select('*')
    .eq('gym_id', GYM_ID)
    .order('intensity_pct', { ascending: false });

  if (error) {
    console.log(`⚠️ Error consultando vista: ${error.message}`);
    console.log(
      '💡 Puede que necesites aplicar la migración 20260406_000022_gym_pain_summary_view.sql'
    );
  } else {
    console.log('\nZonas de dolor detectadas:');
    for (const row of data) {
      const bar = '█'.repeat(Math.round(Number(row.intensity_pct) / 2));
      console.log(
        `  ${row.pain_zone.padEnd(22)} ${bar.padEnd(10)} ${row.reports} reportes · ${row.students_affected} atletas · ${row.intensity_pct}%`
      );
    }
  }

  console.log('\n✅ Seed completado');
}

main().catch(console.error);
