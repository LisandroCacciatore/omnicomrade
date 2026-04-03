import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isFunnelFull, isRoleAllowed, isInviteApproved } from '../../server/services/accessPolicy.js';

describe('access funnel helpers', () => {
  it('isFunnelFull marks full when count reaches cap', () => {
    assert.equal(isFunnelFull(15, 15), true);
    assert.equal(isFunnelFull(16, 15), true);
    assert.equal(isFunnelFull(14, 15), false);
  });

  it('isRoleAllowed validates whitelist', () => {
    assert.equal(isRoleAllowed('alumno'), true);
    assert.equal(isRoleAllowed('profesor'), true);
    assert.equal(isRoleAllowed('gim_admin'), true);
    assert.equal(isRoleAllowed('owner'), false);
  });

  it('isInviteApproved accepts only approved invite rows', () => {
    assert.equal(isInviteApproved({ status: 'approved' }), true);
    assert.equal(isInviteApproved({ status: 'pending' }), false);
    assert.equal(isInviteApproved(null), false);
  });
});
