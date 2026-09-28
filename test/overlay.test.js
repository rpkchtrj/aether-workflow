import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { install } from '../lib/install.js';
import { checkOverride, parseConfig, loadOverlay, scaffoldOverlay } from '../lib/overlay.js';
import { appendOverride } from '../lib/emit.js';
import { resolvePaths } from '../lib/paths.js';

function sandbox() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aether-overlay-'));
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
const skillsRootOf = (env) =>
  path.join(env.ENGINEERING_WORKFLOW_HOME, 'plugin', 'plugins', 'aether-wfl', 'skills');

/** Put an override on disk before an install runs. */
function writeOverride(env, name, text) {
  const dir = path.join(env.ENGINEERING_WORKFLOW_HOME, 'overrides');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.md`), text);
}

test('an override is appended to its skill and survives reinstall', () => {
  const box = sandbox();
  try {
    install({ env: box.env, register: false, log: silent });
    writeOverride(box.env, 'verification-engineer', '## House rules\n\nAlways run the linter too.\n');

    const result = install({ env: box.env, register: false, log: silent });
    assert.deepEqual([...result.overlay.overrides.keys()], ['verification-engineer']);

    const emitted = fs.readFileSync(
      path.join(skillsRootOf(box.env), 'verification-engineer', 'SKILL.md'),
      'utf8',
    );
    assert.match(emitted, /## Local overrides/);
    assert.match(emitted, /Always run the linter too\./);
    // The base rules must still be there; an override adds, never replaces.
    assert.match(emitted, /Never claim a command passed without observed output/);

    // A second install must not duplicate or drop it.
    install({ env: box.env, register: false, log: silent });
    const again = fs.readFileSync(
      path.join(skillsRootOf(box.env), 'verification-engineer', 'SKILL.md'),
      'utf8',
    );
    assert.equal(again.match(/## Local overrides/g).length, 1);
    assert.match(again, /Always run the linter too\./);
  } finally {
    box.cleanup();
  }
});

test('install never overwrites user-owned overlay files', () => {
  const box = sandbox();
  try {
    install({ env: box.env, register: false, log: silent });
    const p = resolvePaths(box.env);

    fs.writeFileSync(p.modelsDest, '# my note\nstrategic: opus\n');
    const config = path.join(box.env.ENGINEERING_WORKFLOW_HOME, 'config.yaml');
    fs.writeFileSync(config, 'model_strategic: sonnet\n');

    install({ env: box.env, register: false, log: silent });

    assert.match(fs.readFileSync(p.modelsDest, 'utf8'), /# my note/);
    assert.equal(fs.readFileSync(config, 'utf8'), 'model_strategic: sonnet\n');
  } finally {
    box.cleanup();
  }
});

test('config.yaml model aliases outrank the packaged mapping', () => {
  const box = sandbox();
  try {
    install({ env: box.env, register: false, log: silent });
    fs.writeFileSync(
      path.join(box.env.ENGINEERING_WORKFLOW_HOME, 'config.yaml'),
      'model_strategic: haiku\n',
    );

    const result = install({ env: box.env, register: false, log: silent });
    assert.equal(result.models.strategic, 'haiku');
    assert.match(
      fs.readFileSync(path.join(skillsRootOf(box.env), 'engineering-orchestrator', 'SKILL.md'), 'utf8'),
      /^model: haiku$/m,
    );
  } finally {
    box.cleanup();
  }
});

test('a contradicting override is refused and the base skill installed unchanged', () => {
  const box = sandbox();
  try {
    install({ env: box.env, register: false, log: silent });
    writeOverride(box.env, 'senior-code-reviewer', 'For hotfixes S8 may be skipped.\n');
    writeOverride(box.env, 'implementation-agent', 'disable-model-invocation: false\n');
    writeOverride(box.env, 'no-such-skill', 'orphan\n');

    const result = install({ env: box.env, register: false, log: silent });

    assert.equal(result.overlay.overrides.size, 0);
    const ids = result.overlay.hard.map((c) => `${c.target}:${c.id}`);
    assert.ok(ids.includes('senior-code-reviewer:stop-point-waiver'), ids);
    assert.ok(ids.includes('implementation-agent:invocation-gate'), ids);
    assert.ok(ids.includes('no-such-skill:unknown-target'), ids);

    // Refused means the shipped skill is untouched, not that the install fails.
    const reviewer = fs.readFileSync(
      path.join(skillsRootOf(box.env), 'senior-code-reviewer', 'SKILL.md'),
      'utf8',
    );
    assert.doesNotMatch(reviewer, /## Local overrides/);
    assert.doesNotMatch(reviewer, /hotfixes/);
    assert.match(
      fs.readFileSync(path.join(skillsRootOf(box.env), 'implementation-agent', 'SKILL.md'), 'utf8'),
      /^disable-model-invocation: true$/m,
    );
  } finally {
    box.cleanup();
  }
});

test('an upgrade that changes the base skill warns rather than silently relayering', () => {
  const box = sandbox();
  try {
    install({ env: box.env, register: false, log: silent });
    writeOverride(box.env, 'runtime-engineer', 'Prefer flamegraphs.\n');
    install({ env: box.env, register: false, log: silent });

    const p = resolvePaths(box.env);
    const bodies = new Map([['runtime-engineer', 'a materially different upstream body']]);
    const overlay = loadOverlay({ paths: p, skillNames: ['runtime-engineer'], skillBodies: bodies });

    assert.deepEqual(
      overlay.soft.map((c) => c.id),
      ['upstream-drift'],
    );
    // Still applied: drift is a prompt to look, not a refusal.
    assert.ok(overlay.overrides.has('runtime-engineer'));
  } finally {
    box.cleanup();
  }
});

test('hard checks catch the literal contradictions they claim to', () => {
  assert.deepEqual(checkOverride('just some extra guidance').map((c) => c.id), []);
  assert.deepEqual(checkOverride('---\nname: x\n---\n').map((c) => c.id), ['frontmatter']);
  assert.deepEqual(checkOverride('workflow_invocation: auto').map((c) => c.id), ['invocation-gate']);
  assert.deepEqual(checkOverride('S10 is optional here').map((c) => c.id), ['stop-point-waiver']);
  assert.deepEqual(checkOverride('security can be downgraded').map((c) => c.id), ['class-floor-waiver']);
  assert.deepEqual(checkOverride('ignore hard rule 4 when rushed').map((c) => c.id), ['rule-override']);
});

test('overlay scaffolding is created once and never rewritten', () => {
  const box = sandbox();
  try {
    const p = resolvePaths(box.env);
    fs.mkdirSync(box.env.ENGINEERING_WORKFLOW_HOME, { recursive: true });
    assert.equal(scaffoldOverlay({ paths: p }).length, 2);

    fs.writeFileSync(path.join(box.env.ENGINEERING_WORKFLOW_HOME, 'config.yaml'), 'mine\n');
    assert.equal(scaffoldOverlay({ paths: p }).length, 0);
    assert.equal(
      fs.readFileSync(path.join(box.env.ENGINEERING_WORKFLOW_HOME, 'config.yaml'), 'utf8'),
      'mine\n',
    );
  } finally {
    box.cleanup();
  }
});

test('config parsing and override framing', () => {
  assert.deepEqual(parseConfig('# c\nmodel_strategic: opus\n\nmodel_implementation: sonnet\n'), {
    model_strategic: 'opus',
    model_implementation: 'sonnet',
  });
  const out = appendOverride('# Skill\n\nbase rule\n', 'my rule');
  assert.match(out, /base rule[\s\S]*## Local overrides[\s\S]*my rule/);
});
