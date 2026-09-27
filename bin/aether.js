#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { packageRoot } from '../lib/paths.js';
import { install } from '../lib/install.js';
import { uninstall } from '../lib/uninstall.js';
import { verify } from '../lib/verify.js';
import { initProject, projectId } from '../lib/project.js';

const USAGE = `aether-workflow - personal AI-assisted engineering workflow for Claude Code

Usage:
  npx aether-workflow install [--dry-run]   Install skills, contract and private state
  npx aether-workflow verify                Check an existing installation
  npx aether-workflow uninstall [--purge-state]
                                            Remove skills and contract import
  npx aether-workflow init-project          Create private state for the current repo
  npx aether-workflow project-id            Print the current repo's project id
  npx aether-workflow version               Print the package version

Environment:
  ENGINEERING_WORKFLOW_HOME   Private state location (default ~/.engineering-workflow)
  CLAUDE_HOME                 Claude Code home (default ~/.claude)

install writes to: ~/.claude/skills/, ~/.claude/CLAUDE.md (backed up first),
and ~/.engineering-workflow/. It does not modify any application repository.
`;

function version() {
  const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  return pkg.version;
}

function main(argv) {
  const [command = 'help', ...flags] = argv;
  const has = (flag) => flags.includes(flag);

  switch (command) {
    case 'install':
      install({ dryRun: has('--dry-run') });
      return 0;
    case 'verify':
      return verify().ok ? 0 : 1;
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
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(`aether-workflow: ${error.message}`);
  process.exitCode = 1;
}
