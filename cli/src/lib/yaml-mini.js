// yaml-mini — minimal YAML parser for index.yaml only.
//
// Why this exists: lint MVP (PR2 / T7) must read .sr-harness/knowledge/index.yaml
// without adding a YAML dependency to cli/package.json (INV-8 — zero new npm
// dependencies). The fixture's JSON sibling is what tests/AJV use, but in
// production the on-disk file is YAML and operators edit it by hand.
//
// Supported subset (sufficient for index.yaml + .meta.json-style files):
//   - Top-level mapping with `key: value` and nested mappings (2-space indent)
//   - Scalars: strings (bare / 'single-quoted' / "double-quoted"), integers,
//     booleans (`true`/`false`/`yes`/`no`), null literals (`null`/`~`/empty)
//   - Block sequences:    `- value`    (scalar items)
//   - Sequences of maps:  `- key: val` followed by indented siblings
//   - Comments after `#` (full-line and trailing) on bare scalars
//
// NOT supported (out of scope — we control index.yaml's shape):
//   - Anchors (`&name`) / aliases (`*name`)
//   - Multi-document (`---` separators)
//   - Flow style (`{a: 1, b: 2}` or `[1, 2]`)
//   - Block scalars (`|`, `>`)
//   - Tags (`!!str`)
//   - Mixed indent (must be 2 spaces, no tabs)
//
// On unsupported input the parser throws `YamlMiniParseError` with a 1-based
// line number so callers can surface a useful message (lint should not crash —
// it should report "could not parse index.yaml at line N: ...").

export class YamlMiniParseError extends Error {
  constructor(message, line) {
    super(line ? `line ${line}: ${message}` : message);
    this.name = 'YamlMiniParseError';
    this.line = line;
  }
}

const INDENT = 2;

/**
 * Parse a YAML string in the index.yaml subset described above.
 *
 * @param {string} src - YAML text (LF or CRLF; both work).
 * @returns {*} parsed object/array/scalar.
 * @throws {YamlMiniParseError}
 */
export function parse(src) {
  if (typeof src !== 'string') {
    throw new YamlMiniParseError('input must be a string');
  }
  const lines = src.replace(/\r\n?/g, '\n').split('\n');

  // Pre-process: strip trailing comments + blanks while keeping line numbers
  // so error messages stay accurate. We pass the raw line + 1-based index.
  const tokens = [];
  for (let i = 0; i < lines.length; i += 1) {
    const lineNo = i + 1;
    const raw = lines[i];
    const stripped = stripComment(raw);
    if (stripped.trim() === '') continue;
    if (/^---\s*$/.test(stripped) || /^\.\.\.\s*$/.test(stripped)) {
      throw new YamlMiniParseError('multi-document YAML not supported', lineNo);
    }
    if (/\t/.test(stripped.match(/^\s*/)[0])) {
      throw new YamlMiniParseError('tab indentation not supported (use 2 spaces)', lineNo);
    }
    const indentChars = stripped.match(/^ */)[0].length;
    if (indentChars % INDENT !== 0) {
      throw new YamlMiniParseError(
        `indent must be multiple of ${INDENT} spaces (got ${indentChars})`,
        lineNo,
      );
    }
    tokens.push({ line: lineNo, indent: indentChars, content: stripped.slice(indentChars) });
  }

  if (tokens.length === 0) return null;

  const ctx = { tokens, idx: 0 };
  const value = parseBlock(ctx, 0);
  if (ctx.idx < tokens.length) {
    throw new YamlMiniParseError(
      `unexpected content at indent ${tokens[ctx.idx].indent}`,
      tokens[ctx.idx].line,
    );
  }
  return value;
}

/* ------------------------------------------------------------------ */
/*  Block-level dispatch                                              */
/* ------------------------------------------------------------------ */

function parseBlock(ctx, indent) {
  const tok = peek(ctx);
  if (!tok || tok.indent < indent) return null;
  if (tok.indent !== indent) {
    throw new YamlMiniParseError(
      `expected indent ${indent}, got ${tok.indent}`,
      tok.line,
    );
  }
  if (tok.content.startsWith('- ') || tok.content === '-') {
    return parseSequence(ctx, indent);
  }
  return parseMapping(ctx, indent);
}

/* ------------------------------------------------------------------ */
/*  Mappings                                                          */
/* ------------------------------------------------------------------ */

