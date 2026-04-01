import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../index.js';

const VALID_MEMBERSHIP_PLANS = ['mensual', 'trimestral', 'anual'];
const VALID_PAYMENT_METHODS = ['efectivo', 'transferencia'];
const VALID_OBJETIVOS = ['fuerza', 'estetica', 'rendimiento', 'rehabilitacion', 'general'];

export async function processOnboarding(
  { requestId, gymId, student, membership, program },
  actorId
) {
  const auditId = uuidv4();
  const startTime = new Date().toISOString();
  let studentId = null;
  let membershipId = null;
  let programId = null;

  await logAudit({
    id: auditId,
    request_id: requestId,
    gym_id: gymId,
    actor_id: actorId,
    step: 'started',
    status: 'in_progress',
    started_at: startTime
  });

  try {
    if (!student?.full_name) {
      throw { code: 'VALIDATION_ERROR', message: 'El nombre del alumno es obligatorio' };
    }

    const studentData = {
      gym_id: gymId,
      full_name: student.full_name.trim(),
      email: student.email?.trim() || null,
      phone: student.phone?.trim() || null,
      birth_date: student.birth_date || null,
      objetivo: VALID_OBJETIVOS.includes(student.objetivo) ? student.objetivo : 'general',
      membership_status: 'pendiente',
      notes: student.notes?.trim() || null
    };

    const { data: studentResult, error: studentError } = await supabase
      .from('students')
      .insert(studentData)
      .select('id')
      .single();

    if (studentError) {
      throw { code: 'STUDENT_CREATE_ERROR', message: studentError.message, detail: studentError };
    }

    studentId = studentResult.id;

    await logAudit({
      id: uuidv4(),
      request_id: requestId,
      gym_id: gymId,
      student_id: studentId,
      step: 'student_created',
      status: 'success',
      data: { full_name: student.full_name }
    });

    if (membership) {
      if (!membership.plan || !VALID_MEMBERSHIP_PLANS.includes(membership.plan)) {
        throw { code: 'VALIDATION_ERROR', message: 'Plan de membresía inválido' };
      }
      if (!membership.start_date || !membership.amount) {
        throw { code: 'VALIDATION_ERROR', message: 'Fecha de inicio y monto son obligatorios' };
      }

      const endDate = calculateEndDate(membership.start_date, membership.plan);

      const membershipData = {
        gym_id: gymId,
        student_id: studentId,
        plan: membership.plan,
        amount: parseFloat(membership.amount),
        payment_method: VALID_PAYMENT_METHODS.includes(membership.payment_method)
          ? membership.payment_method
          : 'efectivo',
        start_date: membership.start_date,
        end_date: endDate,
        notes: membership.notes?.trim() || null
      };

      const { data: membershipResult, error: membershipError } = await supabase
        .from('memberships')
        .insert(membershipData)
        .select('id')
        .single();

      if (membershipError) {
        await supabase.from('students').delete().eq('id', studentId);
        throw {
          code: 'MEMBERSHIP_CREATE_ERROR',
          message: membershipError.message,
          detail: membershipError,
          recoverable: false
        };
      }

      membershipId = membershipResult.id;

      await supabase.from('students').update({ membership_status: 'activa' }).eq('id', studentId);

      await logAudit({
        id: uuidv4(),
        request_id: requestId,
        gym_id: gymId,
        student_id: studentId,
        membership_id: membershipId,
        step: 'membership_created',
        status: 'success',
        data: { plan: membership.plan, end_date: endDate }
      });
    }

    if (program?.template_id) {
      const { data: templateExists } = await supabase
        .from('program_templates')
        .select('id')
        .eq('id', program.template_id)
        .single();

      if (!templateExists) {
        await logAudit({
          id: uuidv4(),
          request_id: requestId,
          gym_id: gymId,
          student_id: studentId,
          step: 'program_assign_failed',
          status: 'error',
          error_code: 'TEMPLATE_NOT_FOUND',
          error_message: 'Template de programa no encontrado'
        });

        return {
          success: true,
          partial: true,
          student_id: studentId,
          membership_id: membershipId,
          message: 'Alumno y membresía creados, pero asignación de programa falló',
          program_error: 'Template no encontrado'
        };
      }

      const programData = {
        gym_id: gymId,
        student_id: studentId,
        template_id: program.template_id,
        rm_values: program.rm_values || {},
        started_at: new Date().toISOString().split('T')[0],
        status: 'activo'
      };

      const { data: programResult, error: programError } = await supabase
        .from('student_programs')
        .insert(programData)
        .select('id')
        .single();

      if (programError) {
        await logAudit({
          id: uuidv4(),
          request_id: requestId,
          gym_id: gymId,
          student_id: studentId,
          step: 'program_assign_failed',
          status: 'error',
          error_code: 'PROGRAM_CREATE_ERROR',
          error_message: programError.message
        });

        return {
          success: true,
          partial: true,
          student_id: studentId,
          membership_id: membershipId,
          message: 'Alumno y membresía creados, pero asignación de programa falló',
          program_error: programError.message
        };
      }

      programId = programResult.id;

      await supabase.from('students').update({ routine_id: programId }).eq('id', studentId);

      await logAudit({
        id: uuidv4(),
        request_id: requestId,
        gym_id: gymId,
        student_id: studentId,
        program_id: programId,
        step: 'program_assigned',
        status: 'success'
      });
    }

    await logAudit({
      id: auditId,
      request_id: requestId,
      gym_id: gymId,
      student_id: studentId,
      membership_id: membershipId,
      program_id: programId,
      step: 'completed',
      status: 'success',
      completed_at: new Date().toISOString(),
      duration_ms: new Date() - new Date(startTime)
    });

    return {
      success: true,
      student_id: studentId,
      membership_id: membershipId,
      program_id: programId,
      message: 'Onboarding completado exitosamente'
    };
  } catch (error) {
    await logAudit({
      id: auditId,
      request_id: requestId,
      gym_id: gymId,
      student_id: studentId,
      step: 'failed',
      status: 'error',
      error_code: error.code || 'UNKNOWN_ERROR',
      error_message: error.message,
      recoverable: error.recoverable !== false
    });

    if (studentId && !error.recoverable) {
      await supabase.from('students').delete().eq('id', studentId);
    }

    throw {
      code: error.code || 'ONBOARDING_ERROR',
      message: error.message,
      recoverable: error.recoverable !== false
    };
  }
}

function calculateEndDate(startDate, plan) {
  const start = new Date(startDate);
  let end;

  switch (plan) {
    case 'mensual':
      end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      break;
    case 'trimestral':
      end = new Date(start);
      end.setMonth(end.getMonth() + 3);
      break;
    case 'anual':
      end = new Date(start);
      end.setFullYear(end.getFullYear() + 1);
      break;
    default:
      end = new Date(start);
      end.setMonth(end.getMonth() + 1);
  }

  return end.toISOString().split('T')[0];
}

async function logAudit(entry) {
  try {
    await supabase.from('onboarding_audit').insert(entry);
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
