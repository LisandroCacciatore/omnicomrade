const MEMBERSHIP_STATES = {
  PENDIENTE: 'pendiente',
  ACTIVA: 'activa',
  POR_VENCER: 'por_vencer',
  VENCIDA: 'vencida',
  SUSPENDIDA: 'suspendida'
};

const VALID_TRANSITIONS = {
  [MEMBERSHIP_STATES.PENDIENTE]: [MEMBERSHIP_STATES.ACTIVA, MEMBERSHIP_STATES.SUSPENDIDA],
  [MEMBERSHIP_STATES.ACTIVA]: [
    MEMBERSHIP_STATES.POR_VENCER,
    MEMBERSHIP_STATES.VENCIDA,
    MEMBERSHIP_STATES.SUSPENDIDA
  ],
  [MEMBERSHIP_STATES.POR_VENCER]: [
    MEMBERSHIP_STATES.ACTIVA,
    MEMBERSHIP_STATES.VENCIDA,
    MEMBERSHIP_STATES.SUSPENDIDA
  ],
  [MEMBERSHIP_STATES.VENCIDA]: [MEMBERSHIP_STATES.ACTIVA, MEMBERSHIP_STATES.SUSPENDIDA],
  [MEMBERSHIP_STATES.SUSPENDIDA]: [MEMBERSHIP_STATES.ACTIVA, MEMBERSHIP_STATES.PENDIENTE]
};

export function isValidTransition(fromState, toState) {
  const allowedTransitions = VALID_TRANSITIONS[fromState];
  if (!allowedTransitions) {
    return {
      valid: false,
      error: `Estado origen inválido: ${fromState}`
    };
  }

  if (!allowedTransitions.includes(toState)) {
    return {
      valid: false,
      error: `Transición no permitida: ${fromState} → ${toState}`
    };
  }

  return { valid: true };
}

export function canTransitionTo(fromState, toState) {
  return isValidTransition(fromState, toState).valid;
}

export function getAllowedTransitions(currentState) {
  return VALID_TRANSITIONS[currentState] || [];
}

export function calculateState(membership) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (membership.status === 'suspendida') {
    return MEMBERSHIP_STATES.SUSPENDIDA;
  }

  if (!membership.end_date) {
    return MEMBERSHIP_STATES.PENDIENTE;
  }

  const endDate = new Date(membership.end_date);
  endDate.setHours(0, 0, 0, 0);

  if (endDate < today) {
    return MEMBERSHIP_STATES.VENCIDA;
  }

  const daysUntilExpiry = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry <= 7) {
    return MEMBERSHIP_STATES.POR_VENCER;
  }

  return MEMBERSHIP_STATES.ACTIVA;
}

export const membershipStateMachine = {
  STATES: MEMBERSHIP_STATES,
  TRANSITIONS: VALID_TRANSITIONS,
  isValidTransition,
  canTransitionTo,
  getAllowedTransitions,
  calculateState
};

export default membershipStateMachine;
