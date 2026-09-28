import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * The user overlay: local tweaks that survive an upgrade.
 *
 * Everything here is user-owned and never overwritten by an install. The
 * package supplies the base; the overlay adds to it. Prose cannot be merged
 * semantically, so an override is appended rather than woven in, and anything
 * that looks like it contradicts the base is reported for the human to
 * reconcile instead of being silently applied.
 */

/** Overlay locations under the workflow home. */
export function overlayPaths(p) {
  return {
    config: path.join(p.workflowHome, 'config.yaml'),
    overridesDir: path.join(p.workflowHome, 'overrides'),
    reconciled: path.join(p.workflowHome, 'overrides', '.reconciled.json'),
  };
}

/** Flat `key: value` parse, matching how host.yaml and models.yaml are read. */
export function parseConfig(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const match = line.match(/^([a-z0-9_]+):\s*(.*)$/);
    if (match) out[match[1]] = match[2].trim();
  }
  return out;
}

const KNOWN_CONFIG_KEYS = new Set(['model_strategic', 'model_implementation']);

/** Stable identity of an upstream body, so a later upgrade can report drift. */
export function bodyHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/**
 * Checks that refuse an override outright.
 *
 * These are deliberately narrow and literal. They catch an override that tries
 * to reach past "add to the workflow" and into the parts the workflow's safety
 * model rests on. They are a tripwire, not a proof: an override can still
 * contradict the base in prose no pattern will recognise, which is why the
 * install reports every applied override rather than applying them quietly.
 */
const HARD_CHECKS = [
  {
    id: 'frontmatter',
    test: (text) => /^---\s*$/m.test(text.split('\n').slice(0, 3).join('\n')),
    why: 'contains a frontmatter fence; frontmatter is host-managed and rebuilt per install',
  },
  {
    id: 'invocation-gate',
    test: (text) => /^\s*(disable-model-invocation|workflow_invocation|model)\s*:/m.test(text),
    why: 'sets an invocation or model key; dispatch determinism depends on the package owning these',
  },
  {
    id: 'stop-point-waiver',
    test: (text) => /\bS(2|8|10|12)\b[^.\n]{0,80}\b(skip|skipped|waive|waived|optional|not required|remove)\b/i.test(text),
    why: 'appears to waive S2, S8, S10 or S12, which are unwaivable above T0',
  },
  {
    id: 'class-floor-waiver',
    test: (text) =>
      /\b(security|senior review|engineering reasoning|verification|documentation)\b[^.\n]{0,80}\b(may|can|should) be (downgraded|skipped|N\/A|optional)\b/i.test(
        text,
      ),
    why: 'appears to downgrade a class-floored gate',
  },
  {
    id: 'rule-override',
    test: (text) => /\b(ignore|disregard|override)\b[^.\n]{0,40}\b(hard rule|rule \d+|the contract)\b/i.test(text),
    why: 'instructs the agent to ignore a base rule rather than add to it',
  },
];

/** Classify one override file against the hard checks. */
export function checkOverride(text) {
  return HARD_CHECKS.filter((check) => check.test(text)).map(({ id, why }) => ({ id, why }));
}

/**
 * Read the overlay and reconcile it against what the package ships.
 *
 * `hard` conflicts are not applied. `soft` ones are applied with a warning -
 * currently upstream drift, where the base skill changed since the override was
 * last reconciled and the user should re-read their addition against it.
 */
