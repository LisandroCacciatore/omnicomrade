// Onboarding Funnel Instrumentation Service
// Tracks student_created, membership_started, program_assigned, onboarding_abandoned

const ONBOARDING_EVENTS = {
  STUDENT_CREATED: 'student_created',
  MEMBERSHIP_STARTED: 'membership_started',
  PROGRAM_ASSIGNED: 'program_assigned',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  ONBOARDING_ABANDONED: 'onboarding_abandoned'
};

export function trackStudentCreated(gymId, actorId, studentData = {}) {
  const event = {
    event: ONBOARDING_EVENTS.STUDENT_CREATED,
    gym_id: gymId,
    actor_id: actorId,
    student_id: studentData.student_id,
    student_name: studentData.full_name,
    step: 1
  };
  return window.tfInstrumentation?.track(ONBOARDING_EVENTS.STUDENT_CREATED, event) || event;
}

export function trackMembershipStarted(gymId, actorId, studentId, membershipData = {}) {
  const event = {
    event: ONBOARDING_EVENTS.MEMBERSHIP_STARTED,
    gym_id: gymId,
    actor_id: actorId,
    student_id: studentId,
    membership_id: membershipData.membership_id,
    plan: membershipData.plan,
    step: 2
  };
  return window.tfInstrumentation?.track(ONBOARDING_EVENTS.MEMBERSHIP_STARTED, event) || event;
}

export function trackProgramAssigned(gymId, actorId, studentId, programData = {}) {
  const event = {
    event: ONBOARDING_EVENTS.PROGRAM_ASSIGNED,
    gym_id: gymId,
    actor_id: actorId,
    student_id: studentId,
    program_id: programData.program_id,
    template_id: programData.template_id,
    step: 3
  };
  return window.tfInstrumentation?.track(ONBOARDING_EVENTS.PROGRAM_ASSIGNED, event) || event;
}

export function trackOnboardingCompleted(gymId, actorId, studentId, context = {}) {
  const event = {
    event: ONBOARDING_EVENTS.ONBOARDING_COMPLETED,
    gym_id: gymId,
    actor_id: actorId,
    student_id: studentId,
    has_membership: context.hasMembership,
    has_program: context.hasProgram,
    total_steps: 3
  };
  return window.tfInstrumentation?.track(ONBOARDING_EVENTS.ONBOARDING_COMPLETED, event) || event;
}

export function trackOnboardingAbandoned(gymId, actorId, step, studentId = null) {
  const event = {
    event: ONBOARDING_EVENTS.ONBOARDING_ABANDONED,
    gym_id: gymId,
    actor_id: actorId,
    student_id: studentId,
    abandoned_at_step: step,
    timestamp: new Date().toISOString()
  };
  return window.tfInstrumentation?.track(ONBOARDING_EVENTS.ONBOARDING_ABANDONED, event) || event;
}

export function calculateFunnelConversion(events) {
  const counts = {
    student_created: 0,
    membership_started: 0,
    program_assigned: 0,
    completed: 0
  };

  events.forEach((e) => {
    if (e.name === ONBOARDING_EVENTS.STUDENT_CREATED) counts.student_created++;
    if (e.name === ONBOARDING_EVENTS.MEMBERSHIP_STARTED) counts.membership_started++;
    if (e.name === ONBOARDING_EVENTS.PROGRAM_ASSIGNED) counts.program_assigned++;
    if (e.name === ONBOARDING_EVENTS.ONBOARDING_COMPLETED) counts.completed++;
  });

  const conversions = {
    student_to_membership:
      counts.student_created > 0
        ? Math.round((counts.membership_started / counts.student_created) * 100)
        : 0,
    membership_to_program:
      counts.membership_started > 0
        ? Math.round((counts.program_assigned / counts.membership_started) * 100)
        : 0,
    overall_completion:
      counts.student_created > 0 ? Math.round((counts.completed / counts.student_created) * 100) : 0
  };

  return { counts, conversions };
}

export const onboardingFunnel = {
  events: ONBOARDING_EVENTS,
  trackStudentCreated,
  trackMembershipStarted,
  trackProgramAssigned,
  trackOnboardingCompleted,
  trackOnboardingAbandoned,
  calculateConversion: calculateFunnelConversion
};

export default onboardingFunnel;
