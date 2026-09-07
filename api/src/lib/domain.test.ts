import assert from 'node:assert/strict';
import test from 'node:test';
import { isBusinessMediaPath, isUniqueViolation, machineHeaders, resolveState, retentionCutoff, takeoverState } from './domain.js';
import { secretsMatch } from '../middleware/api-auth.js';

test('authentication and tenant isolation reject wrong credentials and paths', () => {
  assert.equal(secretsMatch('same-secret', 'same-secret'), true);
  assert.equal(secretsMatch('wrong-secret', 'same-secret'), false);
  assert.equal(secretsMatch(undefined, 'same-secret'), false);
  assert.equal(isBusinessMediaPath('business-a/2026-09-07/file.pdf', 'business-a'), true);
  assert.equal(isBusinessMediaPath('business-b/2026-09-07/file.pdf', 'business-a'), false);
});

test('ingestion treats only the database unique violation as idempotent', () => {
  assert.equal(isUniqueViolation({ code: '23505' }), true);
  assert.equal(isUniqueViolation({ code: '42501' }), false);
  assert.equal(isUniqueViolation(null), false);
});

test('takeover disables AI and resolve reactivates it', () => {
  assert.deepEqual(takeoverState('agent-1'), {
    ai_active: false,
    human_active: true,
    unread_count: 0,
    assigned_agent_id: 'agent-1',
  });
  assert.deepEqual(resolveState(), {
    ai_active: true,
    human_active: false,
    assigned_agent_id: null,
    status: 'resolved',
  });
});

test('outbound machine call carries its private authentication header', () => {
  assert.deepEqual(machineHeaders('n8n-secret'), {
    'Content-Type': 'application/json',
    'X-Machine-Secret': 'n8n-secret',
  });
});

test('retention cutoff is exactly 30 days', () => {
  assert.equal(retentionCutoff(new Date('2026-09-07T12:00:00.000Z')), '2026-08-08T12:00:00.000Z');
});
