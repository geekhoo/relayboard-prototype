import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { InvalidSkillNameError } from './types.js'
import type { SkillFrontmatter, SkillRecord, SkillType } from './types.js'

export * from './types.js'

/** npm package name that owns these skills. */
export const PACKAGE_NAME = '@relayboard/skills'

/** Version of this package; also the `metadata.library_version` the skills claim. */
export const PACKAGE_VERSION = '0.1.0'

const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Directory of the built package root (`dist/..`). */
export const packageRoot: string = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Directory holding `skills/<name>/SKILL.md`. */
export const skillsDirectory: string = join(packageRoot, 'skills')

/** Directory holding the source documentation each skill points at. */
export const docsDirectory: string = join(packageRoot, 'docs')

/** Reject a name Intent could not accept as a `skills/<name>` directory leaf. */
export function assertSkillName(value: string): void {
  if (value.length === 0 || value.length > 64 || !SKILL_NAME_PATTERN.test(value)) {
    throw new InvalidSkillNameError(value)
  }
}

/** Absolute path of a skill's `SKILL.md`. */
export function skillPath(name: string): string {
  assertSkillName(name)
  return join(skillsDirectory, name, 'SKILL.md')
}

/** The portable identity used by `npx intent load`, e.g. `@relayboard/skills#relayboard-identity`. */
export function skillUse(name: string): string {
  assertSkillName(name)
  return `${PACKAGE_NAME}#${name}`
}

/** Resolve a skill name to its record, throwing when the file is not shipped. */
export function resolveSkill(name: string): SkillRecord {
  const path = skillPath(name)
  if (!existsSync(path)) {
    throw new Error(`Skill ${JSON.stringify(name)} is not present at ${path}.`)
  }
  return { name, use: skillUse(name), skillPath: path, packageRoot }
}

/** Parse the small YAML subset these skills use: scalars, `>-` blocks, maps, and scalar lists. */
export function readFrontmatter(markdown: string): Record<string, unknown> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown)
  if (match === null || match[1] === undefined) {
    throw new Error('Expected SKILL.md to open with a --- frontmatter block.')
  }
  return parseYamlSubset(match[1])
}

function parseYamlSubset(text: string): Record<string, unknown> {
  const lines = text.split(/\r?\n/)
  const indentOf = (line: string): number => line.length - line.trimStart().length
  const isBlank = (line: string): boolean => line.trim() === ''
  let index = 0

  const nextMeaningful = (from: number): number => {
    let cursor = from
    while (cursor < lines.length && isBlank(lines[cursor] ?? '')) cursor += 1
    return cursor
  }

  const parseList = (indent: number): unknown[] => {
    const items: unknown[] = []
    while (index < lines.length) {
      const line = lines[index] ?? ''
      if (isBlank(line)) {
        index += 1
        continue
      }
      if (indentOf(line) < indent) break
      const item = /^\s*-\s+(.*)$/.exec(line)
      if (item === null) break
      items.push(unquote(item[1] ?? ''))
      index += 1
    }
    return items
  }

  const parseMap = (indent: number): Record<string, unknown> => {
    const result: Record<string, unknown> = {}
    while (index < lines.length) {
      const line = lines[index] ?? ''
      if (isBlank(line)) {
        index += 1
        continue
      }
      if (indentOf(line) < indent) break
      const entry = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line.trim())
      if (entry === null) {
        index += 1
        continue
      }
      const key = entry[1] ?? ''
      const rest = (entry[2] ?? '').trim()
      index += 1

      if (rest === '') {
        const lookahead = nextMeaningful(index)
        const candidate = lines[lookahead]
        if (candidate !== undefined && /^\s*-\s+/.test(candidate)) {
          result[key] = parseList(indentOf(candidate))
        } else if (candidate !== undefined && indentOf(candidate) > indent) {
          result[key] = parseMap(indentOf(candidate))
        } else {
          result[key] = ''
        }
        continue
      }

      if (rest === '>-' || rest === '>' || rest === '|' || rest === '|-') {
        const parts: string[] = []
        while (index < lines.length) {
          const blockLine = lines[index] ?? ''
          if (isBlank(blockLine)) {
            parts.push('')
            index += 1
            continue
          }
          if (indentOf(blockLine) <= indent) break
          parts.push(blockLine.trim())
          index += 1
        }
        result[key] = parts.join(' ').replace(/\s+/g, ' ').trim()
        continue
      }

      result[key] = unquote(rest)
    }
    return result
  }

  return parseMap(0)
}

function unquote(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2) {
    const first = trimmed[0]
    const last = trimmed[trimmed.length - 1]
    if ((first === "'" && last === "'") || (first === '"' && last === '"')) {
      return trimmed.slice(1, -1)
    }
  }
  return trimmed
}

const SKILL_TYPES: readonly SkillType[] = [
  'core',
  'sub-skill',
  'framework',
  'lifecycle',
  'composition',
  'security',
]

/** Narrow the parsed `metadata` map into a checked `SkillFrontmatter`. */
export function parseSkillFrontmatter(markdown: string): SkillFrontmatter {
  const parsed = readFrontmatter(markdown)
  const name = String(parsed['name'] ?? '')
  const description = String(parsed['description'] ?? '')
  const metadataValue = parsed['metadata']
  if (typeof metadataValue !== 'object' || metadataValue === null || Array.isArray(metadataValue)) {
    throw new Error(`Skill ${JSON.stringify(name)} has no metadata mapping.`)
  }
  const metadata = metadataValue as Record<string, unknown>
  const type = String(metadata['type'] ?? '')
  if (!SKILL_TYPES.includes(type as SkillType)) {
    throw new Error(`Skill ${JSON.stringify(name)} has an unsupported metadata.type ${JSON.stringify(type)}.`)
  }
  const sourcesValue = parsed['sources']
  const sources = Array.isArray(sourcesValue) ? sourcesValue.map(String) : []
  const requiresValue = parsed['requires']
  const framework = metadata['framework']

  return {
    name,
    description,
    metadata: {
      purpose: String(metadata['purpose'] ?? ''),
      type: type as SkillType,
      library: String(metadata['library'] ?? ''),
      library_version: String(metadata['library_version'] ?? ''),
      ...(typeof framework === 'string' ? { framework } : {}),
    },
    sources,
    ...(Array.isArray(requiresValue) ? { requires: requiresValue.map(String) } : {}),
  }
}

/** The skills this release ships, in the order the package documents them. */
export const SKILL_NAMES = [
  'relayboard-thread-sequencing',
  'relayboard-mock-api',
  'relayboard-identity',
] as const

export type SkillName = (typeof SKILL_NAMES)[number]

/** Typed listing of every shipped skill. */
export function listSkills(): readonly SkillRecord[] {
  return SKILL_NAMES.map((name) => resolveSkill(name))
}
