import fs from 'node:fs';
import path from 'node:path';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Split a SKILL.md into its YAML frontmatter block and the body after it.
 * A file without frontmatter yields an empty block and an untouched body.
 */
export function splitFrontmatter(text) {
  const match = text.match(FRONTMATTER);
  if (!match) return { frontmatter: '', body: text, hasFrontmatter: false };
  return { frontmatter: match[1], body: text.slice(match[0].length), hasFrontmatter: true };
}

/**
 * Read `metadata.workflow_model_profile` without pulling in a YAML parser.
 * The skill files use a fixed two-space-indented shape, so a line scan is enough.
 */
export function readModelProfile(frontmatter) {
  const match = frontmatter.match(/^\s+workflow_model_profile:\s*(\S+)/m);
  return match ? match[1] : null;
}

/**
 * Read `metadata.workflow_invocation`, the portable declaration of whether a
 * skill is reachable by the model or only by the human. `auto` is deliberately
 * rare: only the workflow's single entry point declares it, because a gate that
 * fires on description matching is indistinguishable from a gate that was
 * skipped. Anything unreadable falls back to `explicit`, the safe direction.
 */
export function readInvocationMode(frontmatter) {
  const match = frontmatter.match(/^\s+workflow_invocation:\s*(\S+)/m);
  return match && match[1] === 'auto' ? 'auto' : 'explicit';
}

/**
 * Force the host-specific keys onto a skill's frontmatter.
 * Existing `model` / `disable-model-invocation` lines are dropped first so
 * reinstalling after a models.yaml change actually changes the mapping.
 */
export function applyHostFrontmatter(text, model) {
  const { frontmatter, body, hasFrontmatter } = splitFrontmatter(text);
  if (!hasFrontmatter) return text;

  const cleaned = frontmatter
    .split(/\r?\n/)
    .filter((line) => !/^(model|disable-model-invocation):/.test(line))
    .join('\n');

  return `---\nmodel: ${model}\ndisable-model-invocation: true\n${cleaned}\n---\n${body}`;
}

/** Parse the top-level `strategic:` / `implementation:` aliases out of models.yaml. */
export function parseModels(yamlText) {
  const read = (key) => {
    const match = yamlText.match(new RegExp(`^${key}:\\s*(\\S+)`, 'm'));
    return match ? match[1] : null;
  };
  return { strategic: read('strategic'), implementation: read('implementation') };
}

/** Map a skill's declared profile onto a concrete model alias. */
export function modelForProfile(profile, models) {
  if (profile === 'strategic') return models.strategic ?? 'inherit';
  if (profile === 'implementation') return models.implementation ?? 'inherit';
  return 'inherit';
}

/** Every skill directory in the package that actually ships a SKILL.md. */
export function listSkills(skillsSource) {
  if (!fs.existsSync(skillsSource)) return [];
  return fs
    .readdirSync(skillsSource, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(skillsSource, name, 'SKILL.md')))
    .sort();
}

/**
 * Split a frontmatter block into ordered top-level entries.
 * Indented continuation lines (the `metadata:` sub-keys) stay attached to the
 * key that opened them, so a block can be dropped or kept as one unit.
 */
export function parseFrontmatterBlocks(frontmatter) {
  const blocks = [];
  for (const line of frontmatter.split(/\r?\n/)) {
    const top = line.match(/^([A-Za-z0-9_-]+):/);
    if (top) blocks.push({ key: top[1], lines: [line] });
    else if (blocks.length > 0) blocks[blocks.length - 1].lines.push(line);
  }
  return blocks;
}

/** The scalar on a block's opening line, empty for a block that only nests. */
export function blockValue(block) {
  const match = block.lines[0].match(/^[A-Za-z0-9_-]+:\s*(.*)$/);
  return match ? match[1].trim() : '';
}

/** Render ordered blocks back into a frontmatter body (no `---` fences). */
export function renderFrontmatterBlocks(blocks) {
  return blocks
    .flatMap((block) => block.lines)
    .join('\n')
    .replace(/\n+$/, '');
}
