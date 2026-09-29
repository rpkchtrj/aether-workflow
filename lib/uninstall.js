import fs from 'node:fs';
import path from 'node:path';

import { resolvePaths, tildify } from './paths.js';
import { listSkills } from './skills.js';
import { loadHost } from './hosts.js';
import { ownedSkillDirs } from './emit.js';
import { readInstallRecord } from './verify.js';
import { unregisterClaudePlugin } from './register.js';

const IMPORT_HEADING = '# Personal AI-Assisted Engineering Workflow';

/**
 * Strip the workflow's import block from the global CLAUDE.md, leaving any
 * other user content intact. Matches the heading plus its `@<contract>` line.
 */
export function stripImportBlock(text, contractPath) {
  const out = [];
  const lines = text.split(/\r?\n/);
  let skipping = false;

  for (const line of lines) {
    if (line.trim() === IMPORT_HEADING) {
      skipping = true;
      continue;
    }
    if (skipping) {
      if (line.trim() === `@${contractPath}` || line.trim() === '') continue;
      skipping = false;
    }
    out.push(line);
  }

  return `${out.join('\n').replace(/\s+$/, '')}\n`;
}

export function uninstall({ env = process.env, purgeState = false, log = console.log } = {}) {
  const p = resolvePaths(env);
  const record = readInstallRecord(p);

  // Prefer the installed mirror's skill list so skills removed from a newer
  // package version still get cleaned up from a machine running the old one.
  const mirrored = listSkills(path.join(p.repoCopy, 'skills'));
  const names = mirrored.length > 0 ? mirrored : listSkills(p.skillsSource);

  let removed = 0;

  // Whatever the last install emitted, on the host it emitted to.
  if (record?.host) {
    try {
      const host = loadHost(record.host, { paths: p, targetOverride: record.target });
      for (const dir of ownedSkillDirs(host)) {
        fs.rmSync(dir, { recursive: true, force: true });
        removed += 1;
      }
      if (host.register === 'claude-cli') {
        const result = unregisterClaudePlugin(host);
        if (result.alreadyAbsent) {
          log(`No plugin registration for ${host.prefix} to remove.`);
        } else if (result.unregistered) {
          log(`Unregistered plugin ${host.prefix}@${host.prefix}.`);
        } else {
          log(`Could not unregister ${host.prefix}: ${result.reason}`);
        }
      }
      fs.rmSync(path.join(host.target, '.claude-plugin'), { recursive: true, force: true });
    } catch (error) {
      log(`Could not clean the recorded host (${record.host}): ${error.message}`);
    }
  }

  // Plus the pre-namespacing layout, which predates the install record.
  for (const name of names) {
    const dir = path.join(p.skillsHome, name);
    if (!fs.existsSync(dir)) continue;
    fs.rmSync(dir, { recursive: true, force: true });
    removed += 1;
  }

  if (fs.existsSync(p.globalClaudeMd)) {
    const current = fs.readFileSync(p.globalClaudeMd, 'utf8');
    const next = stripImportBlock(current, p.contractDest);
    if (next !== current) fs.writeFileSync(p.globalClaudeMd, next);
  }

  for (const dir of [p.binHome, path.join(p.workflowHome, 'hosts'), p.repoCopy]) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.rmSync(p.installRecord, { force: true });
  fs.rmSync(path.join(p.workflowHome, 'plugin'), { recursive: true, force: true });

  if (purgeState) {
    fs.rmSync(p.projectsHome, { recursive: true, force: true });
    fs.rmSync(p.workflowHome, { recursive: true, force: true });
    log(`Removed private project state under ${tildify(p.workflowHome, p.home)}.`);
  } else {
    log(`Private project state preserved under ${tildify(p.projectsHome, p.home)}.`);
    log('Re-run with --purge-state to delete it.');
  }

  log(`Removed ${removed} skills. Workflow uninstalled.`);
  return { removed, purgeState };
}
