/**
 * Small dependency-free CLI over the typed skill inventory.
 *
 * `relayboard-skills list` prints the shipped skills and their `intent load`
 * identities; `relayboard-skills check` re-verifies the invariants that
 * `intent validate` cannot know about this package: that every skill claims
 * this package name and release, and that every declared source document is
 * present in the published tree.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  PACKAGE_NAME,
  PACKAGE_VERSION,
  SKILL_NAMES,
  listSkills,
  packageRoot,
  parseSkillFrontmatter,
  resolveSkill,
} from './index.js'

interface Problem {
  readonly skill: string
  readonly message: string
}

const readSkill = (name: string): string => readFileSync(resolveSkill(name).skillPath, 'utf8')

function describe(): string {
  const lines = SKILL_NAMES.map((name) => {
    const record = resolveSkill(name)
    const frontmatter = parseSkillFrontmatter(readSkill(name))
    return `${record.use}\n  ${frontmatter.metadata.purpose || frontmatter.description}`
  })
  return [`${PACKAGE_NAME}@${PACKAGE_VERSION} — ${SKILL_NAMES.length} skills`, ...lines].join('\n')
}

function check(): number {
  const problems: Problem[] = []
  const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
    readonly name?: string
    readonly version?: string
    readonly keywords?: readonly string[]
  }

  if (manifest.name !== PACKAGE_NAME) {
    problems.push({ skill: '.', message: `package name ${String(manifest.name)} !== ${PACKAGE_NAME}` })
  }
  if (manifest.version !== PACKAGE_VERSION) {
    problems.push({ skill: '.', message: `package version ${String(manifest.version)} !== ${PACKAGE_VERSION}` })
  }
  if (!(manifest.keywords ?? []).includes('tanstack-intent')) {
    problems.push({ skill: '.', message: 'package.json keywords are missing "tanstack-intent"' })
  }

  for (const record of listSkills()) {
    const frontmatter = parseSkillFrontmatter(readSkill(record.name))
    if (frontmatter.name !== record.name) {
      problems.push({ skill: record.name, message: `frontmatter name ${frontmatter.name} !== ${record.name}` })
    }
    if (frontmatter.metadata.library !== PACKAGE_NAME) {
      problems.push({ skill: record.name, message: `metadata.library ${frontmatter.metadata.library} !== ${PACKAGE_NAME}` })
    }
    if (frontmatter.metadata.library_version !== PACKAGE_VERSION) {
      problems.push({
        skill: record.name,
        message: `metadata.library_version ${frontmatter.metadata.library_version} !== ${PACKAGE_VERSION}`,
      })
    }
    if (frontmatter.sources.length === 0) {
      problems.push({ skill: record.name, message: 'no sources declared' })
    }
    for (const source of frontmatter.sources) {
      if (source.includes(':')) {
        problems.push({ skill: record.name, message: `source ${source} must be package-relative` })
      }
    }
    const documentation = frontmatter.sources.filter((source) => source.startsWith('docs/'))
    if (documentation.length === 0) {
      problems.push({ skill: record.name, message: 'no docs/ source document declared' })
    }
    for (const source of documentation) {
      try {
        readFileSync(join(packageRoot, source), 'utf8')
      } catch {
        problems.push({ skill: record.name, message: `source document ${source} is missing from the package` })
      }
    }
  }

  if (problems.length === 0) {
    process.stdout.write(`✓ ${SKILL_NAMES.length} skills consistent with ${PACKAGE_NAME}@${PACKAGE_VERSION}\n`)
    return 0
  }
  for (const problem of problems) process.stderr.write(`✗ ${problem.skill}: ${problem.message}\n`)
  process.stderr.write(`✗ ${problems.length} problem(s)\n`)
  return 1
}

const command = process.argv[2] ?? 'list'
switch (command) {
  case 'list':
    process.stdout.write(`${describe()}\n`)
    break
  case 'check':
    process.exitCode = check()
    break
  case '--help':
  case 'help':
    process.stdout.write(
      'Usage: relayboard-skills <list|check>\n\n  list   print shipped skills and their intent load identities\n  check  verify package/skill metadata invariants\n',
    )
    break
  default:
    process.stderr.write(`Unknown command ${JSON.stringify(command)}. Try: list, check\n`)
    process.exitCode = 2
}
