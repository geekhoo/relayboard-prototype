# 02a: A test harness and the domain types it will hold

**From:** 02 — A store that owns boards, threads and the canonical sequence

**What to build:** The app can run a test suite, and the vocabulary those tests will assert against exists as types. Vitest is configured for Node with no DOM and no network, a `test` script exists, the two new directories are inside the lint and type-check boundary rather than outside it, and `src/domain` declares `Principal`, `Board`, `Thread`, `Entry` (a discriminated union that today has one member, a message), `Resource`, `Origin`, `Seq` and the watermark triple. No store, no rules, no seed — this ticket buys the floor the next two sub-issues stand on.

**Blocked by:** None (can start immediately)

**Write scope:** `vitest.config.ts`, `src/domain/**`, `tests/**`, and **append-only** additions to `biome.json` (its own globs) and `package.json` (one `test` script plus its dependencies). Does not touch `vite.config.ts` or `src/styles.css`, which 01 owns.

**Status:** done — verified, see `## Comments`

- [x] `npm test` runs Vitest in Node; a trivial suite passes; the run needs no browser, no DOM implementation and no network.
- [x] `vitest.config.ts` is checked in and `package.json` gains a `test` script; no `vitest/globals` are enabled and every test file imports `describe`/`it`/`expect` explicitly.
- [x] `biome.json`'s `files.includes` covers the new test and config files, so `npm run check` actually checks them rather than skipping them by allowlist.
- [x] `npx tsc --noEmit` passes over the new files; the existing `npm run build` and `npm run check` still pass.
- [x] `src/domain` declares `Principal` with `kind: "human" | "agent"`, and nothing in the domain branches on `kind`.
- [x] `Entry` is declared as a discriminated union over its kinds. Today the only member is a message, and the union is the shape later tickets widen — `readMessages`, the conformance suite and the stream payloads must be typed against `Entry`, not against a bare `Message`.
- [x] `Entry` carries `seq`, `authorId`, `createdAt`, `origin: "demo" | "owner"` and the `relation` field the prototype's seed uses (`app.js` L50–57) for a correction pointing at an earlier entry.
- [x] `Resource` carries `id`, `boardId`, `name`, `url`, `type`, `description` and `origin`; it is a board-scoped canonical record, and no entry holds a copy of its content.
- [x] `Board` and `Thread` carry `origin`; `Thread` does not carry a member list — a principal is on a board because it holds a grant there, not because of a list.
- [x] The three watermarks are named `cursor`, `seen` and `acknowledged` in the types, and no type calls one `read`, `readPosition` or `position`.
- [x] No test in this ticket touches the filesystem, spawns a process, or opens a socket.

**Leaves the build green:** yes. The suite runs and the domain compiles; nothing in `src/routes` imports the new module yet.


## Comments

**Implemented and verified.** The app runs a test suite, and the vocabulary the next
tickets assert against exists as types.

- `npm test` runs Vitest 5.1.0 in Node: 2 files, 18 tests, no DOM implementation
  installed, no browser, no network. `vitest.config.ts` replaces `vite.config.ts`
  rather than merging with it, so a test run cannot pick up Nitro's preset or a React
  transform.
- `biome.json` gained two globs and `npx biome check --verbose` lists the new files, so
  `npm run check` checks them instead of skipping them by allowlist. Proven by a
  deliberate violation, which failed with six errors.
- The absence of `vitest/globals` is asserted, not merely observed: running with
  `--globals` fails the same test that the normal run passes.
- `Entry` is a union with one member and every consumer is typed against `Entry`. The
  widening property is asserted with a mapped type over `Entry["kind"]`, so 10a's
  addition stops the file compiling until every kind is handled.
- `vitest@^5.1.0` is the only dependency added. Its peers and engines were checked
  against the installed vite 8.3.7 and Node 26 before installing, the install emitted no
  missing-peer warning, and the lockfile grew by vitest's own 16 packages with no
  unrelated entry rewritten — which matters because CI runs `npm ci` against it.

Three findings worth carrying forward, all recorded in the tickets rather than here:

- **Criterion 11 cannot be asserted from inside the suite.** Proving "no test reads a
  file, spawns a process or opens a socket" would itself have to read a file. It is true
  by construction and stated in the harness file; the mechanical form belongs to a lint
  rule, not to this ticket.
- **02a's "nothing branches on `kind`" check is temporary by design.** It asserts that
  `src/domain` exports types only, which stops holding when 02b puts the documented
  error strings there. 07a's criterion already asks for the durable check and now says
  it inherits this one.
- **Three prototype fields had no owner**: `board.short`, `board.theme` and
  `thread.pinned`. 02c now transcribes the first two, 04a renders them, and 04b must
  either carry pinning or drop it deliberately.
