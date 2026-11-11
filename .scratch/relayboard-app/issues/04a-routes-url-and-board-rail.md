# 04a: The route tree, the URL contract and the board rail

**From:** 04 — Browse boards and threads at a shareable URL

**What to build:** The app has Relayboard's routes rather than the starter's, and its address fully describes the location. `/` is the workspace; a board and a thread are path segments; the three board views and the thread search and unread filter are validated search parameters. A URL naming a board or thread that does not exist lands in a not-found state inside the app frame. The dark board rail renders from the client with unread counts, is keyboard-reachable, and shows the active board. This ticket ends with a workspace frame whose thread pane and conversation are honest placeholders — the next sub-issue fills them.

**Blocked by:** 01 — Make the scaffold into a Relayboard shell; 03 — The client interface and its in-memory implementation

**Write scope:** new route files under `src/routes/**`, the board-rail component with its co-located stylesheet, and a small accessor module beside the client. `src/routes/__root.tsx`'s **document shell** — `html`/`head`/`body`, the meta tags, the stylesheet link and `Scripts` — is 01's and stays untouched; the root route's **context type** may change, because the criterion below requires the client to travel on the router context and a route cannot read it otherwise. Type-only: an import and the generic, nothing in the shell.

**Status:** done — verified, with 1 criterion open; see `## Comments`

- [x] The route tree contains only Relayboard routes: nothing resolves for `/about` or `/demo/tanstack-query`, and `routeTree.gen.ts` reflects that.
- [x] The wide viewport shows a full-bleed frame with no site chrome: the board rail on the left, and the thread pane and conversation regions present as labelled placeholders. Nothing new competes for vertical height with the frame.
- [x] The open board is a path segment of the URL, and reloading or pasting that URL restores the same board.
- [x] The three board views (`threads`, `resources`, `people`) are search parameters on the board route; back and forward move between them and the view follows.
- [ ] **Not satisfied as worded — the parse is tested, the render is not.** Thread search text and the unread filter are search parameters, validated on the way in: an unknown view value, a non-boolean filter value or an absurd search string is normalised rather than crashing the view, and a test asserts a hand-edited URL cannot break rendering.
- [x] A board id in the URL that does not exist renders a not-found state inside the app frame, with a way back to the workspace — not a framework error page.
- [x] The rail lists every board the acting principal may see, from the client interface and not from a direct store import; the active board is visibly distinct by fill plus the 1px inset edge (`DESIGN.md` §208, §241) and carries `aria-current`.
- [x] The rail shows each board's unread count, derived from the `seen` watermark rather than a client-side counter.
- [x] Each rail row renders its board's mark from the seeded `short` and `theme` — a 30px rounded square in one of the four hues (`DESIGN.md` §241 states the requirement; the values are the prototype's, `styles.css` L396–410, because the record does not yet carry them — 15b closes that gap) — rather than a letter invented in the component, so the hue set stays closed and visible.
- [x] Board rows are reachable and activatable from the keyboard in a sensible order, and the focus ring is visible on the dark rail.
- [x] The UI reaches data through `RelayboardClient` only. A Biome `noRestrictedImports` rule (or an equivalent check in `npm run check`) fails if a route or component imports the store.
- [x] The client instance is provided once per router, not created at module scope, and TanStack Query is wired the way the scaffold already wires it (`src/router.tsx` L3–19), so the app does not gain a second data layer. The client is handed down on the router context — the root route's context generic names it, and `src/client/context.ts` holds the one accessor a component uses to read it — so no component imports the store or builds a client of its own.

**Leaves the build green:** yes. The board rail works against the in-memory client; the pane and conversation regions are placeholders that the next sub-issue replaces.

## Comments

**Implemented and verified** at `24b3b74`. The app has Relayboard's two routes and no others, the whole
location lives in the address, and the rail renders from the client with watermarks rather than counters.

What was checked, rather than assumed:

- `routeTree.gen.ts` declares exactly `/` and `/boards/$boardId`. `e2e/scaffold.spec.ts` asserts
  `/about` and `/demo/tanstack-query` render no starter content and, if they answer 200 at all, render
  the app frame — a not-found state inside the frame rather than a framework error page.
- The search parameters are parsed by a **total** function in `src/routes/-board-search.ts`: an unknown
  view, a non-boolean filter and an over-long query all normalise to a renderable value, and the parser
  returns a fresh object holding only the four known keys, so an unknown parameter cannot become a
  second unvalidated channel.
- The rail reads through `RelayboardClient` and never the store, and that is a **lint failure** rather
  than a convention: `biome.json`'s `noRestrictedImports` override covers `src/routes/**` and
  `src/components/**` and names `#/server`, `#/server/store`, `#/server/store/demo-seed` and
  `#/client/in-memory`.
- Unread counts are derived from `seen` through `-unread.ts`, from `readMessages` rather than
  `readThread` — reading a thread advances `seen`, so using it to count would empty every badge the
  rail is about to draw. The rail and the pane therefore cannot disagree.
- The board mark is the seeded `short` in the seeded `theme`: `BoardRail.css` maps a closed four-member
  union to four `@theme` tokens (`--color-board-sage`, `-ochre`, `-lavender`, `-blue`), so a fifth hue is
  a type error rather than an unstyled square. The values are the prototype's, because `DESIGN.md` §241
  states the requirement and names none of them — 15b owns closing that gap in the record.
- The active row is fill **plus** the 1px inset edge and `aria-current="page"`; the focus ring on the
  rail uses `--color-focus-on-rail`, because the ordinary focus token is 2.11:1 on that surface and a
  ring nobody can see is not a focus indicator.
- The client is created once per **router** by `getContext()` and travels on the router context;
  `src/client/context.ts` holds the one accessor components use. `src/router.tsx` is
  unchanged and still wires TanStack Query the scaffold's way, so there is no second data layer.
- **`src/routes/__root.tsx`'s document shell was not rewritten.** The root route's context generic
  changed, type-only, because criterion 24 requires the client to travel on that context; the
  `html`/`head`/`body`, meta, stylesheet link and `Scripts` are 01's and are untouched.

**One criterion is left unticked, because half of it is not true.** The pure parser is tested in
`tests/board-search.test.ts` — every absurd input yields the default and never throws — but the
criterion also requires "a test asserts a hand-edited URL cannot break rendering", and **no test renders
a hand-edited URL**. The parser's own header says the browser assertion "arrives with 04c", and 04c's
suite does not carry one: every `goto` in `e2e/**` uses one of the seed's real board ids. So the claim
"the view renders whatever the parser returns" is verified by reading the component, not by running it.
13a or 15a should carry it; until then this box is open on purpose rather than ticked to look finished.

**The placeholders are gone, and that is correct rather than a regression.** Criterion 14 asked for
labelled placeholder regions; `WorkspaceFrame` still renders them as fallbacks, and 04b and 05 replaced
them with the real pane and conversation. The region names (`Board contents`, `Conversation`) are still
there and still labelled, which was the part the criterion was protecting.

**Back and forward** work because a view change is a `Link` to the same route with a different search
parameter, so each view is a history entry the router restores. Nothing in the suite walks the history,
so that clause is asserted by the mechanism rather than by a test.

**The rail's rows are keyboard-reachable because they are links, not because they were made so.** Each
row is a TanStack `Link`, so tab order, Enter and the focus ring are the browser's rather than a
handler's, and `BoardRail.css` overrides the focus token for that surface because the ordinary one is
2.11:1 on the rail. Asserted by construction, and by 13b when it walks the keyboard.
