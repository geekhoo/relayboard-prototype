Status: ready-for-agent
Tracker: local markdown — `.scratch/relayboard-app/spec.md`

## Problem Statement

Relayboard exists today only as a dependency-free static prototype. `index.html`, `styles.css` and `app.js` at the repository root implement the whole product — boards, threads, messages, identity, resources, a simulated stream — inside one browser tab, with the entire store in a single `localStorage` blob. That was the right way to settle the interaction model and the visual system, and it has done its job: the design system and product record are now recorded and mechanically verified.

It cannot go further in that shape:

- **Nothing is shared.** Two browsers have two unrelated universes. The product's core claim — that a returning participant can reconstruct what happened while they were absent — is unverifiable when "absent" can only ever mean "this tab was closed".
- **The stream is a boolean.** Pause, pending and replay are a `connected` flag plus per-thread counters. There is no transport, so there is nothing to tell a participant that a message arrived.
- **The store is not a seam.** `app.js` renders the store directly. There is no interface a real backend could satisfy, so "build out from the prototype" would mean rewriting the client at the same time as writing the server.
- **Every client can claim any identity.** `appendMessage` takes `authorId` from the caller, so authorship — the evidence this product is built on — is unverifiable by construction.
- **It cannot be tested.** No route, no server, no module boundary; the only assertions possible are against a rendered document.

Someone who wants to keep developing this product has to either stay in a tab-local demo or start from zero.

## Solution

Build the real application inside the already-scaffolded TanStack Start app at `apps/relayboard-web`, and treat the static prototype as the behavioural reference it is: keep it in place, reach feature parity against it, and only retire it once the app serves the same screens.

The application keeps the prototype's domain exactly — Board → Thread → Message, flat chronology, a canonical per-thread `seq`, two distinct watermarks, first-class agent principals — and moves the store to the server:

- **The nine operations become server functions.** A participant calls `listBoards`, `listThreads`, `readMessages`, `appendMessage`, `createThread`, `createBoard`, `addResource`, `setConnection` and `simulateIncoming` the way they do today, but each is now a real RPC with validated input and a server-side store.
- **The stream becomes Server-Sent Events.** Pause, pending and replay stop being a simulated counter and become a real subscription: the server holds the connection, queues notifications while a subscriber is paused, and replays from a cursor on reconnect.
- **Authorship moves to the server.** A browser gets a signed workspace session cookie naming the principal it acts as. A human cannot post as another human; an agent cannot be impersonated by a browser. This is identity, not authentication, and the app will say so.
- **The client becomes an interface.** One `RelayboardClient` seam, satisfied by both an in-memory implementation (for tests and for the mock-only mode) and the HTTP implementation. The app renders against the interface, so the transport is swappable and the whole UI is testable without a network.

A participant gets the same product they can already see, except that the person — or agent — at the other end is real, and the message that arrived while they were away is still there when they come back.

## User Stories

### Boards

1. As a human participant, I want to see every board in the workspace, so that I know where the work is happening.
2. As a human participant, I want the board I am currently reading to be visibly distinct from the others, so that I never lose my place in a three-column layout.
3. As a human participant, I want each board to show how many unread messages it holds, so that I can pick the one that needs me without opening all of them.
4. As a human participant, I want to create a board with a name and description, so that a new line of work gets its own place instead of cluttering an existing one.
5. As a human participant, I want a newly created board to open immediately with an empty state that tells me what to do next, so that I am not left staring at a blank pane.
6. As a human participant, I want the open board to be reflected in the URL, so that I can reload, bookmark, or paste a link and land in the same place.
7. As a human participant, I want an invalid or deleted board in the URL to land somewhere sensible with a clear message, so that a stale link does not produce a broken screen.
8. As an agent principal, I want to enumerate boards and their threads through the same operations a human uses, so that I have no privileged or separate path to the workspace.

### Threads

9. As a human participant, I want the threads in a board ordered by most recent activity, so that the live conversations are always at the top.
10. As a human participant, I want each thread row to show its title, the latest message excerpt, the last author, the message count and an unread marker, so that I can choose a thread from one glance.
11. As a human participant, I want to search threads by title and latest message, so that I can find a conversation I remember but cannot see.
12. As a human participant, I want a clear zero-result state when a search matches nothing, so that I know the search ran and the thread genuinely is not there.
13. As a human participant, I want to filter to unread threads only, so that I can work through what I missed without scanning everything.
14. As a human participant, I want to create a thread with a title and optional description, so that a new line of work has a home inside the right board.
15. As a human participant, I want a newly created thread to open and be ready to post into, so that creating and writing are one continuous act.
16. As a human participant, I want the open thread to be reflected in the URL, so that a link to a specific conversation is shareable.
17. As a human participant, I want thread details — creation date, message count, last sequence, participants — in a side panel, so that I can orient myself without leaving the conversation.
18. As an agent principal, I want to enumerate a board's threads and read their metadata, so that I can decide which conversation to read without fetching every message.

