import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { install } from '../lib/install.js';
import { uninstall } from '../lib/uninstall.js';
import { verify } from '../lib/verify.js';
import { loadHost, listHosts, parseHostFile, resolveTarget } from '../lib/hosts.js';
import { emitSkill, emittedName, rewriteReferences, ownedSkillDirs, planEmission } from '../lib/emit.js';
import { resolvePaths } from '../lib/paths.js';

function sandbox() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aether-host-'));
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
const hostFor = (name, env, targetOverride = null) =>
  loadHost(name, { paths: resolvePaths(env), targetOverride });

test('every shipped host adapter loads and declares a known namespace', () => {
  const box = sandbox();
  try {
    const names = listHosts();
    assert.ok(names.includes('claude-plugin') && names.includes('codex'));
    for (const name of names) {
      const host = hostFor(name, box.env, path.join(box.home, 'generic'));
      assert.ok(['plugin', 'name-prefix'].includes(host.namespace));
      assert.equal(host.prefix, 'aether-wfl');
      assert.ok(host.frontmatterKeys.includes('name'));
    }
  } finally {
    box.cleanup();
  }
});

test('a plugin host keeps canonical names; a name-prefix host bakes the prefix in', () => {
  const box = sandbox();
  try {
    const plugin = hostFor('claude-plugin', box.env);
    const flat = hostFor('claude-flat', box.env);
    assert.equal(emittedName('engineering-guide', plugin), 'engineering-guide');
    assert.equal(emittedName('engineering-guide', flat), 'aether-wfl-engineering-guide');
  } finally {
    box.cleanup();
  }
});

test('emitted frontmatter name matches the emitted directory', () => {
  const box = sandbox();
  try {
    for (const name of ['claude-plugin', 'claude-flat', 'codex']) {
      const host = hostFor(name, box.env);
      const emitted = emitSkill({
        text: '---\nname: engineering-guide\ndescription: d\n---\nbody\n',
        canonicalName: 'engineering-guide',
        host,
        model: 'opus',
      });
      assert.match(emitted.text, new RegExp(`^name: ${emitted.dirName}$`, 'm'), name);
    }
  } finally {
    box.cleanup();
  }
});

test('a host only receives frontmatter keys it declares', () => {
  const box = sandbox();
  try {
    const codex = emitSkill({
      text: '---\nname: x\ndescription: d\nmetadata:\n  workflow_model_profile: strategic\n---\nb\n',
      canonicalName: 'x',
      host: hostFor('codex', box.env),
      model: 'opus',
    });
    assert.doesNotMatch(codex.text, /^model:/m, 'Claude model key must not leak into Codex');
    assert.doesNotMatch(codex.text, /^disable-model-invocation:/m);
    assert.doesNotMatch(codex.text, /^metadata:/m);

    const claude = emitSkill({
      text: '---\nname: x\ndescription: d\nmetadata:\n  workflow_model_profile: strategic\n---\nb\n',
      canonicalName: 'x',
      host: hostFor('claude-plugin', box.env),
      model: 'opus',
    });
    assert.match(claude.text, /^model: opus$/m);
    assert.match(claude.text, /^disable-model-invocation: true$/m);
    assert.match(claude.text, /^ {2}workflow_model_profile: strategic$/m);
  } finally {
    box.cleanup();
  }
});

test('cross-references are rewritten only on whole tokens', () => {
  const box = sandbox();
  try {
    const flat = hostFor('claude-flat', box.env);
    assert.equal(
      rewriteReferences('see documentation-guardian now', ['documentation-guardian'], flat),
      'see aether-wfl-documentation-guardian now',
    );
    // A longer name that merely contains a skill name must not be touched.
    assert.equal(
      rewriteReferences('engineering-guide-notes', ['engineering-guide'], flat),
      'engineering-guide-notes',
    );
    assert.equal(
      rewriteReferences('see documentation-guardian', ['documentation-guardian'], hostFor('claude-plugin', box.env)),
      'see documentation-guardian',
    );
  } finally {
    box.cleanup();
  }
});

test('the real orchestrator cross-reference survives a prefixed install', () => {
  const box = sandbox();
  try {
    install({ env: box.env, host: 'claude-flat', register: false, log: silent });
    const text = fs.readFileSync(
      path.join(box.env.CLAUDE_HOME, 'skills', 'aether-wfl-engineering-orchestrator', 'SKILL.md'),
      'utf8',
    );
    assert.match(text, /aether-wfl-documentation-guardian/);
  } finally {
    box.cleanup();
  }
});

