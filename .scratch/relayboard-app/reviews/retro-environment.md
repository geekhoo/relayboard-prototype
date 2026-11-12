# Retro — what the Relayboard port's environment should have caught

**Session:** the port of the static prototype into `apps/relayboard-web`, reviewed at `c9304d6` by a three-seat panel.
**Thesis:** every defect the panel found is a **claim** — a docstring, a comment, a test title, a status field — that asserts a protection no code and no check implements, and the gate reads code, so a green gate was never evidence about a claim.

Findings below are cited by their review's own number: `Sec F1` = `implementation-security-review.md` F1, `Arch F1` = architecture, `Prod F1` = product/UX; `C1–C5` are the synthesis's deduplicated Criticals.

## Ranked recommendations

| # | Category | Recommendation | Evidence | Cost | What it would have caught |
| --- | --- | --- | --- | --- | --- |
| R1 | Automated check | `check:authorization` — a declared requirement must have an enforcement site, and every server route that resolves a principal must authorize or filter | `src/client/index.ts:583` declares `subscribe`; `src/routes/api/stream.ts:52-122` never reads it. 31 `createServerFn` handlers, 1 API route | ~90-line script, 3 wiring lines | **C1** (Sec F1, Arch F3), Sec F14; makes the class un-repeatable |
| R2 | Automated check | `check:id-namespace` — a prefix the store mints into must not intersect the seed's | `store/index.ts:660-665,1193` vs `demo-seed.ts:547-610`. Measured: created id `res-1` | ~25-line script | **C2** (Arch F1) |
| R3 | Automated check | `check:transport-parity` — every store member one client calls must be reached by the other, or exempt with a reason and an anti-rot assertion | `markRead` is called only from `client/in-memory.ts:211`; `functions/read.ts:97-106` never calls it. Measured: 37 store members, exactly 2 one-sided | ~40-line script | **C4** (Arch F5, Prod F3) |
| R4 | Standard + narrow check | **Every claim carries its falsifier.** A guarantee in prose ships with the line that fails if it stops being true; a test title states what its body cannot pass without. Mechanical half: a curated verb→call table over test titles | `admissions.ts:626-642` argues `revoke:agent`, `:651` asks `admit:agent`; `principal.ts:154-155` vs `:192-207`; `parity.spec.ts:1274-1286`; `keyboard.spec.ts:296-320` | 1 file + ~60-line check | Sec F2, Sec F3, Sec F5/Arch F12, Sec F10, Arch F13, Arch F14, **Prod F5**, **Prod F6**, Prod F11, Prod F15, Prod F16 |
| R5 | Automated check | Extend `check:styles` with the two things it is blind to: a DESIGN.md token missing from `styles.css`, and a `box-shadow` value that is not a `--shadow-*` reference | `DESIGN.md:54` names `field-focus-edge`; `styles.css:86-88` lacks it. 5 shadow tokens, 0 consumers; `Gatekeeper.css:12` invents one | ~30 lines in the existing script | **Prod F9**, **Prod F10** |
| R6 | Information access | A documented probe recipe: `tests/probe/*.probe.test.ts` + `npm run probe`, and `e2e/helpers/session.ts` exporting the cookie mint that 8 specs hand-roll | `sessionFor` is duplicated verbatim in 8 e2e specs; `helpers/participants.ts` is unexported from the narrative. Measured: a probe costs 237 ms | ~40 lines + 1 doc block | Lets a reviewer *prove* C2, C3, C4, Arch F6–F9, Arch F12, Sec F5 instead of deriving them |
| R7 | No-ops / navigation | Sweep the steering that is now false: the boot claim, the Intent exclusion, the scaffold README, two contradicting harness docblocks, the issue-tracker contents | `AGENTS.md:43` (measured false), `apps/relayboard-web/AGENTS.md:32-49` (no `exclude` exists), `README.md:25-260`, `playwright.config.ts:67-99`, `store/instance.ts:14-17`, `stream.ts:107`, `client/index.ts:596-603`, `docs/agents/issue-tracker.md:17-25` | ~1 hour of edits | Nothing directly; it is what made 46 findings cost three seats to find |
| R8 | Navigation | `check:citations` — every `spec L<n>` and `DESIGN.md §n` must land on a non-blank line | 134 citations in `src/`, `tests/`, `e2e/`; 6 point at a blank line (all `L438`), 2 `DESIGN` refs are blank | ~25-line script | Keeps the repo's real navigation system (line-numbered pointers) from rotting |

