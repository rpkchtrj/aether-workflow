import fs from 'node:fs';
import path from 'node:path';

import { resolvePaths, packageRoot, tildify } from './paths.js';
import {
  listSkills,
  parseModels,
  modelForProfile,
  readModelProfile,
  readInvocationMode,
  splitFrontmatter,
} from './skills.js';
import { loadHost, listHosts } from './hosts.js';
import { planEmission, writeEmission, emittedName } from './emit.js';
import { registerClaudePlugin } from './register.js';

const IMPORT_HEADING = '# Personal AI-Assisted Engineering Workflow';

/** Host used when the caller doesn't name one. */
export const DEFAULT_HOST = 'claude-plugin';

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
  'WORKFLOW_GUIDE.md',
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
 * Remove skills from the pre-namespacing layout, where every skill sat
 * unprefixed directly in the Claude skills directory. Without this an upgrade
 * leaves two copies of each skill competing for the same request.
 */
export function removeLegacyLayout({ skillsHome }, canonicalNames, { dryRun = false } = {}) {
  const found = canonicalNames
    .map((name) => path.join(skillsHome, name))
    .filter((dir) => fs.existsSync(path.join(dir, 'SKILL.md')));
  if (!dryRun) {
    for (const dir of found) fs.rmSync(dir, { recursive: true, force: true });
  }
  return found;
}

/** Resolve the model for each packaged skill from the host's model map. */
function buildPlan(p, host) {
  const skills = listSkills(p.skillsSource);
  if (skills.length === 0) {
    throw new Error(`No skills found under ${p.skillsSource}. The package payload looks incomplete.`);
  }

  let models = { strategic: null, implementation: null };
  if (host.modelMap) {
    const mapFile = path.join(packageRoot, 'hosts', host.modelMap);
    if (!fs.existsSync(mapFile)) throw new Error(`Missing model mapping at ${mapFile}.`);
    models = parseModels(fs.readFileSync(mapFile, 'utf8'));
  }

  const plan = skills.map((name) => {
    const source = path.join(p.skillsSource, name, 'SKILL.md');
    const { frontmatter } = splitFrontmatter(fs.readFileSync(source, 'utf8'));
    const profile = readModelProfile(frontmatter);
    return {
      name,
      source,
      profile,
      invocation: readInvocationMode(frontmatter),
      model: host.modelMap ? modelForProfile(profile, models) : null,
    };
  });

  return { plan, models };
}

function packageMeta() {
  const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  return {
    version: pkg.version,
    description: pkg.description,
    license: pkg.license,
    homepage: pkg.homepage,
    author: { name: pkg.author },
  };
}

/**
 * Install skills for one host, plus the global contract and private state.
 * `dryRun` resolves and reports every target without writing anything.
 */
export function install({
  env = process.env,
  dryRun = false,
  host: hostName = DEFAULT_HOST,
  target = null,
  register = true,
  log = console.log,
} = {}) {
  const p = resolvePaths(env);
  const host = loadHost(hostName, { paths: p, targetOverride: target });
  const { plan, models } = buildPlan(p, host);
  const pkg = packageMeta();
  const emission = planEmission({ host, skills: plan, pkg });

  log(`aether-workflow installer`);
  log(`  host          -> ${host.name} (${host.namespace})`);
  log(`  skills        -> ${tildify(path.join(host.target, host.skillsSubdir), p.home)}`);
  log(`  invocation    -> ${host.invocation}`);
  log(`  contract      -> ${tildify(p.contractDest, p.home)}`);
  log(`  private state -> ${tildify(p.workflowHome, p.home)}`);
  log(`  global import -> ${tildify(p.globalClaudeMd, p.home)} (backed up before edit)`);
  log('');

  if (dryRun) {
    const legacy = removeLegacyLayout(p, plan.map((s) => s.name), { dryRun: true });
    log(`Dry run. ${plan.length} skills would be installed as:`);
    for (const skill of plan) {
      log(
        `  ${emittedName(skill.name, host)} [${skill.profile ?? 'none'} -> ${skill.model ?? 'n/a'}] ${skill.invocation}`,
      );
    }
    if (legacy.length > 0) log(`\n${legacy.length} legacy unprefixed skills would be removed.`);
    log('\nNothing was written.');
    return { skills: plan, models, host, emission, dryRun: true };
  }

  for (const dir of [p.workflowHome, p.binHome, p.projectsHome, p.claudeHome]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.mkdirSync(path.dirname(p.modelsDest), { recursive: true });

  fs.rmSync(p.repoCopy, { recursive: true, force: true });
  fs.mkdirSync(p.repoCopy, { recursive: true });
  copyPayload(packageRoot, p.repoCopy);

  fs.copyFileSync(p.modelsSource, p.modelsDest);
  fs.copyFileSync(p.contractSource, p.contractDest);

  const legacy = removeLegacyLayout(p, plan.map((s) => s.name));
  writeEmission(emission);

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

  // Record what was installed where, so verify and uninstall act on the host
  // that actually ran rather than guessing the default.
  fs.writeFileSync(
    p.installRecord,
    `${JSON.stringify(
      {
        version: pkg.version,
        host: host.name,
        namespace: host.namespace,
        prefix: host.prefix,
        target: host.target,
        skillsSubdir: host.skillsSubdir,
        invocation: host.invocation,
        names: emission.names,
        installedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );

  log(`Installed ${plan.length} skills for host ${host.name}.`);
  if (host.modelMap) {
    log(`  strategic model      : ${models.strategic ?? 'inherit'}`);
    log(`  implementation model : ${models.implementation ?? 'inherit'}`);
  }
  if (legacy.length > 0) log(`  legacy skills removed: ${legacy.length} (pre-namespacing layout)`);
  if (linked) {
    log(`  global CLAUDE.md     : contract import added${backup ? ` (backup: ${tildify(backup, p.home)})` : ''}`);
  } else {
    log('  global CLAUDE.md     : contract import already present, left unchanged');
  }

  let registration = { registered: false, reason: 'not applicable for this host' };
  if (host.register === 'claude-cli' && register) {
    registration = registerClaudePlugin(host, { log });
    if (!registration.registered) {
      log(`  registration         : SKIPPED - ${registration.reason}`);
      log(`  fall back with       : npx aether-workflow install --host claude-flat`);
    }
  }

  log('');
  log(`Start a new session, then run ${host.invocation.replace('<skill>', 'engineering-guide')} status.`);

  return { skills: plan, models, host, emission, registration, dryRun: false };
}

export { listHosts };
