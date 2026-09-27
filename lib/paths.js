import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Root of the installed package (the directory holding skills/, templates/, hosts/). */
export const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Resolve every filesystem location the installer touches.
 * Both homes stay overridable so a host adapter (or a test) can redirect them.
 */
export function resolvePaths(env = process.env) {
  const home = env.HOME || env.USERPROFILE || os.homedir();
  const workflowHome = env.ENGINEERING_WORKFLOW_HOME || path.join(home, '.engineering-workflow');
  const claudeHome = env.CLAUDE_HOME || path.join(home, '.claude');

  return {
    home,
    workflowHome,
    claudeHome,
    skillsHome: path.join(claudeHome, 'skills'),
    globalClaudeMd: path.join(claudeHome, 'CLAUDE.md'),
    repoCopy: path.join(workflowHome, 'repo'),
    binHome: path.join(workflowHome, 'bin'),
    projectsHome: path.join(workflowHome, 'projects'),
    contractDest: path.join(workflowHome, 'GLOBAL_ENGINEERING_CONTRACT.md'),
    installRecord: path.join(workflowHome, 'install.json'),
    modelsDest: path.join(workflowHome, 'hosts', 'claude', 'models.yaml'),
    modelsSource: path.join(packageRoot, 'hosts', 'claude', 'models.yaml'),
    contractSource: path.join(packageRoot, 'GLOBAL_ENGINEERING_CONTRACT.md'),
    skillsSource: path.join(packageRoot, 'skills'),
    templatesSource: path.join(packageRoot, 'templates'),
  };
}

/** Render an absolute path with the user's home collapsed to `~` for display. */
export function tildify(p, home) {
  return p.startsWith(home) ? `~${p.slice(home.length)}` : p;
}
