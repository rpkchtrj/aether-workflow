import fs from 'node:fs';
import path from 'node:path';

import { resolvePaths, tildify } from './paths.js';
import { listSkills } from './skills.js';

/**
 * Check that every packaged skill landed on disk with the host frontmatter the
 * installer is supposed to inject, and that the shared files exist.
 */
export function verify({ env = process.env, log = console.log } = {}) {
  const p = resolvePaths(env);
  const expected = listSkills(p.skillsSource);
  const problems = [];

  for (const name of expected) {
    const file = path.join(p.skillsHome, name, 'SKILL.md');
    if (!fs.existsSync(file)) {
      problems.push(`MISSING: ${tildify(file, p.home)}`);
      continue;
    }
    const text = fs.readFileSync(file, 'utf8');
    if (!/^model:/m.test(text)) problems.push(`NO MODEL: ${tildify(file, p.home)}`);
    if (!/^disable-model-invocation: true$/m.test(text)) {
      problems.push(`NO INVOCATION GATE: ${tildify(file, p.home)}`);
    }
  }

  if (!fs.existsSync(p.contractDest)) problems.push(`MISSING global contract: ${tildify(p.contractDest, p.home)}`);
  if (!fs.existsSync(p.modelsDest)) problems.push(`MISSING model mapping: ${tildify(p.modelsDest, p.home)}`);

  if (fs.existsSync(p.globalClaudeMd)) {
    const global = fs.readFileSync(p.globalClaudeMd, 'utf8');
    if (!global.includes(`@${p.contractDest}`)) {
      problems.push(`Contract not imported from ${tildify(p.globalClaudeMd, p.home)}`);
    }
  } else {
    problems.push(`MISSING: ${tildify(p.globalClaudeMd, p.home)}`);
  }

  for (const problem of problems) log(problem);
  if (problems.length === 0) log(`Workflow installation looks healthy (${expected.length} skills).`);

  return { ok: problems.length === 0, problems, expected };
}
