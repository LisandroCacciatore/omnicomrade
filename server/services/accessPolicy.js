export const MAX_EARLY_ADOPTERS = 15;
export const ALLOWED_ROLES = ['alumno', 'profesor', 'gim_admin'];

export function isFunnelFull(total, cap = MAX_EARLY_ADOPTERS) {
  return (total || 0) >= cap;
}

export function isRoleAllowed(role) {
  return ALLOWED_ROLES.includes(role);
}

export function isInviteApproved(invite) {
  return Boolean(invite && invite.status === 'approved');
}
