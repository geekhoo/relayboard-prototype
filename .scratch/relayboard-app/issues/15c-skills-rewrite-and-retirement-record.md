# 15c: The agent skills stop describing the prototype, and the port is recorded as a decision

**From:** 15 — Parity with the prototype, proven and documented

**What to build:** The repository's own agent guidance becomes true again, and the retirement of the static prototype becomes a deliberate act with a written record. The two shipped skills are rewritten against the app rather than `window.RelayboardMockAPI`; the `relayboard-identity` exclusion is removed now that a principal read exists; the skill review gate passes; and a one-page record states what was carried across verbatim, what changed, and why.

**Blocked by:** 15b — `QA.md`, `DESIGN.md` and `PRODUCT.md` catch up with the app

**Write scope:** the skills package, its docs, `INTENT.md` and the root `AGENTS.md`; and the repack of the vendored tarball the app consumes.

**Status:** done — verified; see `## Comments`

- [x] `relayboard-mock-api` is rewritten to describe the app's transport. It no longer documents `appendMessage({ authorId, … })` — `packages/relayboard-skills/docs/mock-api.md` L22 still does, and the signature was superseded at spec L379 — and it points at the operation vocabulary a caller actually has rather than at a `window` global.
- [x] `relayboard-thread-sequencing` is corrected where it claims a thread's entries are messages. Its rule that reading is "order by `seq`, filter by thread" stays true and stays worded the same way; the entry kinds it now has to mention are message, artifact, status move and acknowledgement (spec L443–446).
- [x] `relayboard-identity`'s guidance is rewritten against the app's principal read, and its exclusion is **removed** from `apps/relayboard-web/package.json`'s `intent.exclude` (L48–50). The exclusion existed because the prototype had no `getPrincipal`; ticket 12 consumes one (review §5-D). If it cannot be removed, the blocking reason is recorded in the file rather than left as a stale exclusion.
- [x] The honesty rules that skill already had survive the rewrite: issuer is declared and never a verification result; a derived value may look verified and a declared one never may (spec L465). The rewrite sharpens them rather than relaxing them.
- [x] The skills teach that demo content is demo-origin, so an agent reading a seeded board expects a purge rather than being surprised by one (spec L490).
- [x] The skills teach the permission model as "ask for the permission you need" rather than "call the method", so a permission that exists in code and in no skill is a visible gap (spec L469).
- [x] The skill review gate passes: `npm run skills:check` at the repository root, and `npm run skills:validate` — both exit 0, with the commands and their output recorded the way `apps/relayboard-web/NOTES.md` records its proofs.
- [x] **The package is repacked and the vendored tarball the app actually loads is replaced** (`npm pack ./packages/relayboard-skills` → copy into `apps/relayboard-web/vendor/` → `npm install` in the app). The gate above reads the source tree and never `vendor/`, so without this the app keeps serving the old, prototype-describing guidance from a green build. Proof that the app loads the new bytes: `npx intent list --json` run **in `apps/relayboard-web`** no longer lists `@relayboard/skills#relayboard-identity` under exclusions, and `npx intent load @relayboard/skills#relayboard-identity` succeeds — both read through the installed package, so a stale tarball fails them.
- [x] `INTENT.md` or the package's `AGENTS.md` is updated if the allowlist or exclusion change affects what a consumer can load, so the documentation of the wiring matches the wiring.
- [x] A one-page record exists stating which parts of the prototype were carried across verbatim, which changed, and why — so retiring the static prototype is a deliberate act rather than a delete (spec L628 keeps the deletion itself out of scope).
- [x] The record states what was *not* carried across and why (the `localStorage` store, the `authorId`-bearing signature, the simulated stream, the theme toggle), so a future reader cannot mistake an omission for a regression.

**Leaves the build green:** yes. No application code changes; the repository's guidance becomes true.

## Comments

**Implemented and verified** at `57e37bd`. The three shipped skills describe the application rather than the
prototype, and the retirement is a recorded act rather than a delete.

**`relayboard-identity` is rewritten against the principal read and its exclusion is gone.** The exclusion
existed because the prototype had no `getPrincipal`; ticket 12 consumes one. The skill now teaches the
derived-and-declared split with a table of who produces each and what it is trustworthy about, the absent
derivation for a principal that was never admitted, and the rule that survives everything else: **a credential
identifies, it does not authenticate**, so a derived fingerprint is evidence about this workspace's record
and never about a principal's honesty. Two mistakes the prototype could not have had are named: reading a
credential as authentication, and rendering a grant as a status.

**`relayboard-thread-sequencing` was corrected where it claimed an entry is a message, and its two surviving
rules are kept word for word** — which is the evidence that this was a correction rather than a rewrite of
what was already right. `relayboard-mock-api` documents the operation vocabulary, the three requirement
shapes and which one a workspace permission needs, the four kinds of entry, the refusal families and their
order, demo origin with the purge overlap, and the in-memory store's limits — and it names the superseded
`appendMessage` signature so a reader recognises their own stale code.

**The trap recorded in both the record and `INTENT.md` is the failure mode of this whole port in miniature:**
**repacking the vendored tarball is not installing it.** A `file:` dependency's recorded `integrity` is over
the resolved package rather than the tarball file, so `npm` reported up to date and left the prototype's
guidance installed — 5218 bytes with zero `readPrincipal` occurrences, against an 8319-byte tarball
containing four. `--force` did not help; deleting the lockfile did not help; naming the dependency did.
**The skills gate was green throughout**, because every gate reads the source tree and none reads `vendor/`.

**Verified against the installed copy rather than the source**, because that is what a consumer loads: the
exclusions array is gone from `package.json`, the installed identity skill is 8319 bytes with four
`readPrincipal` references, both intent proofs pass, three skills validate with no pending review items, and
`npm run skills:check` and `npm run skills:validate` both exit 0.

**The retirement record states what was not carried as well as what was**, because a closing document that
lists only successes is a brochure. It names the six things the port did not finish, each with the ticket
that records it.
