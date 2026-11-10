# Consumer verification for @relayboard/skills

Throwaway project used to verify the packed tarball through the Intent CLI. It is
excluded from the published package (`package.json#files` lists only `dist`,
`skills`, `docs`), so nothing here reaches npm. Its own project files are committed
so the sequence below stays reproducible; only the installed dependencies and the
generated lockfile are ignored.

Steps, all run from this directory:

0. Produce the tarball first, from the package root: `npm pack --ignore-scripts`
   writes `relayboard-skills-0.1.0.tgz` there. It is git-ignored (`*.tgz`), so a
   clean clone must generate it before step 2 can resolve.
1. `npm install` — installs `@tanstack/intent@0.5.6` from devDependencies.
2. `npm install ../relayboard-skills-0.1.0.tgz` — installs the real packed
   tarball, not a symlink to the source directory.
3. Set `package.json#intent.skills` to an explicit allowlist and run
   `npx intent list`.
4. `npx intent load @relayboard/skills#<skill>` prints the shipped `SKILL.md`.
5. `npx intent exclude add '@relayboard/skills#<skill>'` removes exactly that
   skill while the allowlist stays untouched.
6. With no allowlist, every discovered package surfaces with a migration notice;
   with an allowlist, unlisted packages are omitted and reported, and a skill
   shipped by a dependency of a listed package stays hidden — trust does not
   propagate.

`run-demo.ps1` reproduces the sequence and prints the real command output.
