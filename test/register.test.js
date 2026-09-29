import assert from 'node:assert/strict';
import test from 'node:test';

import { registerClaudePlugin, unregisterClaudePlugin } from '../lib/register.js';

const host = { prefix: 'aether-wfl', target: '/tmp/aether-wfl-target' };

/** A `run` that throws what the real CLI writes to stderr for `situation`. */
function failsWith(stderr, code) {
  return () => {
    const error = new Error('Command failed');
    error.stderr = stderr;
    if (code) error.code = code;
    throw error;
  };
}

test('unregister reports success when the marketplace was removed', () => {
  const result = unregisterClaudePlugin(host, { run: () => '' });
  assert.deepEqual(result, { unregistered: true });
});

test('unregister treats a missing marketplace as the desired end state', () => {
  const result = unregisterClaudePlugin(host, {
    run: failsWith("✘ Failed to remove marketplace: Marketplace 'aether-wfl' not found"),
  });
  assert.equal(result.unregistered, true);
  assert.equal(result.alreadyAbsent, true);
  assert.equal(result.reason, undefined);
});

test('unregister still reports a real failure', () => {
  const result = unregisterClaudePlugin(host, {
    run: failsWith('✘ Failed to remove marketplace: EACCES: permission denied'),
  });
  assert.equal(result.unregistered, false);
  assert.match(result.reason, /permission denied/);
});

test('unregister reports a missing CLI rather than claiming removal', () => {
  const result = unregisterClaudePlugin(host, { run: failsWith('', 'ENOENT') });
  assert.equal(result.unregistered, false);
  assert.equal(result.alreadyAbsent, undefined);
  assert.match(result.reason, /not found on PATH/);
});

test('register treats an already-added marketplace as idempotent', () => {
  const result = registerClaudePlugin(host, {
    log: () => {},
    run: failsWith('Marketplace already exists'),
  });
  assert.equal(result.registered, true);
});
