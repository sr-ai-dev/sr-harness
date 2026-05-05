// Settings reader for sr-harness feature flags.
//
// Resolution order (highest precedence first):
//   1. <cwd>/.claude/settings.json (project-level override)
//   2. ~/.claude/settings.json (user-level)
//
// All reads are cached per process per resolved file path. Missing files and
// invalid JSON are tolerated: the helper falls back to the next layer or the
// caller-supplied default and emits a one-time warning to stderr.
//
// See requirements.md R-T10.1 (feature-flag gating per PR) and design.md §3.5
// for the per-PR flag table consumed by this helper.

import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';

const _cache = new Map();
const _warnedFiles = new Set();

function loadSettings(path) {
  if (_cache.has(path)) return _cache.get(path);
  if (!existsSync(path)) {
    _cache.set(path, null);
    return null;
  }
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw);
    _cache.set(path, parsed);
    return parsed;
  } catch (err) {
    if (!_warnedFiles.has(path)) {
      _warnedFiles.add(path);
      process.stderr.write(
        `[sr-harness settings] ignoring invalid JSON at ${path}: ${err.message}\n`,
      );
    }
    _cache.set(path, null);
    return null;
  }
}

function settingsPaths(cwd) {
  const home = homedir();
  return {
    user: join(home, '.claude', 'settings.json'),
    project: resolve(cwd, '.claude', 'settings.json'),
  };
}

/**
 * Read a single feature flag.
 *
 * Project-level (`<cwd>/.claude/settings.json`) overrides user-level
 * (`~/.claude/settings.json`). When the flag is absent in both layers the
 * supplied default is returned. Non-boolean values are returned as-is so the
 * caller can apply its own type semantics (e.g. integer tuning knobs like
 * `graphify_hub_n`).
 *
 * @param {string} name - flag key (e.g. `kb_topics_lookup`).
 * @param {*} [defaultValue=false] - returned when the flag is absent.
 * @param {{ cwd?: string }} [opts] - override the cwd used for project lookup.
 * @returns {*} resolved flag value.
 */
export function getFlag(name, defaultValue = false, opts = {}) {
  const cwd = opts.cwd ?? process.cwd();
  const { user, project } = settingsPaths(cwd);

  const proj = loadSettings(project);
  if (proj && Object.prototype.hasOwnProperty.call(proj, name)) {
    return proj[name];
  }
  const usr = loadSettings(user);
  if (usr && Object.prototype.hasOwnProperty.call(usr, name)) {
    return usr[name];
  }
  return defaultValue;
}

/**
 * Batch-read multiple feature flags. Each requested flag uses the same
 * resolution order as {@link getFlag}; absent flags resolve to `false` unless
 * the caller passes a `defaults` map.
 *
 * @param {string[]} names - flag keys to resolve.
 * @param {{ cwd?: string, defaults?: Record<string, *> }} [opts]
 * @returns {Record<string, *>}
 */
export function getFlags(names, opts = {}) {
  const cwd = opts.cwd ?? process.cwd();
  const defaults = opts.defaults ?? {};
  const out = {};
  for (const name of names) {
    out[name] = getFlag(name, defaults[name] ?? false, { cwd });
  }
  return out;
}

/**
 * Reset the in-memory cache. Intended for tests; production code should rely
 * on cache hits across the process lifetime.
 */
export function _resetSettingsCache() {
  _cache.clear();
  _warnedFiles.clear();
}
