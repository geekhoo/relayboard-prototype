/**
 * Public types for the Relayboard Agent Skills package.
 *
 * The skills themselves are Markdown data shipped in `skills/`; these types
 * describe that data so tooling (and consumers writing their own checks) can
 * treat skill metadata as a typed value instead of an untyped object.
 */

/** The activation scalars Intent expects to find under `metadata`. */
export interface SkillMetadata {
  /** One-line explanation of what the skill is for (kept separate from activation). */
  readonly purpose: string
  /** Intent skill type: `core`, `sub-skill`, `framework`, `lifecycle`, `composition`, `security`. */
  readonly type: SkillType
  /** npm package name that owns the skill. */
  readonly library: string
  /** Version of the library the guidance was verified against. */
  readonly library_version: string
  /** Framework name, only for `framework` skills. */
  readonly framework?: string
}

export type SkillType =
  | 'core'
  | 'sub-skill'
  | 'framework'
  | 'lifecycle'
  | 'composition'
  | 'security'

/** Frontmatter of a `skills/<name>/SKILL.md` file, as Intent reads it. */
export interface SkillFrontmatter {
  /** Single leaf segment matching the parent directory name. */
  readonly name: string
  /** Agent-discovery text: concrete "Use when ..." conditions. */
  readonly description: string
  readonly metadata: SkillMetadata
  /** Source documentation paths, relative to the package root. */
  readonly sources: readonly string[]
  /** Prerequisite skill names in the same package. */
  readonly requires?: readonly string[]
}

/** A skill identity resolved inside this package. */
export interface SkillRecord {
  /** Leaf name, also the directory under `skills/`. */
  readonly name: string
  /** Portable identity used by `npx intent load`, e.g. `@relayboard/skills#relayboard-mock-api`. */
  readonly use: string
  /** Absolute path of the `SKILL.md` file. */
  readonly skillPath: string
  /** Absolute path of the package root that owns the skill. */
  readonly packageRoot: string
}

/** Error raised when a skill name cannot be a directory leaf segment. */
export class InvalidSkillNameError extends Error {
  override readonly name = 'InvalidSkillNameError'

  constructor(readonly value: string) {
    super(
      `Invalid skill name ${JSON.stringify(value)}: expected lowercase letters, digits and single hyphens, at most 64 characters.`,
    )
  }
}
