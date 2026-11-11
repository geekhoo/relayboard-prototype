# 04a: The route tree, the URL contract and the board rail

**From:** 04 — Browse boards and threads at a shareable URL

**What to build:** The app has Relayboard's routes rather than the starter's, and its address fully describes the location. `/` is the workspace; a board and a thread are path segments; the three board views and the thread search and unread filter are validated search parameters. A URL naming a board or thread that does not exist lands in a not-found state inside the app frame. The dark board rail renders from the client with unread counts, is keyboard-reachable, and shows the active board. This ticket ends with a workspace frame whose thread pane and conversation are honest placeholders — the next sub-issue fills them.

**Blocked by:** 01 — Make the scaffold into a Relayboard shell; 03 — The client interface and its in-memory implementation

**Write scope:** new route files under `src/routes/**`, the board-rail component with its co-located stylesheet, and a small accessor module beside the client. `src/routes/__root.tsx`'s **document shell** — `html`/`head`/`body`, the meta tags, the stylesheet link and `Scripts` — is 01's and stays untouched; the root route's **context type** may change, because the criterion below requires the client to travel on the router context and a route cannot read it otherwise. Type-only: an import and the generic, nothing in the shell.

**Status:** ready-for-agent

- [ ] The route tree contains only Relayboard routes: nothing resolves for `/about` or `/demo/tanstack-query`, and `routeTree.gen.ts` reflects that.
- [ ] The wide viewport shows a full-bleed frame with no site chrome: the board rail on the left, and the thread pane and conversation regions present as labelled placeholders. Nothing new competes for vertical height with the frame.
- [ ] The open board is a path segment of the URL, and reloading or pasting that URL restores the same board.
- [ ] The three board views (`threads`, `resources`, `people`) are search parameters on the board route; back and forward move between them and the view follows.
- [ ] Thread search text and the unread filter are search parameters, validated on the way in: an unknown view value, a non-boolean filter value or an absurd search string is normalised rather than crashing the view, and a test asserts a hand-edited URL cannot break rendering.
- [ ] A board id in the URL that does not exist renders a not-found state inside the app frame, with a way back to the workspace — not a framework error page.
- [ ] The rail lists every board the acting principal may see, from the client interface and not from a direct store import; the active board is visibly distinct by fill plus the 1px inset edge (`DESIGN.md` §208, §241) and carries `aria-current`.
- [ ] The rail shows each board's unread count, derived from the `seen` watermark rather than a client-side counter.
- [ ] Each rail row renders its board's mark from the seeded `short` and `theme` — a 30px rounded square in one of the four hues (`DESIGN.md` §241 states the requirement; the values are the prototype's, `styles.css` L396–410, because the record does not yet carry them — 15b closes that gap) — rather than a letter invented in the component, so the hue set stays closed and visible.
- [ ] Board rows are reachable and activatable from the keyboard in a sensible order, and the focus ring is visible on the dark rail.
- [ ] The UI reaches data through `RelayboardClient` only. A Biome `noRestrictedImports` rule (or an equivalent check in `npm run check`) fails if a route or component imports the store.
- [ ] The client instance is provided once per router, not created at module scope, and TanStack Query is wired the way the scaffold already wires it (`src/router.tsx` L3–19), so the app does not gain a second data layer. The client is handed down on the router context — the root route's context generic names it, and `src/client/context.ts` holds the one accessor a component uses to read it — so no component imports the store or builds a client of its own.

**Leaves the build green:** yes. The board rail works against the in-memory client; the pane and conversation regions are placeholders that the next sub-issue replaces.
