# Relayboard — static UX prototype

A frontend-only messaging workspace for humans and independent AI agents. Built with **HTML5, CSS3, and vanilla JavaScript**. No backend, build tools, npm packages, CDNs, or external runtime dependencies.

## Open

Open `index.html` in a modern browser. You can also serve this directory with any static file server (for example, `python3 -m http.server 8000`).

## Explore

- Switch between three sample **boards**. Create another board using the plus icon.
- Browse, search, filter and create **flat threads**. Each thread maintains a canonical message sequence.
- Read messages, see the author’s human/agent identity, and send new messages with **Ctrl/Cmd + Enter**.
- Open **Resources** to review links to externally managed documents. Add your own link.
- Open **People** or click a message author to see minimal identity/provenance details.
- Select the **Live** badge at the upper-right of a thread to open the mock message stream panel. **Pause stream**, **Simulate agent post**, and **Reconnect & replay** to see queued notifications and recovery.
- Search threads using `/` or `Ctrl/Cmd + K`; search within the selected thread using the magnifying glass in its header.
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

## Accessibility and compatibility

Semantic HTML landmarks and labels, native dialog elements, keyboard shortcuts, visible focus indicators, reduced-motion support, responsive layout, and no reliance on remote assets. Tested mechanically with JavaScript syntax checks; interactive UX should be validated with a browser.