export function loadOverlay({ paths: p, skillNames, skillBodies = new Map() }) {
  const o = overlayPaths(p);
  const overlay = { config: {}, overrides: new Map(), hard: [], soft: [] };

  if (fs.existsSync(o.config)) {
    overlay.config = parseConfig(fs.readFileSync(o.config, 'utf8'));
    for (const key of Object.keys(overlay.config)) {
      if (!KNOWN_CONFIG_KEYS.has(key)) {
        overlay.soft.push({ target: 'config.yaml', id: 'unknown-key', why: `unknown key "${key}"; ignored` });
      }
    }
  }

  if (!fs.existsSync(o.overridesDir)) return overlay;

  let reconciled = {};
  if (fs.existsSync(o.reconciled)) {
    try {
      reconciled = JSON.parse(fs.readFileSync(o.reconciled, 'utf8'));
    } catch {
      reconciled = {};
    }
  }

  const files = fs
    .readdirSync(o.overridesDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== 'README.md')
    .map((e) => e.name);

  for (const file of files) {
    const target = file.replace(/\.md$/, '');
    const text = fs.readFileSync(path.join(o.overridesDir, file), 'utf8').trim();

    if (!skillNames.includes(target)) {
      overlay.hard.push({
        target,
        id: 'unknown-target',
        why: `no skill named "${target}" ships in this version; it may have been renamed or removed`,
      });
      continue;
    }

    const problems = checkOverride(text);
    if (problems.length > 0) {
      overlay.hard.push(...problems.map((problem) => ({ target, ...problem })));
      continue;
    }

    const upstream = bodyHash(skillBodies.get(target) ?? '');
    if (reconciled[target] && reconciled[target] !== upstream) {
      overlay.soft.push({
        target,
        id: 'upstream-drift',
        why: 'the base skill changed in this version; re-read your override against it',
      });
    }

    overlay.overrides.set(target, { text, upstream });
  }

  return overlay;
}

/** Record the upstream hashes the applied overrides were reconciled against. */
export function writeReconciled({ paths: p, overlay }) {
  const o = overlayPaths(p);
  if (overlay.overrides.size === 0) return;
  const record = {};
  for (const [target, { upstream }] of overlay.overrides) record[target] = upstream;
  fs.mkdirSync(o.overridesDir, { recursive: true });
  fs.writeFileSync(o.reconciled, `${JSON.stringify(record, null, 2)}\n`);
}

const CONFIG_TEMPLATE = `# User overlay. This file is yours: an install never overwrites it.
#
# Model aliases override hosts/claude/models.yaml for this machine.
# Uncomment and change what you need.
#
# model_strategic: opus
# model_implementation: sonnet
#
# To tweak a skill's behaviour, drop a markdown file in overrides/ named after
# the skill - overrides/engineering-orchestrator.md - and its contents are
# appended to that skill as a "Local overrides" section. Base rules stay in
# force; your additions add to them.
#
# An install reports any override it could not apply, and any whose base skill
# changed in the new version, so you can reconcile rather than discovering it
# in the middle of a change.
`;

const OVERRIDES_README = `# Overrides

One markdown file per skill, named exactly after it:

    overrides/engineering-orchestrator.md
    overrides/verification-engineer.md

The contents are appended to that skill as a "Local overrides" section at
install time. This is additive layering, not a semantic merge - prose cannot be
merged automatically, so your text is added after the base rules rather than
woven into them.

An override is refused, and the base skill installed unchanged, when it:

- names a skill that does not ship in this version
- contains a frontmatter fence
- sets a model or invocation key
- appears to waive S2, S8, S10 or S12
- appears to downgrade a class-floored gate
- instructs the agent to ignore a base rule rather than add to it

Those checks are literal pattern matches. They catch the obvious cases; an
override can still contradict the base in prose no pattern will recognise,
which is why every applied override is reported at install rather than applied
quietly.

\`.reconciled.json\` records the base skill each override was last reconciled
against. When an upgrade changes that skill, the install says so and asks you to
re-read your override - it does not try to decide for you.
`;

/** Create the overlay scaffolding, without ever touching a file that exists. */
export function scaffoldOverlay({ paths: p }) {
  const o = overlayPaths(p);
  const created = [];
  if (!fs.existsSync(o.config)) {
    fs.mkdirSync(path.dirname(o.config), { recursive: true });
    fs.writeFileSync(o.config, CONFIG_TEMPLATE);
    created.push(o.config);
  }
  if (!fs.existsSync(o.overridesDir)) {
    fs.mkdirSync(o.overridesDir, { recursive: true });
  }
  const readme = path.join(o.overridesDir, 'README.md');
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(readme, OVERRIDES_README);
    created.push(readme);
  }
  return created;
}
