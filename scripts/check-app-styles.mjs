// The app has two guardrails that a code review cannot keep honest on its own:
// a colour literal written outside DESIGN.md's token block, and a document frame
// that hides its horizontal overflow.
//
// Why a script instead of a review note: apps/relayboard-web/src/styles.css
// declares DESIGN.md's tokens exactly once, and every other sheet and component
// is expected to read them. A hex value that drifts into a component sheet still
// renders, so nothing fails until someone diffs it by eye — and by then the value
// is already the source of truth. The same is true of `overflow-x: hidden` on
// html or body: it silences a broken width rather than fixing it, and it hides the
// bug behind a frame that never scrolls.
//
// Usage, from the repository root or from apps/relayboard-web — paths resolve
// from this file's own location, not from process.cwd():
//   node scripts/check-app-styles.mjs
//   npm run check:styles        (in apps/relayboard-web)
//
// Exit code is 1 when anything is found, so it drops straight into a gate.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// import.meta.url rather than process.cwd(): the repository root and the app
// directory both run this, and neither should change which tree is checked.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'apps', 'relayboard-web', 'src')

// The only file allowed to state a colour, and only inside its token block.
const TOKEN_SHEET = join(SRC, 'styles.css')
const TOKEN_BLOCK_OPEN = '@theme static {'

const SCANNED_SUFFIXES = new Set(['.css', '.ts', '.tsx'])

// A colour literal in the sense DESIGN.md means: something that fixes a value in
// place instead of naming it. Both the hex forms and the functional notations are
// caught, because either one bypasses the tokens.
const COLOUR_LITERAL =
  /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{4}\b|#[0-9a-fA-F]{3}\b|\b(?:rgb|rgba|hsl|hsla|oklch|color-mix)\(/

const FRAME = /(?<![\w-])(?:html|body)(?![\w-])/

const violations = []

/** Every scanned file beneath `src`, in a stable order for a stable report. */
const collect = (directory) => {
  const found = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) found.push(...collect(path))
    else if (SCANNED_SUFFIXES.has(extname(entry.name))) found.push(path)
  }
  return found
}

const report = (path, line, rule, text) => {
  violations.push({ path, line, rule, text })
}

// Comments are blanked rather than deleted so line numbers survive. A `{` inside
// a comment is not a block, and the token sheet's own comments quote values.
const stripComments = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))

const countBraces = (line, depth) => {
  let next = depth
  for (const character of line) {
    if (character === '{') next += 1
    else if (character === '}') next -= 1
  }
  return next
}

/**
 * The 1-based line numbers inside styles.css's `@theme static {` block: the
 * opening line, every line up to its matching closing brace, inclusive. Nothing
 * outside this range — and no other file — may hold a colour literal.
 */
const tokenBlockLines = (text) => {
  const lines = stripComments(text).split('\n')
  const allowed = new Set()
  let depth = 0
  // Tracked separately from `depth`: every later block also has depth > 0, so
  // reusing `depth` would quietly excuse every rule that follows the token block.
  let inTokenBlock = false
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!inTokenBlock && depth === 0 && line.includes(TOKEN_BLOCK_OPEN)) {
      inTokenBlock = true
    }
    if (inTokenBlock) allowed.add(index + 1)
    depth = countBraces(line, depth)
    if (inTokenBlock && depth === 0) inTokenBlock = false
  }
  return allowed
}

const checkColourLiterals = (path, lines, allowedLines) => {
  for (let index = 0; index < lines.length; index += 1) {
    if (allowedLines.has(index + 1)) continue
    if (!COLOUR_LITERAL.test(lines[index])) continue
    report(path, index + 1, 'no-literal-colour', lines[index])
  }
}

/**
 * Rule 2: a rule whose selector names html or body must not set `overflow` or
 * `overflow-x` to hidden. One pass, one stack of open block selectors — enough to
 * find the declaration in the rule that owns it, including rules nested in an
 * at-rule such as `@layer base`.
 */
const checkFrameClip = (path, lines) => {
  const source = stripComments(lines.join('\n'))
  const open = []
  let buffer = ''
  let bufferLine = 1
  let line = 1

  const inspect = () => {
    const declaration = buffer.trim()
    const declarationLine = bufferLine
    buffer = ''
    if (declaration === '' || declaration.startsWith('@')) return
    const colon = declaration.indexOf(':')
    if (colon < 0) return
    const property = declaration.slice(0, colon).trim().toLowerCase()
    if (property !== 'overflow' && property !== 'overflow-x') return
    const value = declaration
      .slice(colon + 1)
      .replace(/!important/i, '')
      .trim()
      .toLowerCase()
    if (value !== 'hidden') return
    const selector = [...open].reverse().find((block) => !block.selector.startsWith('@'))
    if (!selector || !FRAME.test(selector.selector)) return
    report(path, declarationLine, 'no-frame-clip', lines[declarationLine - 1])
  }

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (character === '\n') {
      line += 1
      // Keep the newline out of the buffer: it only matters for whitespace splitting.
      if (buffer !== '') buffer += ' '
      continue
    }
    if (character === '{') {
      open.push({ selector: buffer.trim() })
      buffer = ''
      continue
    }
    if (character === '}') {
      // Inspect before popping: the last declaration in a block may omit its
      // semicolon, and a dropped declaration is a silently passing check.
      inspect()
      open.pop()
      buffer = ''
      continue
    }
    if (character === ';') {
      inspect()
      continue
    }
    // Leading whitespace is buffered too, so the line is only "started" once the
    // buffer holds something other than whitespace.
    if (buffer.trim() === '') bufferLine = line
    buffer += character
  }
}

if (!existsSync(SRC)) {
  console.error(`check-app-styles: no source directory at ${SRC}`)
  process.exit(1)
}

const tokenAllowed = tokenBlockLines(readFileSync(TOKEN_SHEET, 'utf8'))

for (const file of collect(SRC).sort()) {
  const path = relative(ROOT, file).split(sep).join('/')
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')

  // Rule 1 covers .css, .ts and .tsx alike; rule 2 is a CSS rule, because that is
  // the only place a frame can be clipped by a stylesheet.
  checkColourLiterals(path, lines, file === TOKEN_SHEET ? tokenAllowed : new Set())
  if (extname(file) === '.css') checkFrameClip(path, lines)
}

violations.sort((a, b) => (a.path === b.path ? a.line - b.line : a.path < b.path ? -1 : 1))

for (const violation of violations) {
  const text = violation.text.trim()
  console.log(`${violation.path}:${violation.line}: ${violation.rule} ${text}`)
}

if (violations.length > 0) {
  console.log(`check-app-styles: ${violations.length} violation(s)`)
  process.exit(1)
}

console.log('check-app-styles: clean')