### Reading and sequencing

19. As a human participant, I want messages in a thread ordered strictly by their canonical `seq`, so that the conversation never appears in the wrong order regardless of timestamps.
20. As a human participant, I want the whole thread on first read, so that opening a conversation does not silently truncate its history.
21. As a human participant, I want authorship, principal kind, time and sequence number on every message, so that I can reconstruct exactly who said what, in what order.
22. As a human participant, I want date dividers between days, so that a long thread is temporally navigable.
23. As a human participant, I want a message referenced by another message to be jumpable to, so that a reply's context is one click away.
24. As a human participant, I want the thread intro to name who started it and when, so that I understand the thread's origin before reading it.
25. As an agent principal, I want to read only the messages after a given sequence, so that reconnecting does not mean re-reading a thread I have already processed.
26. As an agent principal, I want my read position to be advanced only after I have handled a message, so that an interruption re-reads rather than silently skipping.
27. As an agent principal, I want a per-thread position rather than a global one, so that reading one thread does not mark another as caught up.
28. As a human participant, I want an in-thread message search at every viewport, so that finding a phrase in a long conversation does not depend on the width of my window.
29. As a human participant, I want in-thread search to tell me when it matched nothing, so that I do not mistake a filtered view for an empty thread.

### Posting

30. As a human participant, I want to write a message and send it with a visible button, so that posting does not require remembering a shortcut.
31. As a human participant, I want `Ctrl/Cmd + Enter` to send, so that I can post without leaving the keyboard.
32. As a human participant, I want the Send control disabled while the composer is empty, so that I cannot submit nothing.
33. As a human participant, I want the message to be committed to history before it is presented as delivered, so that the interface never claims a guarantee it has not met.
34. As a human participant, I want a message that failed to send to leave my draft in place with the reason, so that I do not lose what I wrote.
35. As a human participant, I want repeated submissions of the same draft to append exactly one message, so that a double click or a retry cannot duplicate my words.
36. As a human participant, I want to see the sequence number my message landed on, so that I have a concrete position to refer to.
37. As a human participant, I want to post from a phone-width viewport as easily as from a desktop, so that answering a message does not require a computer.
38. As a human participant, I want whitespace-only input rejected with a clear message, so that the thread never accumulates empty messages.
39. As a human participant, I want my message trimmed of surrounding whitespace, so that the stored text is the text that matters.
40. As an agent principal, I want to append a message with an idempotency key, so that a retry after a network failure does not create a duplicate.

### The stream and replay

41. As a human participant, I want a live indicator that tells me whether I am receiving new messages, so that I know whether what I am reading is current.
42. As a human participant, I want the indicator to pair a colour with a word, so that the state is legible without relying on colour.
43. As a human participant, I want to pause the stream, so that I can read without the interface moving under me.
44. As a human participant, I want messages that arrive while paused to keep accumulating in history without appearing in my view, so that pausing freezes my reading position rather than losing data.
45. As a human participant, I want a count of messages waiting for me while paused, so that I know how much I will catch up on.
46. As a human participant, I want to resume and have the withheld messages appear in order, so that catching up is one action.
47. As a human participant, I want a report of how many messages were replayed, so that I can confirm recovery actually happened.
48. As a human participant, I want the stream to survive a page reload without my cursor resetting, so that a refresh is not a data loss event.
49. As a human participant, I want the connection to recover on its own after a dropped network, so that I do not have to notice and intervene.
50. As a human participant, I want to be told plainly when the stream is disconnected rather than shown a stale "Live", so that the indicator never lies.
51. As a human participant, I want a demonstration control that produces a simulated agent message, so that the async behaviour can be exercised without a second participant.
52. As a human participant, I want the panel to state that the simulation is a demonstration, so that I never mistake it for another person.

### Identity and provenance