test('a name-prefix install never touches unrelated skills in a shared directory', () => {
  const box = sandbox();
  try {
    const foreign = path.join(box.env.CLAUDE_HOME, 'skills', 'someone-elses-skill');
    fs.mkdirSync(foreign, { recursive: true });
    fs.writeFileSync(path.join(foreign, 'SKILL.md'), 'keep me');

    install({ env: box.env, host: 'claude-flat', register: false, log: silent });
    install({ env: box.env, host: 'claude-flat', register: false, log: silent });

    assert.equal(fs.readFileSync(path.join(foreign, 'SKILL.md'), 'utf8'), 'keep me');
    assert.deepEqual(
      ownedSkillDirs(hostFor('claude-flat', box.env)).map((d) => path.basename(d)).includes('someone-elses-skill'),
      false,
    );
  } finally {
    box.cleanup();
  }
});

test('the plugin host writes manifests whose names produce the prefix', () => {
  const box = sandbox();
  try {
    const result = install({ env: box.env, host: 'claude-plugin', register: false, log: silent });
    const root = path.join(box.env.ENGINEERING_WORKFLOW_HOME, 'plugin');

    const plugin = JSON.parse(fs.readFileSync(path.join(root, 'plugins', 'aether-wfl', '.claude-plugin', 'plugin.json'), 'utf8'));
    const market = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin', 'marketplace.json'), 'utf8'));

    assert.equal(plugin.name, 'aether-wfl');
    assert.equal(market.plugins[0].name, plugin.name, 'entry name must equal manifest name');
    assert.equal(market.plugins[0].source, './plugins/aether-wfl');
    assert.doesNotMatch(market.plugins[0].source, /\.\./, 'relative source must not escape the marketplace root');
    assert.ok(fs.existsSync(path.join(root, 'plugins', 'aether-wfl', 'skills', 'engineering-guide', 'SKILL.md')));
    assert.equal(result.host.invocation, '/aether-wfl:<skill>');
  } finally {
    box.cleanup();
  }
});

test('install removes the pre-namespacing layout so skills never double up', () => {
  const box = sandbox();
  try {
    const legacy = path.join(box.env.CLAUDE_HOME, 'skills', 'engineering-guide');
    fs.mkdirSync(legacy, { recursive: true });
    fs.writeFileSync(path.join(legacy, 'SKILL.md'), '---\nname: engineering-guide\n---\nold\n');

    install({ env: box.env, host: 'claude-plugin', register: false, log: silent });

    assert.equal(fs.existsSync(legacy), false);
    assert.ok(verify({ env: box.env, log: silent }).ok);
  } finally {
    box.cleanup();
  }
});

test('verify flags a legacy duplicate left beside a prefixed install', () => {
  const box = sandbox();
  try {
    install({ env: box.env, host: 'claude-flat', register: false, log: silent });
    const legacy = path.join(box.env.CLAUDE_HOME, 'skills', 'engineering-guide');
    fs.mkdirSync(legacy, { recursive: true });
    fs.writeFileSync(path.join(legacy, 'SKILL.md'), 'stale');

    const result = verify({ env: box.env, log: silent });
    assert.equal(result.ok, false);
    assert.match(result.problems.join('\n'), /LEGACY DUPLICATE/);
  } finally {
    box.cleanup();
  }
});

test('verify follows the recorded host rather than the default', () => {
  const box = sandbox();
  try {
    install({ env: box.env, host: 'codex', register: false, log: silent });
    const record = JSON.parse(fs.readFileSync(path.join(box.env.ENGINEERING_WORKFLOW_HOME, 'install.json'), 'utf8'));
    assert.equal(record.host, 'codex');
    assert.ok(record.names.includes('aether-wfl-engineering-guide'));
    assert.ok(verify({ env: box.env, log: silent }).ok);
    assert.ok(fs.existsSync(path.join(box.home, '.agents', 'skills', 'aether-wfl-engineering-guide', 'SKILL.md')));
  } finally {
    box.cleanup();
  }
});

test('uninstall clears the recorded host and leaves foreign skills alone', () => {
  const box = sandbox();
  try {
    install({ env: box.env, host: 'claude-flat', register: false, log: silent });
    const foreign = path.join(box.env.CLAUDE_HOME, 'skills', 'unrelated');
    fs.mkdirSync(foreign, { recursive: true });
    fs.writeFileSync(path.join(foreign, 'SKILL.md'), 'keep');

    uninstall({ env: box.env, log: silent });

    assert.equal(fs.existsSync(path.join(box.env.CLAUDE_HOME, 'skills', 'aether-wfl-engineering-guide')), false);
    assert.equal(fs.readFileSync(path.join(foreign, 'SKILL.md'), 'utf8'), 'keep');
  } finally {
    box.cleanup();
  }
});

