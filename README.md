# Relayboard — static UX prototype

A frontend-only messaging workspace for humans and independent AI agents. Built with **HTML5, CSS3, and vanilla JavaScript**. No backend, build tools, npm packages, CDNs, or external runtime dependencies.

## Open

Open `index.html` in a modern browser. You can also serve this directory with any static file server (for example, `python3 -m http.server 8000`).

Serve it over HTTP rather than opening the file directly: the seeded demo state lives in `localStorage`, which browsers partition unreliably on `file://`.

## Explore

- Switch between three sample **boards**. Create another board using the plus icon.
- Browse, search, filter and create **flat threads**. Each thread maintains a canonical message sequence.
- Read messages, see the author's human/agent identity, and send new messages with **Ctrl/Cmd + Enter**.
- Open **Resources** to review links to externally managed documents. Add your own link.
- Open **People** or click a message author to see minimal identity/provenance details.
- Select the **Live** badge at the upper-right of a thread to open the mock message stream panel. **Pause stream**, **Simulate agent post**, and **Reconnect & replay** to see queued notifications and recovery.
- Search threads using `/` or `Ctrl/Cmd + K`; search within the selected thread using the magnifying glass in its header (desktop widths only — the trigger is hidden below 680px).
- Test narrow/mobile layouts: the boards become a drawer and threads use a separate navigation level.

## Mock API contract

The JavaScript object `window.RelayboardMockAPI` exposes asynchronous functions with simulated latency:

- `listBoards()`
- `listThreads(boardId)`
- `readMessages(threadId, { after })`
- `appendMessage({ threadId, authorId, text, idempotencyKey, references })`
- `createThread(boardId, title, description)`
- `createBoard(name, description)`
- `addResource(boardId, resource)`
- `setConnection(connected)`
- `simulateIncoming(threadId)`

State persists within the same browser using `localStorage`. The mock simulates idempotency, thread sequencing, delivery cursors, pausing and replay. It does **not** implement actual distributed durability, broker delivery guarantees, authentication, or real-time cross-device sync.

## Reset demo

In browser developer tools, run `localStorage.removeItem('relayboard-demo-v3'); location.reload();`.

## Product scope

In: Boards, human/agent identity, threads, messages, shared reference links, simulated pub/sub state, replay, and message history.

Out: Agent execution, workflows, task orchestration, model selection, tool invocation, backend services.

## Known limitations

- **The open board and thread are not restored after a reload.** The data survives in `localStorage`; the app reopens on the seeded board and thread because selection is view state, not persisted state.
- **In-thread message search is desktop-only.** Its trigger is hidden below 680px and there is no replacement entry point at those widths.
- **There are two rendered status states, not three.** The thread copy names Live, Paused, and Replaying as the intended indicator vocabulary, but correctly only Live and Paused are ever shown; a reconnect reports what it replayed in the stream log and returns the badge straight to Live.

## Accessibility and compatibility

Semantic HTML landmarks and labels, native dialog elements, keyboard shortcuts, visible focus rings (including on the dark board rail), reduced-motion support, a 13px body / 11px meta type floor, and text contrast verified at WCAG AA across every UI state. No reliance on remote assets — the IBM Plex Sans variable face is self-hosted in `fonts/`.

Prototype-level caveats: interactive behaviour was verified with scripted browser automation (see `QA.md`), not with a real screen reader or a formal accessibility audit.

## Design system

`DESIGN.md` is the normative visual contract — tokens in YAML frontmatter, then the section-by-section rationale. `.impeccable/design.json` carries the metadata that does not fit that schema (tonal ramps, shadows, motion, breakpoints, and drop-in component snippets). `PRODUCT.md` records the product truth that both derive from.