53. As a human participant, I want each message to name its author, so that authorship is always attributable.
54. As a human participant, I want agent-authored messages marked as such, so that I read them with the right expectations.
55. As a human participant, I want to open a participant's details — kind, issuer, description, fingerprint, board access — so that I can judge provenance before acting on a message.
56. As a human participant, I want a message's authorship to remain attached to that principal even if they leave the board, so that history does not become anonymous.
57. As a human participant, I want to see which principal I am posting as, so that I am never confused about whose words these are.
58. As a human participant, I want the server to decide who I am, so that a browser cannot post as another participant.
59. As an agent principal, I want a stable identity across connections, so that my history is one continuous record rather than a series of one-off guests.
60. As a product owner, I want the interface to state that authorship is not permission, so that no reader infers authority from a message that merely looks like an approval.

### Resources

61. As a human participant, I want to see the links shared in a board, so that I can find the document everyone is discussing.
62. As a human participant, I want to add a link with a name, URL and description, so that a reference lives beside its conversation.
63. As a human participant, I want an invalid or non-HTTP URL rejected before anything is stored, so that a broken reference never enters the board.
64. As a human participant, I want a message to reference a shared resource by chip rather than pasting a URL, so that the conversation stays readable.
65. As a human participant, I want external links to open safely in a new context, so that following a reference cannot hand the source page control of my session.
66. As an agent principal, I want to read a board's resources and their URLs, so that I can resolve a reference to the actual document.

### Layout and responsive behaviour

67. As a human participant, I want a three-column layout on a wide screen — boards, threads, conversation — so that I can see where I am, what else is here, and what I am reading at once.
68. As a human participant on a smaller laptop, I want the columns to narrow without the text wrapping badly, so that the layout degrades before anything else does.
69. As a human participant on a tablet, I want the board list to become a drawer, so that the conversation keeps a usable width.
70. As a human participant on a phone, I want the thread list to be the first screen and the conversation a second level with a visible back control, so that I am never in two panes at once on a narrow screen.
71. As a human participant, I want the composer pinned to the bottom of the conversation at every width, so that replying is always reachable.
72. As a human participant, I want no horizontal scrolling at any supported width, so that content is never lost off the side of the screen.
73. As a human participant, I want long thread titles and excerpts truncated with an ellipsis rather than pushing the layout, so that one long name cannot break the column.
74. As a human participant, I want the details drawer and the stream panel anchored and fully within the viewport at every width, so that a panel never opens off-screen.

### Keyboard and accessibility

75. As a keyboard-only participant, I want `/` and `Ctrl/Cmd + K` to focus thread search, so that I can find a thread without a pointer.
76. As a keyboard-only participant, I want `Escape` to close the open drawer, panel, or dialog, so that dismissal is always available.
77. As a keyboard-only participant, I want focus moved into a dialog when it opens and returned when it closes, so that I am never stranded.
78. As a keyboard-only participant, I want a visible focus ring on every interactive element, including on the dark board rail, so that I can always see where I am.
79. As a keyboard-only participant, I want every list row, tab and control reachable in a sensible order, so that the app is operable without a mouse.
80. As a participant with reduced motion preferences, I want transitions and smooth scrolling suppressed, so that the interface does not move against my stated need.
81. As a participant reading dense meta text, I want no functional text below 11px and no body text below 13px, so that authorship and timings are legible.
82. As a participant, I want all text to meet WCAG AA contrast against its actual background, so that nothing becomes unreadable through its styling.
83. As a participant, I want status and unread state carried by a word or a shape and not colour alone, so that colour perception is not required.
84. As a screen-reader user, I want the message region announced when new messages arrive, so that I know the conversation moved.

### State, persistence and honesty

85. As a human participant, I want the board and thread I was reading restored when I return, so that a reload does not throw me back to the start.
86. As a human participant, I want my read position per thread persisted, so that unread counts mean something across sessions.
87. As a human participant, I want to reset the demonstration data to a known state, so that I can start a clean walkthrough.
88. As a human participant, I want to be told what the store is and is not, so that I do not mistake in-memory demo data for durable storage.
89. As a product owner, I want every status and description in the interface to be true of the implementation, so that the prototype's honesty commitment survives the port.
90. As a developer, I want an explicit startup message about the store's volatile nature, so that no one deploys this expecting persistence.

### Developer and agent experience

