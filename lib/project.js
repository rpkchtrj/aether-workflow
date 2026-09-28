import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { resolvePaths } from './paths.js';

// Project-level only. Per-change directories (requirements, decisions, ...)
// are created under changes/<change-id>/ when a change is started, because a
// developer keeps several changes open at once and state belongs to a change.
const STATE_DIRS = ['changes', 'incidents'];

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

/** Absolute path to the enclosing Git repository root, or null outside one. */
export function repoRoot(cwd = process.cwd()) {
  return git(['rev-parse', '--show-toplevel'], cwd) || null;
}

/**
 * Stable identifier for a project's private state directory.
 * Keyed on the origin remote when there is one so the same repo cloned twice
 * shares state; falls back to the local path otherwise.
 */
export function projectId(cwd = process.cwd()) {
  const root = repoRoot(cwd);
  if (!root) throw new Error('Not inside a Git repository');
  const key = git(['config', '--get', 'remote.origin.url'], root) || root;
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 24);
}

/** Create (or top up) the private state directory for the current repository. */
export function initProject({ env = process.env, cwd = process.cwd(), log = console.log } = {}) {
  const p = resolvePaths(env);
  const root = repoRoot(cwd);
  if (!root) throw new Error('Run inside a Git repository');

  const id = projectId(cwd);
  const dest = path.join(p.projectsHome, id);
  for (const dir of STATE_DIRS) fs.mkdirSync(path.join(dest, dir), { recursive: true });

  // Prefer the installed mirror, but fall back to the running package so this
  // works straight from `npx` before an install has ever run.
  const templateRoots = [path.join(p.repoCopy, 'templates'), p.templatesSource];
  for (const name of ['CHANGES.md', 'WORK_LOG.md']) {
    const target = path.join(dest, name);
    if (fs.existsSync(target)) continue;
    const source = templateRoots.map((r) => path.join(r, name)).find((f) => fs.existsSync(f));
    if (source) fs.copyFileSync(source, target);
  }

  const created = new Date().toISOString().replace('T', ' ').slice(0, 19);
  fs.writeFileSync(
    path.join(dest, 'PROJECT.md'),
    [
      '# Private Project Workflow State',
      '',
      `Project ID: ${id}`,
      `Repository root: ${root}`,
      `Created: ${created}`,
      '',
      'This directory is private workflow state. It is not part of the repository.',
      '',
    ].join('\n'),
  );

  log(dest);
  return dest;
}
