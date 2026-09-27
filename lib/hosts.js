import fs from 'node:fs';
import path from 'node:path';

import { packageRoot } from './paths.js';

/**
 * How a host names skills.
 * `plugin`   - the host derives a namespace itself (Claude Code uses the plugin
 *              manifest name), so emitted skill names stay canonical.
 * `name-prefix` - the host has a flat skill namespace, so the prefix is baked
 *              into the emitted directory and the frontmatter `name`.
 */
export const NAMESPACES = new Set(['plugin', 'name-prefix']);

const REQUIRED = ['name', 'namespace', 'prefix', 'target', 'frontmatter_keys'];

/** Parse a host.yaml. Flat `key: value` only - the adapters are deliberately data, not code. */
export function parseHostFile(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const match = line.match(/^([a-z0-9_]+):\s*(.*)$/);
    if (match) out[match[1]] = match[2].trim();
  }
  return out;
}

/** Expand the placeholders a host.yaml `target` may use. */
export function resolveTarget(target, { home, claudeHome, workflowHome, targetOverride }) {
  if (target === '${TARGET}') {
    if (!targetOverride) {
      throw new Error('This host needs an explicit directory. Pass --target <dir>.');
    }
    return path.resolve(targetOverride);
  }
  const expanded = target
    .replace('${CLAUDE_HOME}', claudeHome)
    .replace('${WORKFLOW_HOME}', workflowHome)
    .replace(/^~(?=\/|$)/, home);
  return path.resolve(expanded);
}

/** Every host adapter shipped in the package. */
export function listHosts(hostsSource = path.join(packageRoot, 'hosts')) {
  if (!fs.existsSync(hostsSource)) return [];
  return fs
    .readdirSync(hostsSource, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(hostsSource, name, 'host.yaml')))
    .sort();
}

/**
 * Load one adapter and resolve it against the current machine.
 * Validation is strict: a malformed adapter should fail before anything is
 * written, not emit a half-correct skill tree.
 */
export function loadHost(name, { paths, targetOverride = null, hostsSource } = {}) {
  const root = hostsSource ?? path.join(packageRoot, 'hosts');
  const file = path.join(root, name, 'host.yaml');
  if (!fs.existsSync(file)) {
    throw new Error(`Unknown host "${name}". Available: ${listHosts(root).join(', ')}`);
  }

  const raw = parseHostFile(fs.readFileSync(file, 'utf8'));
  for (const key of REQUIRED) {
    if (!raw[key]) throw new Error(`Host "${name}" is missing required key "${key}" in ${file}`);
  }
  if (!NAMESPACES.has(raw.namespace)) {
    throw new Error(
      `Host "${name}" declares namespace "${raw.namespace}"; expected one of ${[...NAMESPACES].join(', ')}`,
    );
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(raw.prefix)) {
    throw new Error(`Host "${name}" has an unusable prefix "${raw.prefix}"`);
  }

  // A plugin host needs a nested skills path: the plugin directory is the level
  // above `skills/`, and both manifests are written relative to it.
  if (raw.namespace === 'plugin') {
    const segments = (raw.skills_subdir ?? '').split('/').filter(Boolean);
    if (segments.length < 2 || segments.at(-1) !== 'skills') {
      throw new Error(
        `Host "${name}" uses namespace "plugin" so skills_subdir must look like "plugins/<plugin>/skills"`,
      );
    }
  }

  const frontmatterKeys = raw.frontmatter_keys
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
  if (!frontmatterKeys.includes('name')) {
    throw new Error(`Host "${name}" must emit a "name" frontmatter key`);
  }

  return {
    name: raw.name,
    description: raw.description ?? '',
    namespace: raw.namespace,
    prefix: raw.prefix,
    frontmatterKeys,
    invocation: raw.invocation ?? '',
    skillsSubdir: raw.skills_subdir ?? '',
    modelMap: raw.model_map ?? null,
    register: raw.register ?? null,
    target: resolveTarget(raw.target, { ...paths, targetOverride }),
  };
}