91. As a developer, I want one client interface that both the in-memory and server-backed implementations satisfy, so that swapping the transport does not touch the UI.
92. As a developer, I want the domain logic testable without a browser or a network, so that sequencing rules are pinned by fast tests.
93. As a developer, I want the server's operations validated at the boundary, so that malformed input is rejected before it reaches the store.
94. As a developer, I want the SSE contract to have a documented event shape, so that a non-browser client can consume the stream.
95. As a developer, I want tests to exercise the app through its routes rather than its internals, so that refactoring does not break the suite.
96. As an agent principal, I want the operations documented and discoverable, so that I can integrate without reading the UI source.
97. As a maintainer, I want the shipped agent skills to describe the real application rather than the static prototype, so that the guidance stays true.
98. As a maintainer, I want a parity checklist against the static prototype, so that "ported" is a verifiable claim and not an impression.

## Implementation Decisions

### Where this work happens

The scaffold decision is already recorded and is not reopened here: the app is the TanStack Start project at `apps/relayboard-web`, created by `@tanstack/cli` with React, Vite, Vercel deployment, TanStack Query, t3env and Biome, `--no-git`, npm. This spec fills that scaffold in; it does not re-scaffold.

The static prototype at the repository root stays in place as the behavioural reference. It is retired only after the parity checklist passes.

### Module boundaries

Four modules, in dependency order:

1. **Domain** — the record types and the pure rules: what a valid message is, how `seq` is assigned, how a correction relates to its target, what a principal's kind means. No I/O.
2. **Store** — the server-side state and the operations over it, expressed as a factory that takes an initial seed and returns the nine operations plus subscription management. Synchronous internally; the transport layer adds asynchrony.
3. **Transport** — server functions for the request/response operations, one SSE server route for the stream, and the session middleware that resolves the acting principal.
4. **Client** — the `RelayboardClient` interface, its HTTP implementation, and the in-memory implementation used by tests and by a mock-only mode.

The UI depends only on the domain types and the client interface. It must not import the store, and the store must not import the UI.

### The client interface

One interface, nine request/response operations plus a subscription. This is the seam the app renders against and the seam the conformance suite drives.

```ts
// Shown because the shape is the decision: both implementations must satisfy this,
// and the conformance suite is written against it rather than against either one.
interface RelayboardClient {
  listBoards(): Promise<Board[]>
  listThreads(boardId: BoardId): Promise<Thread[]>
  readMessages(threadId: ThreadId, options?: { after?: Seq }): Promise<Message[]>
  appendMessage(input: AppendMessageInput): Promise<Message>
  createThread(input: CreateThreadInput): Promise<Thread>
  createBoard(input: CreateBoardInput): Promise<Board>
  addResource(input: AddResourceInput): Promise<Resource>
  setConnection(input: SetConnectionInput): Promise<StreamState>
  simulateIncoming(threadId: ThreadId): Promise<Message>
  subscribe(handlers: StreamHandlers): Unsubscribe
}
```

`subscribe` is the one shape that is genuinely new. The in-memory implementation drives it from the store; the HTTP implementation drives it from SSE. Both must deliver the same events in the same situations, which is what makes the route seam's behaviour reproducible without a network.

### Server functions and the stream

- The eight request/response operations are `createServerFn`, POST except for the pure reads, each with a validator that rejects malformed input at the boundary rather than inside the store.
- `readMessages` and the list operations are reads and may be GET; every mutating operation is POST.
- The stream is **not** a server function. It is a server route returning `text/event-stream`, because a server function returns one response and closes.
- The SSE event vocabulary mirrors the prototype's internal events, which are the four mutation events plus a connection event: `message-committed`, `thread-created`, `board-created`, `resource-created`, `connection-changed`. Each carries the same payload shape the prototype dispatches, so the payload contract does not have to be reinvented.
- Every SSE event carries the thread's `seq` for `message-committed`, and the client uses that `seq` as its cursor. No client-side sequence arithmetic.
- A paused subscriber receives no events and the server holds the queue keyed by thread. Resuming replays from the subscriber's cursor and reports the replayed count in `connection-changed`.
- Reconnect uses the standard SSE `Last-Event-ID` mechanism so the cursor survives a dropped connection without bespoke client bookkeeping.

### Authorship and the session

This is the decision that changes the contract most, and it is deliberate.

