import fs from 'node:fs';
import path from 'node:path';

import { resolvePaths, tildify } from './paths.js';
import { listSkills } from './skills.js';
import { loadHost } from './hosts.js';
import { emittedName } from './emit.js';
import { DEFAULT_HOST } from './install.js';

/** Read the record written by the last install, if there is one. */
export function readInstallRecord({ installRecord }) {
  if (!fs.existsSync(installRecord)) return null;
  try {
    return JSON.parse(fs.readFileSync(installRecord, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Check that every packaged skill landed on disk under the name the recorded
 * host publishes it as, with that host's frontmatter, and that shared files exist.
 */
export function verify({ env = process.env, host: hostName = null, log = console.log } = {}) {
  const p = resolvePaths(env);
  const record = readInstallRecord(p);
  const host = loadHost(hostName ?? record?.host ?? DEFAULT_HOST, {
    paths: p,
    targetOverride: record?.target ?? null,
  });
  const skillsRoot = record?.target
    ? path.join(record.target, record.skillsSubdir ?? '')
    : path.join(host.target, host.skillsSubdir);

  const expected = listSkills(p.skillsSource);
  const problems = [];

  for (const name of expected) {
    const published = emittedName(name, host);
    const file = path.join(skillsRoot, published, 'SKILL.md');
    if (!fs.existsSync(file)) {
      problems.push(`MISSING: ${tildify(file, p.home)}`);
      continue;
    }
    const text = fs.readFileSync(file, 'utf8');

    // The frontmatter name must match the directory or the host won't load it.
    if (!new RegExp(`^name: ${published}$`, 'm').test(text)) {
      problems.push(`NAME MISMATCH: ${tildify(file, p.home)} should declare "name: ${published}"`);
    }
    // Only assert keys this host is supposed to emit.
    if (host.frontmatterKeys.includes('model') && !/^model:/m.test(text)) {
      problems.push(`NO MODEL: ${tildify(file, p.home)}`);
    }
    if (host.frontmatterKeys.includes('disable-model-invocation') && !/^disable-model-invocation: true$/m.test(text)) {
      problems.push(`NO INVOCATION GATE: ${tildify(file, p.home)}`);
    }
    // A key the host never declared must not leak through.
    for (const key of ['model', 'disable-model-invocation']) {
      if (!host.frontmatterKeys.includes(key) && new RegExp(`^${key}:`, 'm').test(text)) {
        problems.push(`UNSUPPORTED KEY "${key}" for host ${host.name}: ${tildify(file, p.home)}`);
      }
    }
  }

  // The pre-namespacing layout and the current one must never coexist.
  for (const name of expected) {
    const legacy = path.join(p.skillsHome, name, 'SKILL.md');
    if (emittedName(name, host) !== name && fs.existsSync(legacy)) {
      problems.push(`LEGACY DUPLICATE: ${tildify(legacy, p.home)}`);
    }
  }

  if (host.namespace === 'plugin') {
    const manifest = path.join(host.target, ...host.skillsSubdir.split('/').slice(0, -1), '.claude-plugin', 'plugin.json');
    if (!fs.existsSync(manifest)) problems.push(`MISSING plugin manifest: ${tildify(manifest, p.home)}`);
    else if (JSON.parse(fs.readFileSync(manifest, 'utf8')).name !== host.prefix) {
      problems.push(`Plugin manifest name must be "${host.prefix}" or the namespace prefix changes`);
    }
  }

  if (!fs.existsSync(p.contractDest)) problems.push(`MISSING global contract: ${tildify(p.contractDest, p.home)}`);
  if (host.modelMap && !fs.existsSync(p.modelsDest)) {
    problems.push(`MISSING model mapping: ${tildify(p.modelsDest, p.home)}`);
  }

  if (fs.existsSync(p.globalClaudeMd)) {
    const global = fs.readFileSync(p.globalClaudeMd, 'utf8');
    if (!global.includes(`@${p.contractDest}`)) {
      problems.push(`Contract not imported from ${tildify(p.globalClaudeMd, p.home)}`);
    }
  } else {
    problems.push(`MISSING: ${tildify(p.globalClaudeMd, p.home)}`);
  }

  for (const problem of problems) log(problem);
  if (problems.length === 0) {
    log(`Workflow installation looks healthy (${expected.length} skills, host ${host.name}).`);
    log(`Invoke with ${host.invocation}`);
  }

  return { ok: problems.length === 0, problems, expected, host };
}
