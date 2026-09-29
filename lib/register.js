import { execFileSync } from 'node:child_process';

/**
 * Register the generated marketplace with the Claude Code CLI.
 * The CLI owns `settings.json`; this never edits that file directly. A missing
 * CLI is a reportable condition, not a crash - the caller falls back to a
 * flat install.
 */
export function registerClaudePlugin(host, { log = console.log, run = defaultRun } = {}) {
  const id = `${host.prefix}@${host.prefix}`;
  try {
    run('claude', ['plugin', 'marketplace', 'add', host.target]);
  } catch (error) {
    if (isMissingCli(error)) return { registered: false, reason: 'claude CLI not found on PATH' };
    // An already-registered marketplace is the idempotent case, not a failure.
    if (!/already/i.test(message(error))) {
      return { registered: false, reason: `marketplace add failed: ${message(error)}` };
    }
  }

  try {
    run('claude', ['plugin', 'install', id]);
  } catch (error) {
    if (isMissingCli(error)) return { registered: false, reason: 'claude CLI not found on PATH' };
    if (!/already/i.test(message(error))) {
      return { registered: false, reason: `plugin install failed: ${message(error)}` };
    }
  }

  log(`  registered           : ${id}`);
  return { registered: true, id };
}

/** Unregister, tolerating a marketplace that was never added. */
export function unregisterClaudePlugin(host, { run = defaultRun } = {}) {
  try {
    run('claude', ['plugin', 'marketplace', 'remove', host.prefix]);
    return { unregistered: true };
  } catch (error) {
    if (isMissingCli(error)) return { unregistered: false, reason: 'claude CLI not found on PATH' };
    // Nothing registered is the end state uninstall wants, so it is not a
    // failure - the mirror of install treating an already-added marketplace as
    // idempotent. Reporting it as an error trains the reader to skim past the
    // line that would carry a real one.
    if (/not found|not registered|no such/i.test(message(error))) {
      return { unregistered: true, alreadyAbsent: true };
    }
    return { unregistered: false, reason: message(error) };
  }
}

function defaultRun(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function isMissingCli(error) {
  return error?.code === 'ENOENT';
}

function message(error) {
  return (error?.stderr || error?.stdout || error?.message || '').toString().trim().split('\n')[0];
}