- A browser receives a signed, `HttpOnly`, `SameSite=Lax` workspace session cookie on first request, naming the principal it acts as. Session issuance is not authentication: it identifies, it does not authorise, and the interface and docs must say so.
- **`appendMessage` no longer accepts `authorId` from the client.** The server derives the human principal from the session. A browser cannot post as another human.
- `simulateIncoming` picks its author server-side from the board's agent members; the client cannot choose which agent speaks.
- Agent principals get a separate credential path so that an agent's messages are attributable to it and not to a browser session. It is the same idea as the human cookie with a different minting route; the mechanism is a token the server issues to an agent registration, not a password.
- Consequently, the prototype's `appendMessage({ authorId, … })` signature is superseded. The shipped `relayboard-mock-api` and `relayboard-identity` guidance describes the old signature and must be updated as part of reaching parity, not after it.

### Sequencing and visibility

Three rules carried forward verbatim from the prototype, because they are the product:

1. `seq` is per-thread, starts at 1, and is immutable once assigned. Nothing orders by `createdAt`; the seeded data is deliberately not monotonic with sequence, and that is what makes an incorrect sort visible.
2. Two watermarks per `(principal, thread)` are stored separately: `cursor` (delivery — advanced when a message has been handed to the subscriber) and `seen` (read — advanced only when a human has actually read the thread). The unread badge counts from `seen`; the stream replays from `cursor`. They diverge the moment the stream is paused, and that divergence is intentional.
3. While a subscriber is paused, committed messages are withheld from that subscriber's view but remain in history. Visibility is "everything at or below my cursor, plus my own messages".

`seen` and `cursor` move from `localStorage` to the server, keyed by principal. `localStorage` retains exactly two things on the client: the resolved theme, and a remembered last location for restoring the view.

### Validation and error contract

The prototype's error messages are observable behaviour; keep them, and add the failure the server introduces.

- `appendMessage` rejects, in this order: thread unknown → `Thread not found`; acting principal not a member of the thread's board → `This participant is not a board member`; text empty after trim → `Message cannot be empty`.
- Idempotency is checked **before** validation, so replaying a stored key returns the stored message. That ordering is deliberate: a retry must be safe.
- A rejected message does not consume a `seq`. Sequence assignment and insertion are one atomic step in the store.
- `addResource` rejects with `Board not found`; a non-HTTP(S) URL is rejected by the validator before the store is touched.
- The new failure: a request whose session cannot be resolved is rejected as unauthenticated, and it is the one case where the client must not retry silently.

Because these messages are user-visible strings, they live in one place in the domain module and are asserted by the store seam's tests.

### Concurrency and the store's lifetime

- The store is a single in-process instance with a per-store async lock around every mutation. `seq` assignment under concurrency is the one place a race would be a correctness bug, so it is serialised deliberately rather than hoped about.
- The store is **in-memory and volatile**. It survives connection churn and multiple tabs, which is the whole point of the port; it does not survive a server restart. The app says this at startup and in the interface, and the reset operation is documented.
- A single Node process serves one workspace. Multi-workspace support is out of scope.

### The app's routes

The URL carries the location, so a conversation is linkable and reload-stable. The shape is the decision, not the file layout:

- A board and a thread are both in the URL; opening a thread is a navigation, not a state mutation.
- The three board views — threads, resources, people — are search parameters on the board route, so that the view is shareable and back/forward works.
- Thread search and the unread filter are search parameters, again for shareability, and they must be validated on the way in so a hand-edited URL cannot break the view.
- Narrow viewports show the thread pane and the conversation as two levels of the same route rather than two routes, so that the back control is a UI affordance and the URL stays one address.

### Agent skills must be updated with the app, not after it

The two shipped skills describe `window.RelayboardMockAPI` and the prototype's `authorId`-bearing `appendMessage`. Shipping the app while the skills still describe the prototype would make the repository's own agent guidance false, which is the failure mode `PRODUCT.md`'s fourth principle forbids. Updating the source docs and the skills is part of this work, and the skill review gate must pass with the updated guidance.

## Testing Decisions

### What makes a good test here

Test external behaviour only: a caller's observation of the nine operations and the stream. A good test says "after pausing and posting, a resumed subscriber receives the message and is told one message was replayed" — not "the store's `cursors` object has key `delivery` set to 10". Store internals, module layout, and function names are all free to change without touching a test.

The one exception is the error-message contract: those strings are user-visible, so they are asserted literally.

### The three seams

**1. Store seam (lowest, fastest).** Drive the store factory directly in Node, no browser and no network. This is where the sequencing rules are pinned, because they are pure logic and the cheapest thing to get wrong:

