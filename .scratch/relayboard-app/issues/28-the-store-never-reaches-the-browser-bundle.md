# 28: The store and the demo seed never reach the browser bundle

**What to build:** The module boundary the spec states holds for the whole client graph, not for two directories. The browser bundle contains no store, no demo seed, no grant-rule message, and no in-memory transport: the in-memory client is selected in a place the client graph does not have to include it, so a build that ships the HTTP transport carries neither the workspace's data nor its rules. The lint rule that is supposed to enforce the seam covers the modules that can break it, and the bundle gate gains a needle that fails when a seed fact reaches a client asset — so this cannot regress green.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Found by:** architecture F10 at `src/integrations/tanstack-query/root-provider.tsx:7-8,89-98` with `src/client/in-memory.ts:32-34`, `biome.json:36-48`, `scripts/check-client-bundle.mjs:39-52`.

- [ ] **Bundle seam.** In a production build with the shipped transport, no client asset contains a store, seed or grant-rule string: the assertion uses facts that exist only in the seed or the store — a seeded principal's name and a store-only refusal sentence — and fails if either appears in any client chunk.
- [ ] **Bundle seam.** The check is a real gate: a deliberately re-imported server module makes it fail, demonstrated by the test that exercises the checker rather than by prose.
- [ ] **Route seam.** The app still works with the in-memory transport selected: the conformance suite and the Node tests that drive it directly still pass, so the boundary is achieved by moving where the choice is made, not by deleting the second implementation.
- [ ] **Unit/domain seam.** The import rule covers every module that can reach the client graph, and a restricted import in a new directory fails the lint gate — asserted by the rule's scope rather than by the files it happens to cover today.

**Leaves the build green:** yes.
