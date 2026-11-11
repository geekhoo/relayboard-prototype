# 15c: The agent skills stop describing the prototype, and the port is recorded as a decision

**From:** 15 — Parity with the prototype, proven and documented

**What to build:** The repository's own agent guidance becomes true again, and the retirement of the static prototype becomes a deliberate act with a written record. The two shipped skills are rewritten against the app rather than `window.RelayboardMockAPI`; the `relayboard-identity` exclusion is removed now that a principal read exists; the skill review gate passes; and a one-page record states what was carried across verbatim, what changed, and why.

**Blocked by:** 15b — `QA.md`, `DESIGN.md` and `PRODUCT.md` catch up with the app

**Write scope:** the skills package, its docs, `INTENT.md` and the root `AGENTS.md`; and the repack of the vendored tarball the app consumes.

**Status:** ready-for-agent

- [ ] `relayboard-mock-api` is rewritten to describe the app's transport. It no longer documents `appendMessage({ authorId, … })` — `packages/relayboard-skills/docs/mock-api.md` L22 still does, and the signature was superseded at spec L377 — and it points at the operation vocabulary a caller actually has rather than at a `window` global.
- [ ] `relayboard-thread-sequencing` is corrected where it claims a thread's entries are messages. Its rule that reading is "order by `seq`, filter by thread" stays true and stays worded the same way; the entry kinds it now has to mention are message, artifact, status move and acknowledgement (spec L441–444).
- [ ] `relayboard-identity`'s guidance is rewritten against the app's principal read, and its exclusion is **removed** from `apps/relayboard-web/package.json`'s `intent.exclude` (L48–50). The exclusion existed because the prototype had no `getPrincipal`; ticket 12 consumes one (review §5-D). If it cannot be removed, the blocking reason is recorded in the file rather than left as a stale exclusion.
- [ ] The honesty rules that skill already had survive the rewrite: issuer is declared and never a verification result; a derived value may look verified and a declared one never may (spec L463). The rewrite sharpens them rather than relaxing them.
- [ ] The skills teach that demo content is demo-origin, so an agent reading a seeded board expects a purge rather than being surprised by one (spec L488).
- [ ] The skills teach the permission model as "ask for the permission you need" rather than "call the method", so a permission that exists in code and in no skill is a visible gap (spec L467).
- [ ] The skill review gate passes: `npm run skills:check` at the repository root, and `npm run skills:validate` — both exit 0, with the commands and their output recorded the way `apps/relayboard-web/NOTES.md` records its proofs.
- [ ] **The package is repacked and the vendored tarball the app actually loads is replaced** (`npm pack ./packages/relayboard-skills` → copy into `apps/relayboard-web/vendor/` → `npm install` in the app). The gate above reads the source tree and never `vendor/`, so without this the app keeps serving the old, prototype-describing guidance from a green build. Proof that the app loads the new bytes: `npx intent list --json` run **in `apps/relayboard-web`** no longer lists `@relayboard/skills#relayboard-identity` under exclusions, and `npx intent load @relayboard/skills#relayboard-identity` succeeds — both read through the installed package, so a stale tarball fails them.
- [ ] `INTENT.md` or the package's `AGENTS.md` is updated if the allowlist or exclusion change affects what a consumer can load, so the documentation of the wiring matches the wiring.
- [ ] A one-page record exists stating which parts of the prototype were carried across verbatim, which changed, and why — so retiring the static prototype is a deliberate act rather than a delete (spec L626 keeps the deletion itself out of scope).
- [ ] The record states what was *not* carried across and why (the `localStorage` store, the `authorId`-bearing signature, the simulated stream, the theme toggle), so a future reader cannot mistake an omission for a regression.

**Leaves the build green:** yes. No application code changes; the repository's guidance becomes true.
