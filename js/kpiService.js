// KPI Service - Centralized business logic for metrics
// Used by dashboard and listings - single source of truth

const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

function parseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function businessDate(timezone = DEFAULT_TIMEZONE) {
  const now = new Date();
  const opts = { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('en-CA', opts);
  const parts = formatter.formatToParts(now);
  const o = {};
  parts.forEach((p) => {
    if (p.type !== 'literal') o[p.type] = parseInt(p.value, 10);
  });
  return new Date(o.year, o.month - 1, o.day);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export const KPI_DEFINITIONS = {
  ACTIVA: {
    status: 'activa',
    description: 'Alumnos con membresía vigente'
  },
  POR_VENCER: {
    status: 'por_vencer',
    daysUntilExpiry: 7,
    description: 'Alumnos cuya membresía vence en los próximos 7 días'
  },
  VENCIDA: {
    status: 'vencida',
    description: 'Alumnos cuya membresía ya venció'
  },
  PENDIENTE: {
    status: 'pendiente',
    description: 'Alumnos sin membresía activa (alta reciente)'
  }
};

export async function fetchKPIs(supabase, gymId, options = {}) {
  const { timezone = 'America/Argentina/Buenos_Aires' } = options;
  const today = businessDate(timezone);
  const porVencerThreshold = addDays(today, 7);

  const [
    { count: total },
    { count: activas },
    { count: pendientes },
    { count: vencidas },
    { data: memberships }
  ] = await Promise.all([
    supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('gym_id', gymId)
      .is('deleted_at', null),
    supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('gym_id', gymId)
      .eq('membership_status', 'activa')
      .is('deleted_at', null),
    supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('gym_id', gymId)
      .eq('membership_status', 'pendiente')
      .is('deleted_at', null),
    supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('gym_id', gymId)
      .eq('membership_status', 'vencida')
      .is('deleted_at', null),
    supabase.from('memberships').select('id, student_id, end_date').eq('gym_id', gymId)
  ]);

  const porVencer = (memberships || []).filter((m) => {
    const endDate = parseDate(m.end_date);
    return endDate >= today && endDate <= porVencerThreshold;
  }).length;

  return {
    total,
    activas,
    pendientes,
    vencidas,
    porVencer,
    percentages: {
      activas: total > 0 ? Math.round((activas / total) * 100) : 0,
      pendientes: total > 0 ? Math.round((pendientes / total) * 100) : 0,
      vencidas: total > 0 ? Math.round((vencidas / total) * 100) : 0,
      porVencer: total > 0 ? Math.round((porVencer / total) * 100) : 0
    }
  };
}

export function calculateMembershipStatus(endDate, options = {}) {
  const { timezone = 'America/Argentina/Buenos_Aires' } = options;
  const today = businessDate(timezone);
  const end = parseDate(endDate);

  if (!end || isNaN(end.getTime())) {
    return 'pendiente';
  }

  if (end < today) {
    return 'vencida';
  }

  const daysUntil = diffDays(end, today);
  if (daysUntil <= 7) {
    return 'por_vencer';
  }

  return 'activa';
}

function diffDays(date1, date2) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.ceil((date1 - date2) / oneDay);
}

export const kpiService = {
  definitions: KPI_DEFINITIONS,
  fetch: fetchKPIs,
  calculateStatus: calculateMembershipStatus
};

export default kpiService;
