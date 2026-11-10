<!-- intent-skills:start -->
## Skill Loading

Use the repository’s installed Intent. If it is unavailable, report the missing dependency instead of downloading a replacement.
Before editing files for a substantial task:
- Run `npm exec --no -- intent list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `npm exec --no -- intent load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

## Local correction: run these commands in this directory

The generated block above says "from the workspace root". In this repository that
instruction is wrong, and following it finds nothing:

- `apps/relayboard-web` is where `@relayboard/skills` is installed and where
  `package.json#intent.skills` declares the allowlist. Run `intent list` and
  `intent load` **here**.
- Run from the repository root instead, and you get
  `No intent-enabled packages found.` (`npx intent list` there reports zero
  packages) — the root manifest sets no allowlist, and the package under
  `packages/relayboard-skills` is not linked into a `node_modules` tree.
- `@tanstack/intent` itself is a devDependency of the **root** manifest, not of this
  package. `npx intent …` here resolves the root copy by walking up to the root
  `node_modules/.bin`; that works today because of the directory layout, not because
  of a declaration.

The allowlist and exclusion that shape what you can load:

```json
"intent": {
  "skills": ["@relayboard/skills"],
  "exclude": ["@relayboard/skills#relayboard-identity"]
}
```

`relayboard-thread-sequencing` and `relayboard-mock-api` are loadable.
`relayboard-identity` is excluded because its guidance needs a principal read
(`getPrincipal`) that `window.RelayboardMockAPI` does not expose; remove the
exclusion only after that endpoint exists.

See [`../../INTENT.md`](../../INTENT.md) for the full workflow, and
[`NOTES.md`](NOTES.md) §11 for the raw command output behind these statements.