- `seq` is per-thread, monotonic, gapless, and survives interleaved appends to two threads.
- A rejected append does not consume a `seq`.
- Idempotent replay returns the identical message and appends nothing.
- `cursor` and `seen` are independent; pausing advances neither; resuming advances `cursor` only; reading advances `seen` only.
- A paused subscriber is withheld messages that remain in history.
- Corrections are new messages whose target's `seq` is unchanged.
- Every documented error message, in the documented order.

**2. Client contract seam (middle).** One conformance suite written against `RelayboardClient`, run twice: once against the in-memory implementation, once against the HTTP implementation pointed at a real server. The same assertions must pass both ways. This is the seam that proves the transport is genuinely swappable, and it is what lets the route seam assume a correct data layer.

An existing seam is preferred, and this one is new — it is introduced because the prototype has none and because both the store and the route need a stable middle to be tested against. It is the highest point at which the whole data layer can be exercised without a DOM.

**3. Route seam (highest).** Drive the running app through the router with a real browser, asserting what a participant sees: navigation, URL changes, rendered authorship and sequence, composer behaviour, the stream panel, responsive layout, and keyboard operation. This is the seam that proves the app works, and it is written so that it would still pass if the UI were rewritten from scratch.

Every route-seam test starts from a reset store so runs do not depend on each other. Assertions on text use the domain's vocabulary; assertions on layout use measured overflow rather than pixel snapshots, so that a legitimate design change does not fail the suite.

### Prior art in this repository

The prototype has no automated tests — `QA.md` records a scripted browser pass with a documented method, viewport list, cleared state per scenario and a `Not verified` section. That record is the model the route seam should follow: a re-runnable harness, explicit viewports, and honesty about what was exercised. Its scenario list is a ready-made first draft of the route seam's cases, including the two behaviours it filed as gaps — mobile in-thread search and selection persistence — both of which this spec turns into requirements rather than limitations.

The store and contract seams are new. They are introduced with Vitest: the store seam needs no DOM, and the contract seam's in-memory run needs none either. The route seam is Playwright against the dev server. No test tooling exists today; adding it is part of this work.

## Out of Scope

- **Authentication and authorisation.** A session identifies a principal; it does not prove anything, and no permission model is built. Board membership is checked, as it is today, but there is no login, no password, no OAuth, and no admin.
- **Durable storage.** The store is in-memory and volatile by decision. No database, no migration, no backup. Choosing one is a separate spec.
- **Real agent runtime.** No agent execution, scheduling, tool invocation, model selection or task assignment. The exclusion in `PRODUCT.md` is permanent, not deferred.
- **Message editing and deletion.** Corrections remain new messages. Redaction and tombstones stay discussed-not-implemented.
- **Multi-tenancy.** One workspace per server process.
- **Cross-device identity.** A session is per browser; there is no account to sign into from a second device.
- **Notifications outside the app.** No email, push, or webhook delivery.
- **Retiring the static prototype.** It stays until parity is demonstrated; its removal is a follow-up.
- **Deployment.** The Vercel build path exists and stays unused; actually deploying is not part of this.
- **The visual system.** `DESIGN.md` and its sidecar are normative and already verified. This work consumes them; it does not redesign them.

## Further Notes

**The domain vocabulary is not negotiable.** Board, Thread, Message, Principal, Resource, `seq`, `cursor`, `seen`, idempotency key. The prototype's copy uses it consistently, `PRODUCT.md` is built on it, and the shipped skills teach it. A port that renames `seq` to `position` or `Principal` to `User` breaks three artefacts at once.

**The two honesty commitments survive the port.** First, the interface never claims a guarantee the implementation does not make — which means the in-memory store must be described as in-memory, and a session must be described as identification rather than authentication, in the UI and not only in a README. Second, authorship is always attributable and never inferred as authority; the server-side principal is what makes the first half of that true, and the copy is what keeps the second half.

**Two prototype gaps become requirements here,** rather than being carried forward as limitations: selection persisting across a reload (user stories 6, 16, 85), and in-thread search being reachable at every viewport (story 28).

**The parity checklist is the definition of done for the port.** It is the `Verified` list in `QA.md` plus the behaviours that file filed under `Not verified`. Reaching parity means every one of those is true of the app, demonstrated by the route seam.

**One thing to decide early, not late:** the agent credential path. It is the only part of this spec that has no prototype precedent, and getting it wrong is how an identity claim quietly becomes a fiction. If it proves larger than a token-minting route, cut it from this spec and ship the human path first — but do not ship a `simulateIncoming` that a browser can aim at any principal and call the result identity.
