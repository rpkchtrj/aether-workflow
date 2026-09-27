#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { packageRoot } from '../lib/paths.js';
import { install, DEFAULT_HOST } from '../lib/install.js';
import { uninstall } from '../lib/uninstall.js';
import { verify } from '../lib/verify.js';
import { listHosts, loadHost } from '../lib/hosts.js';
import { resolvePaths } from '../lib/paths.js';
import { initProject, projectId } from '../lib/project.js';

const USAGE = `aether-workflow - personal AI-assisted engineering workflow

Usage:
  npx aether-workflow install [--host <host>] [--target <dir>] [--no-register] [--dry-run]
                                            Install skills, contract and private state
  npx aether-workflow hosts                 List available host adapters
  npx aether-workflow verify [--host <host>]
                                            Check an existing installation
  npx aether-workflow uninstall [--purge-state]
                                            Remove skills and contract import
  npx aether-workflow init-project          Create private state for the current repo
  npx aether-workflow project-id            Print the current repo's project id
  npx aether-workflow version               Print the package version

Hosts:
  A host adapter is a hosts/<name>/host.yaml file. It declares how that agent
  namespaces skills: "plugin" (the host supplies the prefix) or "name-prefix"
  (the prefix is baked into the skill name). Adding an agent needs no code.

  Default host: ${DEFAULT_HOST}

Environment:
  ENGINEERING_WORKFLOW_HOME   Private state location (default ~/.engineering-workflow)
  CLAUDE_HOME                 Claude Code home (default ~/.claude)

install writes to the selected host's target, ~/.claude/CLAUDE.md (backed up
first), and ~/.engineering-workflow/. It never modifies an application repository.
`;

function version() {
  const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  return pkg.version;
}

/** Read `--flag value` out of the argument list. */
function option(flags, name) {
  const index = flags.indexOf(`--${name}`);
  if (index === -1) return null;
  const value = flags[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`--${name} needs a value`);
  return value;
}

function printHosts() {
  const paths = resolvePaths();
  for (const name of listHosts()) {
    let target = '(needs --target)';
    try {
      target = loadHost(name, { paths }).target;
    } catch {
      // A host whose target is supplied at install time has nothing to show yet.
    }
    const host = (() => {
      try {
        return loadHost(name, { paths, targetOverride: '<dir>' });
      } catch {
        return null;
      }
    })();
    console.log(`${name.padEnd(14)} ${(host?.namespace ?? '?').padEnd(12)} ${host?.invocation ?? ''}`);
    console.log(`${' '.repeat(14)} ${host?.description ?? ''}`);
    console.log(`${' '.repeat(14)} target: ${target}`);
  }
}

function main(argv) {
  const [command = 'help', ...flags] = argv;
  const has = (flag) => flags.includes(flag);

  switch (command) {
    case 'install':
      install({
        dryRun: has('--dry-run'),
        host: option(flags, 'host') ?? DEFAULT_HOST,
        target: option(flags, 'target'),
        register: !has('--no-register'),
      });
      return 0;
    case 'hosts':
      printHosts();
      return 0;
    case 'verify':
      return verify({ host: option(flags, 'host') }).ok ? 0 : 1;
    case 'uninstall':
      uninstall({ purgeState: has('--purge-state') });
      return 0;
    case 'init-project':
      initProject();
      return 0;
    case 'project-id':
      console.log(projectId());
      return 0;
    case 'version':
    case '--version':
    case '-v':
      console.log(version());
      return 0;
    case 'help':
    case '--help':
    case '-h':
      console.log(USAGE);
      return 0;
    default:
      console.error(`Unknown command: ${command}\n`);
      console.error(USAGE);
      return 1;
  }
}

try {
  process.exit(main(process.argv.slice(2)));
} catch (error) {
  console.error(`aether-workflow: ${error.message}`);
  process.exit(1);
}
