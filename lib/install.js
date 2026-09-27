import fs from 'node:fs';
import path from 'node:path';

import { resolvePaths, packageRoot, tildify } from './paths.js';
import {
  listSkills,
  parseModels,
  modelForProfile,
  readModelProfile,
  splitFrontmatter,
  applyHostFrontmatter,
} from './skills.js';

const IMPORT_HEADING = '# Personal AI-Assisted Engineering Workflow';

/** Files and directories copied into the workflow home as the local payload mirror. */
const PAYLOAD = [
  'skills',
  'templates',
  'hosts',
  'scripts',
  'GLOBAL_ENGINEERING_CONTRACT.md',
  'MODEL_PROFILES.md',
  'HOST_INTEGRATION_GUIDE.md',
  'SKILLS.md',
  'STATE_LAYOUT.md',
  'WORKFLOW.md',
  'INSTALL.md',
  'CHANGELOG.md',
  'VERSION',
];

function timestamp() {
  const pad = (n) => String(n).padStart(2, '0');
  const d = new Date();
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function copyPayload(root, dest) {
  for (const entry of PAYLOAD) {
    const from = path.join(root, entry);
    if (!fs.existsSync(from)) continue;
    fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}

/**
 * Add the contract import to the user's global CLAUDE.md, backing up first.
 * Idempotent: a CLAUDE.md that already carries the heading is left alone.
 */
function linkGlobalContract({ globalClaudeMd, contractDest }) {
  const existed = fs.existsSync(globalClaudeMd);
  let backup = null;

  if (existed) {
    const current = fs.readFileSync(globalClaudeMd, 'utf8');
    if (current.includes(IMPORT_HEADING)) return { linked: false, backup: null };
    backup = `${globalClaudeMd}.bak.${timestamp()}`;
    fs.copyFileSync(globalClaudeMd, backup);
  } else {
    fs.mkdirSync(path.dirname(globalClaudeMd), { recursive: true });
    fs.writeFileSync(globalClaudeMd, '');
  }

  fs.appendFileSync(globalClaudeMd, `\n${IMPORT_HEADING}\n@${contractDest}\n`);
  return { linked: true, backup };
}

/**
 * Install skills, the global contract and the private state scaffold.
 * `dryRun` resolves and reports every target without writing anything.
 */
export function install({ env = process.env, dryRun = false, log = console.log } = {}) {
  const p = resolvePaths(env);
  const skills = listSkills(p.skillsSource);

  if (skills.length === 0) {
    throw new Error(`No skills found under ${p.skillsSource}. The package payload looks incomplete.`);
  }
  if (!fs.existsSync(p.modelsSource)) {
    throw new Error(`Missing model mapping at ${p.modelsSource}.`);
  }

  const models = parseModels(fs.readFileSync(p.modelsSource, 'utf8'));

  const plan = skills.map((name) => {
    const source = path.join(p.skillsSource, name, 'SKILL.md');
    const profile = readModelProfile(splitFrontmatter(fs.readFileSync(source, 'utf8')).frontmatter);
    return { name, source, profile, model: modelForProfile(profile, models) };
  });

  log(`aether-workflow installer`);
  log(`  skills        -> ${tildify(p.skillsHome, p.home)}`);
  log(`  contract      -> ${tildify(p.contractDest, p.home)}`);
  log(`  private state -> ${tildify(p.workflowHome, p.home)}`);
  log(`  global import -> ${tildify(p.globalClaudeMd, p.home)} (backed up before edit)`);
  log('');

  if (dryRun) {
    log(`Dry run. ${plan.length} skills would be installed:`);
    for (const s of plan) log(`  ${s.name} [${s.profile ?? 'none'} -> ${s.model}]`);
    log('\nNothing was written.');
    return { skills: plan, models, dryRun: true };
  }

  for (const dir of [p.workflowHome, p.binHome, p.projectsHome, p.skillsHome, p.claudeHome]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.mkdirSync(path.dirname(p.modelsDest), { recursive: true });

  fs.rmSync(p.repoCopy, { recursive: true, force: true });
  fs.mkdirSync(p.repoCopy, { recursive: true });
  copyPayload(packageRoot, p.repoCopy);

  fs.copyFileSync(p.modelsSource, p.modelsDest);
  fs.copyFileSync(p.contractSource, p.contractDest);

  for (const skill of plan) {
    const destDir = path.join(p.skillsHome, skill.name);
    fs.mkdirSync(destDir, { recursive: true });
    const text = fs.readFileSync(skill.source, 'utf8');
    fs.writeFileSync(path.join(destDir, 'SKILL.md'), applyHostFrontmatter(text, skill.model));
  }

  // Shell helpers stay available for anyone scripting against the old layout;
  // `aether project-id` / `aether init-project` are the portable equivalents.
  for (const script of ['project-id.sh', 'init-project-state.sh']) {
    const from = path.join(packageRoot, 'scripts', script);
    if (!fs.existsSync(from)) continue;
    const to = path.join(p.binHome, script);
    fs.copyFileSync(from, to);
    try {
      fs.chmodSync(to, 0o755);
    } catch {
      // Windows filesystems reject the mode; the Node subcommands cover this case.
    }
  }

  const { linked, backup } = linkGlobalContract(p);

  log(`Installed ${plan.length} skills.`);
  log(`  strategic model      : ${models.strategic ?? 'inherit'}`);
  log(`  implementation model : ${models.implementation ?? 'inherit'}`);
  if (linked) {
    log(`  global CLAUDE.md     : contract import added${backup ? ` (backup: ${tildify(backup, p.home)})` : ''}`);
  } else {
    log('  global CLAUDE.md     : contract import already present, left unchanged');
  }
  log('');
  log('Start a new Claude Code session, then run /engineering-guide status.');

  return { skills: plan, models, dryRun: false };
}