function parseMapping(ctx, indent) {
  const out = {};
  while (true) {
    const tok = peek(ctx);
    if (!tok || tok.indent < indent) break;
    if (tok.indent > indent) {
      throw new YamlMiniParseError(
        `unexpected indent (got ${tok.indent}, expected ${indent})`,
        tok.line,
      );
    }
    if (tok.content.startsWith('- ') || tok.content === '-') {
      // a sequence item appearing where a mapping key was expected → caller
      // must have been parsing a sequence already; treat as boundary.
      break;
    }
    const { key, rest } = splitKeyValue(tok);
    advance(ctx);
    if (rest === '') {
      // Either nested mapping/sequence at indent+2, OR a "compact" same-indent
      // block sequence (PyYAML default style: `key:` followed by `- item` at
      // the SAME indent as the key). Both are valid YAML 1.2.
      const child = peek(ctx);
      if (child && child.indent === indent + INDENT) {
        out[key] = parseBlock(ctx, indent + INDENT);
      } else if (
        child &&
        child.indent === indent &&
        (child.content.startsWith('- ') || child.content === '-')
      ) {
        out[key] = parseSequence(ctx, indent);
      } else {
        out[key] = null;
      }
    } else {
      out[key] = parseScalar(rest, tok.line);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Sequences                                                         */
/* ------------------------------------------------------------------ */

function parseSequence(ctx, indent) {
  const out = [];
  while (true) {
    const tok = peek(ctx);
    if (!tok || tok.indent < indent) break;
    if (tok.indent !== indent) {
      throw new YamlMiniParseError(
        `expected sequence at indent ${indent}, got ${tok.indent}`,
        tok.line,
      );
    }
    if (!(tok.content.startsWith('- ') || tok.content === '-')) break;

    // Bare `-` (no inline content): block-scalar-or-mapping at indent+2.
    if (tok.content === '-') {
      advance(ctx);
      const child = peek(ctx);
      if (child && child.indent === indent + INDENT) {
        out.push(parseBlock(ctx, indent + INDENT));
      } else {
        out.push(null);
      }
      continue;
    }

    const inline = tok.content.slice(2); // strip "- "
    if (looksLikeKey(inline)) {
      // Sequence-of-mappings: synthesize a mapping where the first key is
      // inlined on the dash line and subsequent siblings live at indent+2.
      const fakeIndent = indent + INDENT;
      // Replace this token with a synthetic one positioned at indent+2 so the
      // generic mapping parser can consume it (and its trailing siblings).
      ctx.tokens[ctx.idx] = { line: tok.line, indent: fakeIndent, content: inline };
      out.push(parseMapping(ctx, fakeIndent));
    } else {
      advance(ctx);
      out.push(parseScalar(inline, tok.line));
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Scalars                                                           */
/* ------------------------------------------------------------------ */

function parseScalar(raw, line) {
  const s = raw.trim();
  if (s === '' || s === '~' || s.toLowerCase() === 'null') return null;
  if (s === 'true' || s === 'True' || s.toLowerCase() === 'yes') return true;
  if (s === 'false' || s === 'False' || s.toLowerCase() === 'no') return false;
  if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    return decodeDoubleQuoted(s.slice(1, -1), line);
  }
  // Integer (positive only — KB schema does not store negatives).
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  // Float (rare in index.yaml, but be generous).
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
  return s;
}

function decodeDoubleQuoted(body, line) {
  let out = '';
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i];
    if (c === '\\' && i + 1 < body.length) {
      const next = body[i + 1];
      const map = { n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\', "'": "'" };
      if (Object.prototype.hasOwnProperty.call(map, next)) {
        out += map[next];
        i += 1;
      } else {
        throw new YamlMiniParseError(`unsupported escape '\\${next}'`, line);
      }
    } else {
      out += c;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function peek(ctx) {
  return ctx.tokens[ctx.idx];
}

function advance(ctx) {
  ctx.idx += 1;
}

function looksLikeKey(s) {
  // Matches `key:` or `key: value`. Skips quoted strings starting with '-' etc.
  if (s.startsWith('"') || s.startsWith("'")) return false;
  return /^[^\s:][^:]*:(\s|$)/.test(s);
}

function splitKeyValue(tok) {
  // Split on the FIRST `:` that is not inside quotes.
  const content = tok.content;
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < content.length; i += 1) {
    const c = content[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === ':' && !inSingle && !inDouble) {
      const key = content.slice(0, i).trim();
      const rest = content.slice(i + 1).trim();
      if (!key) throw new YamlMiniParseError('mapping key is empty', tok.line);
      return { key: stripQuotes(key), rest };
    }
  }
  throw new YamlMiniParseError(`expected mapping ':' in '${content}'`, tok.line);
}

function stripQuotes(k) {
  if (k.startsWith("'") && k.endsWith("'") && k.length >= 2) return k.slice(1, -1);
  if (k.startsWith('"') && k.endsWith('"') && k.length >= 2) return k.slice(1, -1);
  return k;
}

function stripComment(line) {
  // Remove `#`-comments not inside quotes. Handles trailing comments.
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === '#' && !inSingle && !inDouble) {
      return line.slice(0, i).replace(/\s+$/, '');
    }
  }
  return line.replace(/\s+$/, '');
}