---

### R1 — A declared requirement must have an enforcement site

**The finding.** `operationPermissions.subscribe = { atLeastOneBoard: "read:board" }` (`src/client/index.ts:583`) is exhaustive-by-type, tested as data (`tests/permissions.test.ts:30-40`), and read by exactly one function: `authorize()` (`src/server/permissions.ts:98-118`). The SSE route never calls it. `src/routes/api/stream.ts:52` resolves a principal and `:111-122` then walks every board and thread with no `permits` filter; `:187-198` does the same for live commits. The Lead reproduced 31 entries to `sara`, who is refused `/boards/platform` over RPC.

The table is a claim; the call site is the falsifier; nothing compared them.

**The change.** One script, three rules, house style copied from `scripts/check-app-styles.mjs` (resolve paths from `import.meta.url`, fail on an empty input set, exit 1):

```js
// scripts/check-authorization.mjs
// Rule 1 — every declared requirement has an enforcement site.
const table = read("src/client/index.ts").slice(at("export const operationPermissions"));
const sources = collect("src");                          // every .ts/.tsx
for (const operation of clientOperations) {               // parsed from the same file
  const row = rowOf(table, operation);
  if (row.includes("none:")) continue;                    // nothing required, reason stated
  if (!sources.some((s) => new RegExp(`authorize(?:As)?\\(\\s*"${operation}"`).test(s)))
    fail(`${operation} declares ${row} but no file calls authorize("${operation}")`);
}

// Rule 2 — every server route that resolves a principal authorizes or filters.
for (const route of collect("src/routes")) {
  const body = handlerOf(route);                          // the GET/POST handler
  if (!/actingPrincipal\(|resolveSession\(/.test(body)) continue;
  if (!/authorize(?:As)?\(|\.permits\(|permitsRequirement\(/.test(body))
    fail(`${route}: resolves a principal and enforces nothing`);
}

// Rule 3 — every createServerFn handler authorizes, or is a named exemption WITH its guard.
const EXEMPT = new Map([
  ["knock",           "pre-participant by design: no session exists to authorize"],
  ["pollAdmission",   "pre-participant: the polling secret is the credential"],
  ["listPending",     "isGateHolder(admit:agent) in admissions.ts:511-517"],
  ["decidedOn",       "isGateHolder(admit:agent) in admissions.ts:482-488"],
  ["admit",           "isGateHolder(admit:agent) then store.grant's bounds"],
  ["deny",            "isGateHolder(admit:agent)"],
  ["revokeAdmission", "isGateHolder in admissions.ts:651"],   // see R4: this one is the bug
  ["renewAdmission",  "proved by the expired credential itself (admissions.ts:695-723)"],
  ["readHeldPermissions", "operationPermissions row is { none }"],
  ["resetTestStore",  "resetAllowed() — the only handler with no principal (Sec F14)"],
]);
for (const [name, why] of EXEMPT)
  if (!handlers.has(name)) fail(`exemption "${name}" names a handler that no longer exists`);
```

The last loop is the load-bearing part and it is copied from the repo's own instinct (`check-client-bundle.mjs:77-82` refuses to pass an empty check; `playwright.config.ts:35-46` refuses at config-load). An exemption register rots exactly like a comment; asserting that every exemption still names a live handler is what keeps it a statement rather than sediment.

Measured against today's tree: Rule 1 reports exactly one violation (`subscribe`); Rule 2 exactly one (the stream route); Rule 3 fires on 10 of the 31 handlers — the 8 admission functions, `readHeldPermissions` (whose table row is `{ none }`), and `resetTestStore`. Nine of the ten are legitimate and belong in the register with their reason; the tenth is `revokeAdmission`, and writing its exemption is the moment `Sec F2` becomes unavoidable, because the reason line would have to read "`isGateHolder` at `admissions.ts:651`" — which asks `admit:agent`.

**Can the stream route's shape be checked at all?** Yes, and this is the one place it is easier than for server functions: there is exactly one API route in `src/routes`, and the distinctive token is the resolver call. A route that mints or resolves an actor and then walks the workspace is a five-line regex because there is one of them.

**What it would have caught.** C1 (Sec F1, Arch F3), Sec F14. Wire it into `apps/relayboard-web/package.json`, root `app:check` (`package.json:17`), and `.github/workflows/app-check.yml` after `check:styles`.

**Honest cost.** The four existing `scripts/*.mjs` are outside biome (`biome.json:10-21` lists `**/src/**`, `**/tests/**`, `**/e2e/**`, never `../../scripts`; measured: `npx biome check ../../scripts` → "No files were processed"). A fifth script inherits that gap. Closing it means a root `biome.json`, which is a separate decision — but a checker nobody lints is how `tests/permissions.test.ts:329-331` became a lexical scan of a semantic rule.

### R2 — A minted id must not land in the seed's namespace

**The finding.** `store/index.ts:660-665` mints `${prefix}-${sequence}` from a counter starting at 0; the seed already holds `res-1 … res-7` (`demo-seed.ts:547-610`), and `addResource` is the only minting operation that uses `res` (`:1193`). Measured, in this session, against the real store:

```
seeded: res-1,res-2,res-3 | created: res-1 | after: res-1,res-2,res-3,res-1
```

`attachResource` resolves by `find(id)`, so the artifact points at the seeded record. `board` and `thread` prefixes are clean, which is why nothing failed: the collision exists in exactly one of the three namespaces.

**The change.**

```js
// scripts/check-id-namespace.mjs
const minted = [...read("store/index.ts").matchAll(/nextId\("([a-z]+)"\)/g)].map((m) => m[1]);
const seeded = [...read("store/demo-seed.ts").matchAll(/\bid:\s*"([a-z]+)-\d+"/g)].map((m) => m[1]);
if (minted.length === 0 || seeded.length === 0)
  fail(`vacuous: ${minted.length} minted, ${seeded.length} seeded`);   // the check must be able to fail
const clash = [...new Set(minted)].filter((prefix) => seeded.includes(prefix));
if (clash.length) fail(`the seed already holds ${clash.join(", ")}-N; a created record will collide`);
```

**Why a check and not a test.** The real fix is a counter floor or an owner prefix — a design choice. The check states the invariant ("a minted namespace is disjoint from the seed's") in the one form that survives the choice, and it is 25 lines. A unit test would encode one instance of the collision, and the next prefix added would need a new test.

**What it would have caught.** C2 (Arch F1), the port's second Critical, on its first resource.

### R3 — The two transports must reach the same store members

**The finding.** C4's root cause is not that `markRead` is missing from a handler; it is that a store member can be called from one client and not the other, and nothing notices. `markRead` has exactly two occurrences in `src/server` — the declaration (`store/index.ts:318`) and the body (`:896`) — and one caller, `client/in-memory.ts:211`. The shipped transport is HTTP (`integrations/tanstack-query/root-provider.tsx:80-98`), whose `readThread` (`server/functions/read.ts:97-106`) does not call it. Measured: of the 37 members on the `Store` interface, exactly two are called only from a client implementation — `markRead` and `derivedIdentityFor`.

**The change.**

```js
// scripts/check-transport-parity.mjs
// ONE_SIDED must name the reason AND must still be one-sided: when the missing call is added,
// this check fails until the exemption is deleted. The exemption is the to-do list.
const ONE_SIDED = new Map([
  ["derivedIdentityFor", "HTTP reaches the same fact via admissions.derivedFor (read.ts:182)"],
  ["markRead",           "HTTP readThread does not mark read — Arch F5 / C4, open"],
]);
const fromMemory = calledOnStore("src/client/in-memory.ts");      // store.<member>(
const fromServer = calledOnStore("src/server/functions/**");      // store().<member>(
for (const [member, why] of ONE_SIDED) {
  const stillOneSided = fromMemory.has(member) !== fromServer.has(member);
  if (!stillOneSided) fail(`${member} is now called from both transports; delete its exemption`);
}
for (const member of fromMemory)
  if (!fromServer.has(member) && !ONE_SIDED.has(member))
    fail(`${member} is reached from the in-memory client and never from the server`);
```

**What it would have caught.** C4 (Arch F5, Prod F3) — and it would have caught it at 06c, when the HTTP transport landed, rather than at review. It is also the cheapest possible answer to Arch F11 ("the conformance suite proves one transport"): this does not prove behaviour, but it proves the *surface* the two transports touch, which is the door the divergence came through.

### R4 — Every claim carries its falsifier

This is the one that is a **standard**, not a check, and it is the retro's centre. The synthesis names the shape: nine High findings and three Criticals where "a comment, a test name or a status field asserts a protection the code does not implement" (`implementation-review-synthesis.md:102`). Below is what each cited site actually needed, plus two the rule catches that the panel filed separately:

| Site | What the prose claims | What the code does | What would have failed |
| --- | --- | --- | --- |
| `admissions.ts:626-642` | "the revoke path is reachable only by a principal holding `revoke:agent` at workspace scope" | `:651` calls `isGateHolder`, which asks `admit:agent` (`:393-395`) | a test revoking as a principal holding `admit:agent` and **not** `revoke:agent` — the seed's `alex` is one |
| `principal.ts:154-155` | "A cookie wins when both are present" | `:192-207` returns the bearer first | any test that presents both |
| `admissions.ts:679-694` | renewal is a rotation ("cannot rotate a working credential to launder a compromised one") | `:727-734` adds a hash, never `issued.delete`s the old | "the old credential stops resolving" |
| `tests/admissions.test.ts:747` | "a revocation ends access" | revokes as `alex` — the board gate holder — and passes | a control as `nadia` |
| `e2e/parity.spec.ts:1274-1286` | title: "…and close on Escape" | 13 lines, no `keyboard.press` | pressing Escape |
| `e2e/keyboard.spec.ts:296-320` | title: "leaves nothing else closed" | never opens anything else | opening a dialog |
| `e2e/isolation.spec.ts:25-38` | comment: "Read a thread, which advances this reader's `seen`" | asserts counts across a reset — equal either way | asserting the count fell |
| `e2e/helpers/parity.ts:491-497` | `status: "covered"` | the covering test asserts the adjacent fact | the status field meaning what the file's own legend says it means (`parity.ts:15`) |
| `server/stream.ts:107` | "a comment or a keep-alive" | no `setInterval` in `src/`; no `:` frame | grep for the frame |
| `client/index.ts:596-603` | "they arrive with 10a" | `in-memory.ts:369-394` calls the store | the class having a caller |
| `StreamPanel.tsx:235` | "Every entry stays in durable history" | `store/instance.ts:19-23` — in memory | one sentence contradicting its own frame |

**The standard, stated positively** (one paragraph in a new `CODING_STANDARDS.md`, and one line in the `/code-review` skill's Standards axis):

> **A claim ships with its falsifier.** A comment, a docstring, a test title or a status field that asserts a guarantee names the line or the test that fails if the guarantee stops being true — or it is rewritten to state what the code does. A docstring that describes a mechanism names the mechanism's site. A test title states what the body cannot pass without. A status value means exactly what the file's own legend says it means.

That is deliberately positive: it says what to write, not what not to. It carries two mechanical consequences the reviewer can apply without judgement — "find the falsifier or the claim is wrong" and "delete the sentence rather than soften it".

**The mechanical half.** A curated table, not a general NLP check, run over `e2e/` and `tests/`:

```js
// scripts/check-test-claims.mjs — comments stripped first, so a comment cannot satisfy a title
const VERBS = [
  [/\bEscape\b/,                  /press\(\s*"Escape"|key:\s*"Escape"/],
  [/returns? focus|focus returns/i, /toBeFocused\(/],
  [/close on Escape/i,              /press\(\s*"Escape"/],
  [/Restore demo content/i,         /data-purge-restore/],
  [/no board with that address/i,   /not.?found/i],
];
```

Measured on this tree: 176 e2e tests, 525 test bodies including the conformance factories; the two-rule version (`Escape`, `focus`) flags exactly `parity.spec.ts:1249` and `:1274` — both true positives, no false ones. A looser table (`clears`, `restores`, `refuses`) adds false positives (`parity 37`, `parity 58`), so the table stays curated at 5–8 verbs and gets a suppression marker `// claim-check: <reason>` — which is itself a one-line claim a reviewer reads, and therefore the point.

**What it would have caught.** Prod F5, Prod F6 deterministically. Prod F11 and Prod F15 by the standard. Sec F2, Sec F3, Sec F5/Arch F12, Sec F10, Arch F13, Arch F14, Prod F1, Prod F2, Prod F16 by the standard — thirteen report-level findings (fewer once the overlaps collapse; Sec F5 and Arch F12 are the same defect). It is the only recommendation that would have caught findings in all three reviews.

**A detail worth keeping**, because it shows how well a claim can camouflage: `client/in-memory.ts:23` imports `NotYetImplementedError` and never calls it, yet `tsc` with `noUnusedLocals: true` and biome's recommended `correctness/noUnusedImports` both pass — because `:56` links it in a JSDoc `{@link}`. Confirmed rather than assumed, on a two-file repro in a temp directory: with the `{@link}` the compile is clean (exit 0); delete the one JSDoc line and it reports `TS6133: 'NotYetImplementedError' is declared but its value is never read` (exit 2). A documentation reference satisfies a dead-code check. That is the thesis in one line, and it is why the check in this recommendation cannot be the only instrument.

### R5 — `check:styles` must see the two things it is structurally blind to

**The finding.** `scripts/check-app-styles.mjs` has two rules: no colour literal outside the token block (`:97-103`) and no clipped frame (`:111-168`). Both read *values*. Neither can see a token that should exist and does not, or a literal that has been laundered through a token-shaped name. Measured:

- `DESIGN.md:50-54` names `field-focus-edge: #7fb79c`; `styles.css:21-133` has 36 colour tokens and no `field-focus-edge`; `grep field-focus-edge src/` → 0. Comparing DESIGN's frontmatter to the block with the one documented rename (`board-mark-*` → `board-*`) yields exactly one missing: `field-focus-edge` (Prod F10).
- All five `--shadow-*` tokens (`styles.css:128-132`) have **zero** consumers, while `Gatekeeper.css:12` and `ParticipantPanel.css:12` both write `box-shadow: -8px 0 24px var(--color-surface-tint)` — a near-white fill used as a shadow, off-token and off the Neutral Shadow Rule (`DESIGN.md:225`) (Prod F9).

**The change.** Two rules appended in the same file, same house style:

```js
// Rule 3: every colour DESIGN.md names has a token. board-mark-* is DESIGN's name for the
// app's board-* token, and that rename is recorded in styles.css:89-99 and owed to 15b.
const RENAMED = { "board-mark-ochre": "board-ochre", /* … three more */ };
for (const name of designColourNames()) {
  const token = `--color-${RENAMED[name] ?? name}`;
  if (!tokenBlock.includes(token)) report(TOKEN_SHEET, tokenLine, "design-token-missing", token);
}
// Rule 4: a box-shadow is a token reference or an inset edge, never a hand-written drop shadow.
for (const file of collect(SRC).filter((f) => f.endsWith(".css")))
  for (const [line, decl] of declarations(file, "box-shadow"))
    if (!/var\(--shadow-|^inset /.test(decl)) report(file, line, "un-tokened-shadow", decl);
```

Rule 4 passes today on the two `inset` edges (`BoardRail.css`, `ThreadList.css`) and fails on the two invented shadows. Rule 3 fails on one token. Both failures are already-known findings — which is the correct state for a repo under review: a check that fails on a real defect is a check that works.

**What it would have caught.** Prod F9, Prod F10, and it would have forced 15b's board-mark debt to be closed or recorded in the same pass that wrote the tokens.

### R6 — Let a reviewer prove a store finding in one command

**The finding is an access problem, and it is measurable.** The three reviews are explicit about it: the security reviewer's "Not checked" begins "Anything requiring a running server or a browser" (`implementation-security-review.md:338`) and ends "I did not attempt to reproduce any finding against a live server" (`:345`). The architecture reviewer got furthest — it used `jiti` with the app's own module instance — and every quoted probe in that report is real precisely because of it. The Lead then re-derived the same three probes by hand.

The machinery exists and is neither exported nor documented:

- `e2e/helpers/workspace.ts` resolves the reset function id from the built manifest and explains why a hard-coded one cost twenty minutes (`:11-16`).
- `e2e/helpers/participants.ts` gives `whoAmI` and `renderedEntries` — both about reading the page as a participant.
- The session-cookie mint (`base64url(id) + "." + base64url(HMAC-SHA256(id))`) is **duplicated verbatim in eight spec files** (`acts`, `create`, `gatekeeper`, `participant-panel`, `permissions`, `purge`, `stream-panel`, `stream`), each with its own `SECRET` literal. `permissions.spec.ts:14-24` contains the only prose explaining what it is for.

**The change, in two halves.**

1. `e2e/helpers/session.ts` exporting `sessionFor(principalId)` and `asPrincipal(browser, baseURL, id)`; the eight specs import it. That alone turns "act as `sara`" into one call, which is what C1's reproduction needed and what the Lead had to build by hand.
2. A probe convention, documented in root `AGENTS.md` §Commands:

```sh
# apps/relayboard-web
npm run probe        # vitest run tests/probe — the store and admission seams, ad hoc
```

with `tests/probe/*.probe.test.ts` as the home for a five-line experiment against the real store. Measured in this session: such a file resolves `#/` through `vitest.config.ts:22` and runs in 237 ms:

```ts
// tests/probe/id-collision.probe.test.ts
import { createStore } from "#/server/store";
import { demoOptions, demoSeed } from "#/server/store/demo-seed";
const store = createStore(demoSeed(), demoOptions());
console.log("seeded:", store.listResources("platform").map((r) => r.id).join(","));
```

**Why not "just run node".** Measured, so the recipe does not get rewritten a sixth time: native type-stripping fails — `node probe.mts` dies with `ERR_UNSUPPORTED_DIR_IMPORT` on `#/domain`, because every internal import is a directory specifier. `jiti` works but only from a file inside `apps/relayboard-web` (a probe in `%TEMP%` fails `ERR_MODULE_NOT_FOUND: jiti`), and it needs the `#` alias passed explicitly. `vitest` needs neither. That paragraph is the whole value of the recommendation, and it took four attempts to earn.

**What it would have caught.** Not "caught" — *confirmed*. With it, C2 (id collision), C3 (cross-principal replay), C4 (`seen` never moves), Arch F6 (unfrozen restore), F7 (phantom replay after purge), F8 (`ownEntriesOnDemoBoards`), F9 (whitespace names), F12 (renewal) and Sec F5 are each one probe rather than one derivation. The panel found all of them anyway, by reading; the cost was three seats and a Lead re-deriving.

### R7 — The steering is now partly false

Each of these is verified, and each is separately cheap. This is the "no-ops and stale steering" section; taken together it is the reason a reviewer could not trust the documents to orient them.

1. **`AGENTS.md:43`** — "`npm run check:boot` # the built server refuses to start without a usable `SESSION_SECRET`". Measured in this session: with `SESSION_SECRET` empty and `NODE_ENV=production`, the built server **starts and listens**, prints `Listening on: http://localhost:3299/`, and the first request returns 500 with the message naming the variable. `scripts/check-boot.mjs:9-13` and `src/start.ts:22-31` both say this correctly and at length. The one-line summary is the false one. Replace with "refuses to serve without one (the process starts; the first request fails)".
2. **`apps/relayboard-web/AGENTS.md:30-49`** — prints an `intent` block with `"exclude": ["@relayboard/skills#relayboard-identity"]` and explains why the exclusion exists. `apps/relayboard-web/package.json:52-57` has no `exclude` key; measured: `npx intent exclude list` → "No excludes configured", and `npx intent list` now lists `relayboard-identity` as loadable. Delete the block and the paragraph, or restore the exclusion — do not leave a steering file describing a configuration it does not have.
3. **`apps/relayboard-web/README.md`** — 260 lines, of which `:25-31` ("Removing Tailwind CSS"), `:112-136` ("Adding A Route", "Adding Links" with a `/about` link), `:138-175` ("Using A Layout"), `:177-200` ("Server Functions"), `:202-217` ("API Routes"), `:219-248` ("Data Fetching", a `swapi.dev/api/people` loader), `:251-253` ("Demo files") describe an application that does not exist. There is no `/about` route: the route files are `__root`, `index`, `boards.$boardId` and `api/stream`, plus `-`-prefixed helpers. There are no demo files. Meanwhile `NOTES.md:3` says "This file is a reproducibility record; `README.md` is the untouched CLI output" — which is also false, since `:33-52`, `:66-77` and `:91-104` are hand-written. The README is neither. Keep the hand-owned sections (getting started, the gates, T3Env, deployment) and delete the rest, pointing at `NOTES.md` for the scaffold's own record.
4. **`apps/relayboard-web/playwright.config.ts:67-99`** — two docblocks stacked before the same `const TRANSPORT` on `:100`. The first says "why it is the in-memory one today", that the harness "must drive" the in-memory client, and that "the workspace-reset fixture is currently **inert against what the page shows**" — which `e2e/helpers/fixtures.ts:20-31` and every spec contradict. The second says "The suite asserts the HTTP transport, because that is what ships". A reader who trusts the first distrusts the fixture that makes the suite order-independent. Delete `:67-87`.
5. **`src/server/store/instance.ts:14-17`** — accurate as written ("Nothing under `src/routes` or `src/components` may import it"), but it is the lint's scope that defines the boundary: `biome.json:34-54` applies `noRestrictedImports` to exactly those two globs, so `src/client/` and `src/integrations/` are exempt by omission. That is how `client/in-memory.ts:32-34` reaches the store and the whole demo seed into the browser bundle (Arch F10). Say so in the comment — "the boundary is the lint's `includes`, and it currently ends at routes and components" — and it becomes a question the next reader asks rather than a claim they believe.
6. **`src/server/stream.ts:107`** — "a frame parsed back into an event, or `null` when the frame is a comment or a keep-alive". No keep-alive is ever emitted: `grep setInterval src/` → 0 hits, and `routes/api/stream.ts:217-226` sets the `connection: keep-alive` header and nothing else (Arch F13).
7. **`src/client/index.ts:596-603` / `client/in-memory.ts:23,55-56`** — the class and its docstring outlive the acts they describe; `in-memory.ts:369-394` calls the store for all three (Arch F14). Delete the class, the import and the docstring's third bullet.
8. **`docs/agents/issue-tracker.md:13-25`** — "**30 tickets**", "the two reviews that shaped the set", "the nine that were too large are now `02a–c` …". At the time of writing the count had already moved past 40 issue files and there are now eight documents in `reviews/` (three pre-existing, the panel's four, and this retro), with the `/to-tickets` batch still growing as the sentence was written. That is the argument, not a footnote: a hard number in a steering file is stale the day the frontier moves. Root `AGENTS.md:23-24` repeats both numbers, and `:23`'s "**`01` and `02a` are the only two that can start now**" has been false since the second ticket closed. This file is the repo's only map of `.scratch/relayboard-app/`; replace the section with a table of what each artefact is and its status (spec rev 8 → parity checklist frozen at `cb0564a` → the ticket batch → the review documents, the panel's four and this retro named), with the counts given as a date-stamped figure or dropped, and have `AGENTS.md` point at it rather than restating counts. A directory listing beats a number: `ls` cannot go stale.

**Why this ranks where it does.** It catches nothing. It is what made the panel's job cost three seats: a reviewer who is told the fixture is inert, that there are 30 tickets, and that the app refuses to start has to verify the steering before they can trust it, and the verification is the review.

### R8 — Citations are the repo's navigation system; check they resolve

The codebase cites by line number instead of by prose: 134 `spec L<n>` references across `src/`, `tests/` and `e2e/`, and 14 distinct `DESIGN.md §n` references. That is a good system — `spec.md` is 653 lines and `DESIGN.md` is normative — but nothing checks the targets. Measured: 6 citations point at a blank line (all `spec L438`, whose intended anchor is `:435` or `:439`), and 2 `DESIGN.md` references (`§254`, `§260`) land on blanks.

```js
// scripts/check-citations.mjs
for (const file of collect(["src", "tests", "e2e"]))
  for (const [, n] of read(file).matchAll(/spec L(\d+)/g))
    if (!specLines[Number(n) - 1]?.trim()) report(file, `spec L${n} is blank`);
  for (const [, n] of read(file).matchAll(/DESIGN\.md\s*§(\d+)/g))
    if (!designLines[Number(n) - 1]?.trim()) report(file, `DESIGN §${n} is blank`);
```

25 lines, and it also catches the failure mode this repo has already suffered once — `spec.md` is at revision 8 and is described as "the port spec", so a line reference is only meaningful against a revision. Print the revision in the failure message so the reader knows which one was checked.

**What it would have caught.** Nothing in the 46. It keeps a mechanism that *did* carry the port — every ticket's reasoning is a line reference — from quietly going stale, which is R7's argument applied to the one place the repo cannot afford drift.

---

## Considered and rejected

- **A mutation-testing harness (Stryker, or a hand-rolled "delete the guard and see if the suite goes red").** It is the only thing that would catch `tests/admissions.test.ts:747` and `e2e/isolation.spec.ts:25` *as a class*, and it is the right long-term answer. Rejected on cost: the gate is already 2.3 minutes of e2e plus a build, and a mutation run is minutes-to-hours; it would also need the exemptions R1 and R3 already encode. R4's verb table buys most of the value for 1% of the runtime.
- **A general "does the test title match the body" NLP check.** Rejected: I measured it. The loose version (11 verbs, semantic matching) flagged 51 of 525 tests with mostly false positives (`refuses`, `restore`, `advance` all over-match English). The curated 5-verb table in R4 is the honest form of the same idea.
- **A check that every `createServerFn` handler calls `authorizeAs`, without the exemption register.** Rejected as written: measured, it fires on 10 handlers, 8 of which are the admission surface enforcing `isGateHolder` one layer down and one of which (`readHeldPermissions`) has `{ none }` by design. An unexempted check would be suppressed within a week. The register is the recommendation, not the obstacle.
- **A lint rule banning `as never`** (Sec F8, `functions/admission.ts:139`). No biome rule exists, and a regex check for `as never` would be five lines — but it is one Medium at one site, and the cheaper instrument is a standards sentence: "a cast at a boundary names the check it bypasses and the error family it produces". Folded into R4.
- **A check that every wire event name is produced *and consumed*.** Rejected: measured, all eight `WIRE_EVENT_NAMES` have a producer in `server/stream.ts`, so the "produced" half passes trivially and always will. The real gap (Prod F4: `stream-error` is emitted and consumed by nobody, so a dead stream renders "Live") is a product decision about a `default` branch that is already documented at `-conversation-queries.ts:139-144`. It belongs to R4's standard, not to a script.
- **A `max-width` assertion in `check:styles` for DESIGN.md §195's 68ch and §207's 850px** (Prod F8). Genuinely checkable and genuinely cheap, and I nearly ranked it. Rejected because it encodes a design value in a second place — the failure mode `check-app-styles.mjs`'s own header warns about ("by then the value is already the source of truth") — and because one Medium does not justify a value-duplication the design side will fight. If `DESIGN.md` gained a machine-readable measurement block, this becomes free.
- **An AST-based `kind` guard** to replace `tests/permissions.test.ts:329-331`'s lexical scan (Sec F13). Correct, and too expensive: it needs a TypeScript parser in the test process, and `vitest.config.ts` deliberately installs nothing beyond what it has. The existing test is honest about being lexical (`:333-336` records the vacuity it already fixed once). Leave it.
- **Making the review seats run the gate.** Rejected: the Lead ran it, twice, at the same commit, and the result is the synthesis's most important table. The reviewers' read-only stance was not the bottleneck; their inability to run *a probe* was, which is R6.
- **A "review pack" pointer listing the eight normative documents and the line ranges worth reading** (spec §Implementation Decisions L244-555, §Testing L556-614; `DESIGN.md`'s token block and type scale). This is real — the panel each re-read `PRODUCT.md`, `DESIGN.md` and 653 lines of spec before starting. Folded into R7's issue-tracker table rather than ranked separately, because a pointer to a 300-line range is the kind of thing `AGENTS.md` should carry in one line and does not need its own script.
- **Fixing C3's global idempotency map** (`store/index.ts:684-685,1336-1343`) as a recommendation. It is a bug, and `/to-tickets` owns it. The environment question it raises — "can a check see that a caller-supplied key is namespaced before authorization?" — has no cheap deterministic answer: the shape is a `Map<string, Entry>` and the namespace is a design choice. R6's probe is what makes it provable; the fix is ticket 18's.
