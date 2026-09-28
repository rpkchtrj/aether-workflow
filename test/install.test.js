import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { install } from '../lib/install.js';
import { uninstall, stripImportBlock } from '../lib/uninstall.js';
import { verify } from '../lib/verify.js';
import { applyHostFrontmatter, parseModels, readModelProfile, splitFrontmatter } from '../lib/skills.js';

/** Sandbox every home directory so tests never touch the real ~/.claude. */
function sandbox() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aether-test-'));
  return {
    home,
    env: {
      HOME: home,
      CLAUDE_HOME: path.join(home, '.claude'),
      ENGINEERING_WORKFLOW_HOME: path.join(home, '.engineering-workflow'),
    },
    cleanup: () => fs.rmSync(home, { recursive: true, force: true }),
  };
}

const silent = () => {};

test('install places skills with host frontmatter and links the contract', () => {
  const box = sandbox();
  try {
    const result = install({ env: box.env, register: false, log: silent });
    assert.ok(result.skills.length >= 16);

    // Default host is the Claude plugin: names stay canonical because the
    // plugin manifest supplies the `aether-wfl:` prefix.
    const skillsRoot = path.join(box.env.ENGINEERING_WORKFLOW_HOME, 'plugin', 'plugins', 'aether-wfl', 'skills');

    const guide = fs.readFileSync(path.join(skillsRoot, 'engineering-guide', 'SKILL.md'), 'utf8');
    assert.match(guide, /^---\nname: engineering-guide\n/);
    assert.match(guide, /^model: opus$/m);
    assert.match(guide, /^disable-model-invocation: true$/m);

    // The orchestrator is the workflow's one model-reachable entry point.
    const orchestrator = fs.readFileSync(
      path.join(skillsRoot, 'engineering-orchestrator', 'SKILL.md'),
      'utf8',
    );
    assert.match(orchestrator, /^disable-model-invocation: false$/m);

    const impl = fs.readFileSync(path.join(skillsRoot, 'implementation-agent', 'SKILL.md'), 'utf8');
    assert.match(impl, /^model: sonnet$/m);

    const global = fs.readFileSync(path.join(box.env.CLAUDE_HOME, 'CLAUDE.md'), 'utf8');
    assert.match(global, /# Personal AI-Assisted Engineering Workflow/);
    assert.ok(global.includes(`@${box.env.ENGINEERING_WORKFLOW_HOME}/GLOBAL_ENGINEERING_CONTRACT.md`));

    assert.ok(verify({ env: box.env, log: silent }).ok);
  } finally {
    box.cleanup();
  }
});

test('install is idempotent and preserves existing CLAUDE.md content', () => {
  const box = sandbox();
  try {
    fs.mkdirSync(box.env.CLAUDE_HOME, { recursive: true });
    fs.writeFileSync(path.join(box.env.CLAUDE_HOME, 'CLAUDE.md'), '# My rules\nBe concise.\n');

    install({ env: box.env, register: false, log: silent });
    install({ env: box.env, register: false, log: silent });

    const global = fs.readFileSync(path.join(box.env.CLAUDE_HOME, 'CLAUDE.md'), 'utf8');
    assert.match(global, /# My rules/);
    assert.equal(global.match(/# Personal AI-Assisted Engineering Workflow/g).length, 1);

    const backups = fs.readdirSync(box.env.CLAUDE_HOME).filter((f) => f.includes('CLAUDE.md.bak.'));
    assert.equal(backups.length, 1, 'only the run that edited CLAUDE.md should back it up');
  } finally {
    box.cleanup();
  }
});

test('dry run reports the plan without writing', () => {
  const box = sandbox();
  try {
    const result = install({ env: box.env, dryRun: true, log: silent });
    assert.equal(result.dryRun, true);
    assert.ok(result.skills.length > 0);
    assert.equal(fs.existsSync(box.env.CLAUDE_HOME), false);
    assert.equal(fs.existsSync(box.env.ENGINEERING_WORKFLOW_HOME), false);
  } finally {
    box.cleanup();
  }
});

test('uninstall removes skills and the import but keeps project state', () => {
  const box = sandbox();
  try {
    install({ env: box.env, host: 'claude-flat', register: false, log: silent });
    const stateDir = path.join(box.env.ENGINEERING_WORKFLOW_HOME, 'projects', 'abc123');
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'WORK_LOG.md'), 'kept');

    uninstall({ env: box.env, log: silent });

    assert.equal(fs.existsSync(path.join(box.env.CLAUDE_HOME, 'skills', 'aether-wfl-engineering-guide')), false);
    assert.equal(fs.readFileSync(path.join(stateDir, 'WORK_LOG.md'), 'utf8'), 'kept');
    const global = fs.readFileSync(path.join(box.env.CLAUDE_HOME, 'CLAUDE.md'), 'utf8');
    assert.doesNotMatch(global, /Personal AI-Assisted Engineering Workflow/);
  } finally {
    box.cleanup();
  }
});

test('uninstall --purge-state removes everything', () => {
  const box = sandbox();
  try {
    install({ env: box.env, register: false, log: silent });
    uninstall({ env: box.env, purgeState: true, log: silent });
    assert.equal(fs.existsSync(box.env.ENGINEERING_WORKFLOW_HOME), false);
  } finally {
    box.cleanup();
  }
});

test('verify fails loudly on a missing skill', () => {
  const box = sandbox();
  try {
    install({ env: box.env, register: false, log: silent });
    fs.rmSync(
      path.join(box.env.ENGINEERING_WORKFLOW_HOME, 'plugin', 'plugins', 'aether-wfl', 'skills', 'chaos-engineer'),
      { recursive: true },
    );
    const result = verify({ env: box.env, log: silent });
    assert.equal(result.ok, false);
    assert.match(result.problems.join('\n'), /chaos-engineer/);
  } finally {
    box.cleanup();
  }
});

test('applyHostFrontmatter replaces stale keys instead of stacking them', () => {
  const input = '---\nmodel: haiku\ndisable-model-invocation: false\nname: x\n---\nbody\n';
  const output = applyHostFrontmatter(input, 'opus');
  assert.equal(output.match(/^model:/gm).length, 1);
  assert.match(output, /^model: opus$/m);
  assert.match(output, /^disable-model-invocation: true$/m);
  assert.match(output, /^name: x$/m);
  assert.match(output, /body\n$/);
});

test('applyHostFrontmatter leaves a file without frontmatter alone', () => {
  assert.equal(applyHostFrontmatter('# Just a doc\n', 'opus'), '# Just a doc\n');
});

test('frontmatter and model helpers read the shipped shape', () => {
  const { frontmatter } = splitFrontmatter('---\nname: a\nmetadata:\n  workflow_model_profile: strategic\n---\nb');
  assert.equal(readModelProfile(frontmatter), 'strategic');
  assert.deepEqual(parseModels('strategic: opus\nimplementation: sonnet\n'), {
    strategic: 'opus',
    implementation: 'sonnet',
  });
});

test('stripImportBlock leaves unrelated headings intact', () => {
  const text = '# Mine\na\n\n# Personal AI-Assisted Engineering Workflow\n@/tmp/C.md\n\n# Other\nb\n';
  assert.equal(stripImportBlock(text, '/tmp/C.md'), '# Mine\na\n\n# Other\nb\n');
});
