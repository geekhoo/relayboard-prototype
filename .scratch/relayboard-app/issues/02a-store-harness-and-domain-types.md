# 02a: A test harness and the domain types it will hold

**From:** 02 — A store that owns boards, threads and the canonical sequence

**What to build:** The app can run a test suite, and the vocabulary those tests will assert against exists as types. Vitest is configured for Node with no DOM and no network, a `test` script exists, the two new directories are inside the lint and type-check boundary rather than outside it, and `src/domain` declares `Principal`, `Board`, `Thread`, `Entry` (a discriminated union that today has one member, a message), `Resource`, `Origin`, `Seq` and the watermark triple. No store, no rules, no seed — this ticket buys the floor the next two sub-issues stand on.

**Blocked by:** None (can start immediately)

**Write scope:** `vitest.config.ts`, `src/domain/**`, `tests/**`, and **append-only** additions to `biome.json` (its own globs) and `package.json` (one `test` script plus its dependencies). Does not touch `vite.config.ts` or `src/styles.css`, which 01 owns.

**Status:** ready-for-agent

- [ ] `npm test` runs Vitest in Node; a trivial suite passes; the run needs no browser, no DOM implementation and no network.
- [ ] `vitest.config.ts` is checked in and `package.json` gains a `test` script; no `vitest/globals` are enabled and every test file imports `describe`/`it`/`expect` explicitly.
- [ ] `biome.json`'s `files.includes` covers the new test and config files, so `npm run check` actually checks them rather than skipping them by allowlist.
- [ ] `npx tsc --noEmit` passes over the new files; the existing `npm run build` and `npm run check` still pass.
- [ ] `src/domain` declares `Principal` with `kind: "human" | "agent"`, and nothing in the domain branches on `kind`.
- [ ] `Entry` is declared as a discriminated union over its kinds. Today the only member is a message, and the union is the shape later tickets widen — `readMessages`, the conformance suite and the stream payloads must be typed against `Entry`, not against a bare `Message`.
- [ ] `Entry` carries `seq`, `authorId`, `createdAt`, `origin: "demo" | "owner"` and the `relation` field the prototype's seed uses (`app.js` L50–57) for a correction pointing at an earlier entry.
- [ ] `Resource` carries `id`, `boardId`, `name`, `url`, `type`, `description` and `origin`; it is a board-scoped canonical record, and no entry holds a copy of its content.
- [ ] `Board` and `Thread` carry `origin`; `Thread` does not carry a member list — a principal is on a board because it holds a grant there, not because of a list.
- [ ] The three watermarks are named `cursor`, `seen` and `acknowledged` in the types, and no type calls one `read`, `readPosition` or `position`.
- [ ] No test in this ticket touches the filesystem, spawns a process, or opens a socket.

**Leaves the build green:** yes. The suite runs and the domain compiles; nothing in `src/routes` imports the new module yet.