test('emission is idempotent', () => {
  const box = sandbox();
  try {
    const a = install({ env: box.env, host: 'claude-plugin', register: false, log: silent });
    const b = install({ env: box.env, host: 'claude-plugin', register: false, log: silent });
    assert.deepEqual(a.emission.files.map((f) => f.path), b.emission.files.map((f) => f.path));
    assert.deepEqual(a.emission.files.map((f) => f.contents), b.emission.files.map((f) => f.contents));
  } finally {
    box.cleanup();
  }
});

test('dry run writes nothing for any host', () => {
  const box = sandbox();
  try {
    install({ env: box.env, host: 'codex', dryRun: true, register: false, log: silent });
    assert.equal(fs.existsSync(path.join(box.home, '.agents')), false);
    assert.equal(fs.existsSync(box.env.ENGINEERING_WORKFLOW_HOME), false);
  } finally {
    box.cleanup();
  }
});

test('the generic host requires an explicit target and then honours it', () => {
  const box = sandbox();
  try {
    assert.throws(() => hostFor('generic', box.env), /--target/);
    const dir = path.join(box.home, 'some-agent', 'skills');
    install({ env: box.env, host: 'generic', target: dir, register: false, log: silent });
    assert.ok(fs.existsSync(path.join(dir, 'aether-wfl-engineering-guide', 'SKILL.md')));
  } finally {
    box.cleanup();
  }
});

test('adapter validation rejects malformed hosts before anything is written', () => {
  const box = sandbox();
  try {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aether-badhost-'));
    const write = (name, body) => {
      fs.mkdirSync(path.join(root, name), { recursive: true });
      fs.writeFileSync(path.join(root, name, 'host.yaml'), body);
    };
    const load = (name) => loadHost(name, { paths: resolvePaths(box.env), hostsSource: root });

    write('bad-ns', 'name: x\nnamespace: nope\nprefix: p\ntarget: ~/x\nfrontmatter_keys: name\n');
    assert.throws(() => load('bad-ns'), /expected one of/);

    write('bad-sub', 'name: x\nnamespace: plugin\nprefix: p\ntarget: ~/x\nfrontmatter_keys: name\n');
    assert.throws(() => load('bad-sub'), /skills_subdir/);

    write('no-name', 'name: x\nnamespace: name-prefix\nprefix: p\ntarget: ~/x\nfrontmatter_keys: description\n');
    assert.throws(() => load('no-name'), /must emit a "name"/);

    write('bad-prefix', 'name: x\nnamespace: name-prefix\nprefix: Bad Prefix\ntarget: ~/x\nfrontmatter_keys: name\n');
    assert.throws(() => load('bad-prefix'), /unusable prefix/);

    assert.throws(() => load('missing'), /Unknown host/);
    fs.rmSync(root, { recursive: true, force: true });
  } finally {
    box.cleanup();
  }
});

test('host.yaml parsing and target expansion', () => {
  const parsed = parseHostFile('# comment\n\nname: x\nprefix: p\nfrontmatter_keys: a, b\n');
  assert.deepEqual(parsed, { name: 'x', prefix: 'p', frontmatter_keys: 'a, b' });
  const dirs = { home: '/h', claudeHome: '/h/.claude', workflowHome: '/h/.ew' };
  assert.equal(resolveTarget('~/.agents/skills', dirs), '/h/.agents/skills');
  assert.equal(resolveTarget('${CLAUDE_HOME}/skills', dirs), '/h/.claude/skills');
  assert.equal(resolveTarget('${WORKFLOW_HOME}/plugin', dirs), '/h/.ew/plugin');
});

test('every emitted skill name is a valid, non-colliding identifier', () => {
  const box = sandbox();
  try {
    for (const name of ['claude-plugin', 'claude-flat', 'codex']) {
      const host = hostFor(name, box.env);
      const result = install({ env: box.env, host: name, dryRun: true, register: false, log: silent });
      const emitted = planEmission({ host, skills: result.skills, pkg: { version: '0', author: {} } }).names;
      assert.equal(new Set(emitted).size, emitted.length, `${name} has colliding names`);
      for (const skill of emitted) {
        assert.match(skill, /^[a-z0-9][a-z0-9-]*$/);
        assert.ok(skill.length <= 64);
      }
    }
  } finally {
    box.cleanup();
  }
});
