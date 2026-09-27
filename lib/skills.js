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
