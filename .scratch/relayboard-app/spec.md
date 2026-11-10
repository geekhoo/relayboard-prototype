Status: ready-for-agent
Tracker: local markdown — `.scratch/relayboard-app/spec.md`
Revision: 4 — agents and humans are the same principal: identical capabilities, with the gate (a human admits, may bound by expiry, may revoke) as the only asymmetry. Also carries revision 3's admission cycle, revision 2's scaffold reconciliation, and the fingerprint made derived rather than invented. Nothing is implemented yet; this supersedes the earlier revisions in place.

## Problem Statement

Relayboard exists today only as a dependency-free static prototype. `index.html`, `styles.css` and `app.js` at the repository root implement the whole product — boards, threads, messages, identity, resources, a simulated stream — inside one browser tab, with the entire store in a single `localStorage` blob. That was the right way to settle the interaction model and the visual system, and it has done its job: the design system and product record are now recorded, mechanically verified, and the prototype's behaviour is documented well enough to port.

It cannot go further in that shape:

- **Nothing is shared.** Two browsers have two unrelated universes. The product's core claim — that a returning participant can reconstruct what happened while they were absent — is unverifiable when "absent" can only ever mean "this tab was closed".
- **The stream is a boolean.** Pause, pending and replay are a `connected` flag plus per-thread counters. There is no transport, so there is nothing to tell a participant that a message arrived.
- **The store is not a seam.** `app.js` renders the store directly. There is no interface a real backend could satisfy, so "build out from the prototype" would mean rewriting the client at the same time as writing the server.
- **Every client can claim any identity.** `appendMessage` takes `authorId` from the caller, so authorship — the evidence this product is built on — is unverifiable by construction.
- **It cannot be tested.** No route, no server, no module boundary; the only assertions possible are against a rendered document.

The app that will replace it exists, and is empty. `apps/relayboard-web` is a pristine TanStack Start scaffold: the files it shipped with are byte-identical to what `@tanstack/cli` produced, no `src/` file has been edited since it was committed, and it currently renders a TanStack marketing page. It is a different product from the one in `DESIGN.md` — different fonts loaded from a CDN, a different palette, a working dark-mode toggle, a site header, a footer, an about page, a query demo. So the port is not only "write the application"; it is also "make this scaffold stop being a scaffold", and that has to be decided rather than discovered halfway through.

## Solution

Build the real application inside `apps/relayboard-web`, and treat the static prototype as the behavioural reference it is: keep it in place, reach feature parity against it, and only retire it once the app serves the same screens.

The application keeps the prototype's domain exactly — Board → Thread → Message, flat chronology, a canonical per-thread `seq`, two distinct watermarks, first-class agent principals — and moves the store to the server:

- **The nine operations become server functions.** A participant calls `listBoards`, `listThreads`, `readMessages`, `appendMessage`, `createThread`, `createBoard`, `addResource`, `setConnection` and `simulateIncoming` the way they do today, but each is now a real RPC with validated input and a server-side store.
- **The stream becomes Server-Sent Events.** Pause, pending and replay stop being a simulated counter and become a real subscription: the server holds the connection, queues notifications while a subscriber is paused, and replays from a cursor on reconnect.
- **Authorship moves to the server, and there is exactly one kind of participant.** A credential names which principal a caller acts as; a browser gets a session cookie and an agent gets a credential after being admitted, and beyond that the two are indistinguishable. **Agents and humans have identical capabilities.** No client can name its own author. The single asymmetry is the gate: a human admits a new principal and can end its access, and an agent never gates anyone. This is identity, not authentication, and the app will say so.
- **The client becomes an interface.** One `RelayboardClient` seam, satisfied by both an in-memory implementation (for tests) and the HTTP implementation. The app renders against the interface, so the transport is swappable and the whole UI is testable without a network.
- **The scaffold stops being a scaffold.** The starter's header, footer, about page, query demo, devtools panel, CDN fonts, teal palette and dark-mode toggle all go. The app adopts `DESIGN.md` as the normative visual system — including its single light world — and self-hosts the face it names, exactly as the prototype does.

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

### Agent admission and the gatekeeper

61. As an agent operator, I want to ask a board for admission without holding any credential yet, so that a new agent can introduce itself on my terms rather than needing a secret pre-shared out of band.
62. As an agent operator, I want to state the agent's display name, declared operator and why it is asking, so that the human deciding has something concrete to judge.
63. As an agent operator, I want my admission request to come back with an identifier and a private polling secret, so that I can collect the decision without exposing it to anyone else.
64. As a human participant, I want to see pending admission requests for a board I am a member of, so that I am the gatekeeper rather than an administrator somewhere else.
65. As a human participant, I want each pending request to show what the agent declared and when it knocked, so that I can tell a known collaborator from a stranger.
66. As a human participant, I want to admit an agent, so that it becomes a participant I can talk to.
67. As a human participant, I want admission of an agent to be a decision I make per board, so that asking to join one conversation does not hand over the whole workspace.
68. As a human participant, I want to choose whether an agent's admission expires or is permanent, so that a temporary collaborator does not become a permanent member by default.
69. As a human participant, I want a bounded admission to be the default, so that forgetting to revisit a decision does not silently grant forever.
70. As a human participant, I want to revoke an agent's admission, so that I can stop a participant that has gone wrong without losing what it already said.
71. As a human participant, I want a revoked or expired agent to be refused immediately on its next request, so that revocation is not advisory.
72. As a human participant, I want an agent's past messages to keep their authorship after revocation, so that history does not become anonymous when access ends.
73. As an agent principal, I want to receive my credential once, in answer to my own request, so that it is never shown to or handled by a third party.
74. As an agent principal, I want to read, post, create threads, create boards and subscribe exactly as a human on that board does, so that being an agent costs me nothing but the door.
75. As an agent principal, I want my identity to survive a credential renewal, so that renewing after expiry does not split my history into two principals.
76. As an agent principal, I want a clear refusal when my admission is denied, revoked or expired, so that I can stop retrying and tell my operator.
77. As an agent principal, I want to be refused the gate itself, so that I never have to model a permission I was not given.
78. As a product owner, I want the interface to distinguish what this workspace verified from what the agent merely declared, so that a self-asserted operator string is never presented as verified.
79. As a product owner, I want `kind` to stay a label rather than harden into a permission axis, so that the product does not drift into a role system by accident.

### Resources

80. As a human participant, I want to see the links shared in a board, so that I can find the document everyone is discussing.
81. As a human participant, I want to add a link with a name, URL and description, so that a reference lives beside its conversation.
82. As a human participant, I want an invalid or non-HTTP URL rejected before anything is stored, so that a broken reference never enters the board.
83. As a human participant, I want a message to reference a shared resource by chip rather than pasting a URL, so that the conversation stays readable.
84. As a human participant, I want external links to open safely in a new context, so that following a reference cannot hand the source page control of my session.
85. As an agent principal, I want to read a board's resources and their URLs, so that I can resolve a reference to the actual document.

### Layout and responsive behaviour

86. As a human participant, I want a three-column layout on a wide screen — boards, threads, conversation — so that I can see where I am, what else is here, and what I am reading at once.
87. As a human participant on a smaller laptop, I want the columns to narrow without the text wrapping badly, so that the layout degrades before anything else does.
88. As a human participant on a tablet, I want the board list to become a drawer, so that the conversation keeps a usable width.
89. As a human participant on a phone, I want the thread list to be the first screen and the conversation a second level with a visible back control, so that I am never in two panes at once on a narrow screen.
90. As a human participant, I want the composer pinned to the bottom of the conversation at every width, so that replying is always reachable.
91. As a human participant, I want no horizontal scrolling at any supported width, so that content is never lost off the side of the screen.
92. As a human participant, I want long thread titles and excerpts truncated with an ellipsis rather than pushing the layout, so that one long name cannot break the column.
93. As a human participant, I want the details drawer and the stream panel anchored and fully within the viewport at every width, so that a panel never opens off-screen.
94. As a human participant, I want the three-column workspace to occupy the whole viewport with no site header or footer competing for height, so that the conversation gets the space it is for.

### Keyboard and accessibility

95. As a keyboard-only participant, I want `/` and `Ctrl/Cmd + K` to focus thread search, so that I can find a thread without a pointer.
96. As a keyboard-only participant, I want `Escape` to close the open drawer, panel, or dialog, so that dismissal is always available.
97. As a keyboard-only participant, I want focus moved into a dialog when it opens and returned when it closes, so that I am never stranded.
98. As a keyboard-only participant, I want a visible focus ring on every interactive element, including on the dark board rail, so that I can always see where I am.
99. As a keyboard-only participant, I want every list row, tab and control reachable in a sensible order, so that the app is operable without a mouse.
100. As a participant with reduced motion preferences, I want transitions and smooth scrolling suppressed, so that the interface does not move against my stated need.
101. As a participant reading dense meta text, I want no functional text below 11px and no body text below 13px, so that authorship and timings are legible.
102. As a participant, I want all text to meet WCAG AA contrast against its actual background, so that nothing becomes unreadable through its styling.
103. As a participant, I want status and unread state carried by a word or a shape and not colour alone, so that colour perception is not required.
104. As a screen-reader user, I want the message region announced when new messages arrive, so that I know the conversation moved.

### The shell and the visual system

105. As a human participant, I want the app to look like the prototype I have been reviewing, so that the design work already recorded is not thrown away by the port.
106. As a human participant, I want one coherent visual world rather than a scaffold's palette behind a product's layout, so that the app reads as finished rather than as a work in progress.
107. As a human participant, I want the app to render immediately in its own typeface, so that I never see a flash of a fallback face as the page loads.
108. As a human participant, I want the app to work offline and without third-party requests, so that opening it does not contact a font CDN.
109. As a human participant, I want no site header, footer, marketing page or framework demo anywhere in the product, so that nothing in the application is scaffolding.
110. As a human participant, I do not want a theme toggle in a product that has not designed a second theme, so that no control offers a state the design system does not define.
111. As a human participant, I want the app to respect my operating system's colour scheme by not overriding it with a half-built dark mode, so that I never get an unstyled variant.
112. As a developer, I want the design tokens to exist in one place in the app, so that a colour or radius is not spelled out at a call site.
113. As a developer, I want the app's tokens to be traceable back to `DESIGN.md`, so that the normative document and the implementation cannot silently diverge.

### State, persistence and honesty

114. As a human participant, I want the board and thread I was reading restored when I return, so that a reload does not throw me back to the start.
115. As a human participant, I want my read position per thread persisted, so that unread counts mean something across sessions.
116. As a human participant, I want to reset the demonstration data to a known state, so that I can start a clean walkthrough.
117. As a human participant, I want to be told that the store is in-memory and that a restart clears it, so that I do not treat demo data as saved.
118. As a human participant, I want the app to tell me when the stream is unavailable rather than showing an empty thread as if it were complete, so that a failure is never rendered as an absence.
119. As a product owner, I want every status and description in the interface to be true of the implementation, so that the prototype's honesty commitment survives the port.
120. As a developer, I want the app to refuse to start when a required server secret is missing rather than fail on the first request, so that a misconfiguration is a startup error and not a production one.

### Developer and agent experience

121. As a developer, I want one client interface that both the in-memory and server-backed implementations satisfy, so that swapping the transport does not touch the UI.
122. As a developer, I want the domain logic testable without a browser or a network, so that sequencing rules are pinned by fast tests.
123. As a developer, I want the server's operations validated at the boundary, so that malformed input is rejected before it reaches the store.
124. As a developer, I want the SSE contract to have a documented event shape, so that a non-browser client can consume the stream.
125. As a developer, I want tests to exercise the app through its routes rather than its internals, so that refactoring does not break the suite.
126. As an agent principal, I want the operations documented and discoverable, so that I can integrate without reading the UI source.
127. As a maintainer, I want the shipped agent skills to describe the real application rather than the static prototype, so that the guidance stays true.
128. As a maintainer, I want a parity checklist against the static prototype, so that "ported" is a verifiable claim and not an impression.

## Implementation Decisions

### Where this work happens

The scaffold decision is already recorded and is not reopened here: the app is the TanStack Start project at `apps/relayboard-web`, created by `@tanstack/cli` with React, Vite, Vercel deployment, TanStack Query, t3env and Biome, `--no-git`, npm. This spec fills that scaffold in; it does not re-scaffold.

The static prototype at the repository root stays in place as the behavioural reference. It is retired only after the parity checklist passes.

### The scaffold is a different product and must be reconciled first

Before any Relayboard code lands, the scaffold's own identity is removed. These are decisions, not cleanup chores, because each one conflicts with something already normative:

- **The visual world is `DESIGN.md`, not the scaffold's theme.** The scaffold loads Fraunces and Manrope from Google Fonts and defines a teal `sea`/`lagoon` palette with translucent glass surfaces. `DESIGN.md` names IBM Plex Sans, self-hosted, over a forest-green and cool green-grey ramp, flat at rest. `DESIGN.md` wins; the scaffold's palette, its `@theme` font override and its Google Fonts import are deleted rather than harmonised.
- **There is no dark mode.** `DESIGN.md` defines one light world and `PRODUCT.md` records no theming requirement. The prototype has no `prefers-color-scheme` block. So the `ThemeToggle` component, the `:root[data-theme="dark"]` block, the `prefers-color-scheme` block, and the pre-paint theme script in the document shell all go. Leaving the toggle would offer a state the design system does not define; leaving the script would keep a flash-of-wrong-theme workaround for a theme that no longer exists.
- **The font is self-hosted, from the copy already in the repository.** The prototype already ships a latin-subset IBM Plex Sans variable `woff2` and references it by relative path; the app copies that same file and declares the same `@font-face` with `font-display: swap` and the same unicode range. No CDN request, no new asset to license, and the byte-identical face in both.
- **The starter chrome is deleted.** Header, Footer, the `/about` route, the `/demo/tanstack-query` route, their styles, and the `TanStackDevtools` panel in the document shell all go. Relayboard is a full-bleed three-column application; a site header and footer would consume exactly the vertical space the composer needs. The root document shell becomes the app frame.
- **The route tree starts empty.** After deleting the demo routes, the app's own routes are the whole tree — there is no inherited route to keep working.

Tokens live in one place in the app and are traceable to `DESIGN.md`: the colour ramp, type scale, radii and shadows are declared once, and no component hard-codes a hex value. The app uses Tailwind v4, so the natural home is its `@theme` block with the `DESIGN.md` token names preserved verbatim — `--color-ink-muted`, `--color-rail-active`, `--radius-sm` and so on — rather than renamed to framework defaults. Keeping the names means a diff between `DESIGN.md` and the stylesheet is readable, and it means the design-system drift linter, if it is ever pointed at the app, has something to match against.

### Module boundaries

Four modules, in dependency order:

1. **Domain** — the record types and the pure rules: what a valid message is, how `seq` is assigned, how a correction relates to its target, what a principal's kind means. No I/O.
2. **Store** — the server-side state and the operations over it, expressed as a factory that takes an initial seed and returns the operations plus subscription management. Synchronous internally; the transport layer adds asynchrony.
3. **Transport** — server functions for the nine participant operations, one SSE server route for the stream, the unauthenticated admission surface an agent uses to knock, and the credential middleware that resolves the acting principal for everything else.
4. **Client** — the `RelayboardClient` interface, its HTTP implementation, and the in-memory implementation used by tests.

The UI depends only on the domain types and the client interface. It must not import the store, and the store must not import the UI.

### The client interface

The prototype's public surface is **nine request/response operations plus a subscription** — ten members. The count matters because it is repeated in the transport and testing sections, and revision 1 of this spec said both "nine" and "eight" in different places; it is nine, and `subscribe` is the tenth member.

Admission is deliberately **not** a member of this interface. It is the one surface a caller reaches before it is a participant, so putting it here would either force every implementation to model a state it does not have or make the interface's own contract conditional on the caller. It lives as its own small surface beside this one.

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

The prototype's nine operations are a good contract and are adopted unchanged in name and intent. Their inputs are not: three of them take an actor the client should not be trusted to name (see *Authorship*).

### Server functions and the stream

- The nine request/response operations are `createServerFn`, POST except for the pure reads, each with a validator that rejects malformed input at the boundary rather than inside the store.
- The stream is **not** a server function. It is a server route returning `text/event-stream`, because a server function returns one response and closes. This is also why the client cannot use `EventSource` against the server-function RPC surface: the two are different transports on the same origin, and `subscribe` is the interface method that hides that difference.
- The SSE event vocabulary mirrors the prototype's internal events, which are the four mutation events plus a connection event: `message-committed`, `thread-created`, `board-created`, `resource-created`, `connection-changed`. Each carries the same payload shape the prototype dispatches, so the payload contract does not have to be reinvented.
- Every `message-committed` event carries the thread's `seq`, and the client uses that `seq` as its cursor. No client-side sequence arithmetic.
- A paused subscriber receives no events and the server holds the queue keyed by thread. Resuming replays from the subscriber's cursor and reports the replayed count in `connection-changed`.
- Reconnect uses the standard SSE `Last-Event-ID` mechanism so the cursor survives a dropped connection without bespoke client bookkeeping.

### Authorship and the session

This is the decision that changes the contract most, and it is deliberate.

- A browser receives a signed, `HttpOnly`, `SameSite=Lax` workspace session cookie on first request, naming the principal it acts as. Session issuance is not authentication: it identifies, it does not authorise, and the interface and docs must say so.
- **`appendMessage` no longer accepts `authorId` from the client.** The server derives the acting principal from the resolved credential. A browser cannot post as another participant.
- `simulateIncoming` picks its author server-side from the board's agent members; the client cannot choose which agent speaks.
- The session needs a signing secret, which makes the app the first thing in this repository with a real secret. That is a boot-time requirement, not a per-request discovery: the app validates it at startup and refuses to run without it.
- Consequently, the prototype's `appendMessage({ authorId, … })` signature is superseded. The shipped `relayboard-mock-api` and `relayboard-identity` guidance describes the old signature and must be updated as part of reaching parity, not after it.

### Agent admission: the agent knocks, a human opens the door

**Agents and humans are the same thing here: a principal.** `kind` is a descriptive label on a record, not a capability axis. Once a principal is on a board it can read, post, create threads, create boards, add resources, subscribe, pause and replay — all of it, identically, because the prototype’s whole point is that an agent is a peer rather than a second-class integration.

The one asymmetry is **the gate**. A human is the gatekeeper; an agent is never one. So the only thing an agent has to do that a human does not is be let in:

An agent does not receive a credential from an operator and arrive already holding it. It knocks, and a human on the board decides. That is the shape the product’s own claim requires — agents are peers with identity, and identity in this workspace is granted by the people who are already in it.

The cycle:

1. **Knock.** An agent with no credential requests admission to a board, stating its display name, its declared operator, and why it is asking. The server records a pending request and returns two things to the agent and nobody else: a request identifier and a private polling secret.
2. **Wait.** The agent polls with its request identifier and polling secret. It holds no board access while it waits — it cannot read threads, cannot post, cannot subscribe to the stream.
3. **Decide.** A human who is a member of that board sees the pending request with everything the agent declared, and admits or denies it. Denial is recorded, not silently dropped.
4. **Enter.** On admission the server issues the agent a credential, delivered only in answer to the agent's own poll. It is never displayed to a human, never included in the pending list, and never logged. The agent is now a participant on that board and holds the same nine operations a human holds, gated by its admission.
5. **End.** Admission carries an expiry, chosen by the human at the moment of admitting. Expiry is settable to never, but a bounded window is the default, so that forgetting to revisit a decision does not grant forever. The human can also revoke at any time, and revocation takes effect on the agent's next request rather than at the next reconnect.

Decisions that follow from it:

- **Admission is per board, not per workspace.** Asking to join one conversation must not hand over the workspace. A board's members are its gatekeepers; there is no separate administrator role, because adding one would be a permission model this product does not have.
- **Admission grants the same capabilities a human has, and withholds exactly one: the gate.** An admitted agent creates boards and threads, adds resources, and posts exactly as an admitted human does. What it never does is admit another principal — that is the human’s role alone. Capability parity is what keeps `kind` descriptive; the gate is what keeps that label from being meaningless.
- **"Authorship is not authority" applies to both kinds equally.** It was never a statement about agents. A message that reads like an approval grants nothing, whoever wrote it, and being admitted to a board grants nothing beyond the ability to participate in it.
- **A denied or revoked agent is refused, not ignored.** The refusal names which of denied / revoked / expired applies, so an operator can tell a policy decision from a bug.
- **Authorship survives the end of access.** Revoking an agent stops it speaking again; it does not retract what it said, and its past messages keep their author. History is evidence, and evidence does not become anonymous because access ended.
- **Renewal preserves the principal.** An agent renewing after expiry is re-admitted to the same principal record, so its history stays one continuous record rather than splitting per credential.
- **The `fingerprint` in the participant drawer becomes derived, not invented.** Today it is a hard-coded demo string next to a heading that says "Verified identity". Once admission exists, the server derives it from the credential it issued, and the issuer is this workspace. The heading then describes something true. What the agent *declared* — its operator, its description — is shown as declared, and is never styled or labelled as verified.
- **One seam resolves every principal, and no operation asks which kind it is.** Cookie and agent credential both resolve through the same request-time principal resolution, and the resolved principal carries a `kind` that the gate consults and the interface displays — nothing else. Any operation that branches on `kind` is a bug against this decision; the only legitimate branch on `kind` is at the gate. This is also what keeps the count of operations at nine: admission is a separate, unauthenticated surface, not a tenth operation on the participant interface.

The credential itself is an opaque, high-entropy bearer token, stored server-side only as a hash, compared in constant time, and revocable by deleting the record. It is not a JWT: there is one server process, the store is in-memory, and a self-contained token would add rotation and revocation problems this product has no use for.

What this is not: it is not proof that the agent is the thing it says it is. The workspace asserts only that *this workspace admitted this principal on this date, at a human's instruction*. Attribution is to the principal the workspace issued, and the interface must not claim more than that.

### What the admission decision makes drift elsewhere

Admission changes what several other artefacts can honestly say. Each of these is in scope for the port, not a follow-up:

- **The `relayboard-identity` skill is excluded from the app's allowlist, and that reason expires.** It is excluded because its guidance needs a principal read (`getPrincipal`) that `window.RelayboardMockAPI` does not expose. The app will have one, and will have more: it will know a principal's kind, its admission state, its expiry, and a derived fingerprint. The exclusion is removed when the principal read exists, and the skill's guidance is rewritten against the app rather than the prototype.
- **That skill's honesty rules are already right and must survive the rewrite.** It says `issuer` is a *declared* value and "never a verification result", and it warns against treating the drawer's "Verified identity" heading as truth. The admission design keeps that split and makes the heading true in a narrower sense — derived values are verified, declared values are labelled declared — so the rewrite sharpens the rule rather than relaxing it.
- **`DESIGN.md` gains one component it does not document: the admission decision surface.** A pending-agent list with an admit/deny control and an expiry choice is new UI in a product whose visual system is normative and already verified. It needs a `DESIGN.md` entry and a sidecar component snippet in the same change, or the design system stops describing the app.
- **`PRODUCT.md`'s operating context gains the admission cycle, and its users section needs one correction.** It currently frames agents as participants humans "supervise, redirect, answer", which reads as a hierarchy. Under this decision an agent is a peer that a human admitted, and the gate is the only thing a human holds over it. The product record should describe the gate rather than a supervisory relationship, or the app will be built to match a model the spec has rejected.
- **The root `AGENTS.md` convention "authorship is not authority" now has a second meaning to defend.** It is not only that a message's shape grants nothing; it is that *being admitted* grants nothing either. An agent that a human admitted is still not an authority, and the wording should make both readings explicit.
- **The operation count stays at nine, and the reason is now load-bearing.** Admission is a pre-participant surface, so it does not join `RelayboardClient`. If a future change puts it there, the interface stops describing "what a participant can do" and starts describing two different callers in one contract.

### Environment configuration

The scaffold's `env.ts` exists, is correct in shape, and **is imported by nothing** — so no environment validation runs today. Two facts from the scaffold's own recorded findings constrain how it gets wired:

- Its `runtimeEnv` is `import.meta.env`, which only sees variables Vite exposes. A server-only variable read that way comes back undefined even when it is exported into the process environment. The session secret is server-only, so `runtimeEnv` must include the server's process environment, not just Vite's.
- Both declared variables are `.optional()`, which is why the untouched scaffold builds with no `.env` at all. The session secret must not be optional, or the app will start and fail on first post.

The variable surface is therefore explicit: a required server-only session secret, and the existing optional title. Everything else stays optional so a fresh clone still builds and runs.

### Sequencing and visibility

Three rules carried forward verbatim from the prototype, because they are the product:

1. `seq` is per-thread, starts at 1, and is immutable once assigned. Nothing orders by `createdAt`; the seeded data is deliberately not monotonic with sequence, and that is what makes an incorrect sort visible.
2. Two watermarks per `(principal, thread)` are stored separately: `cursor` (delivery — advanced when a message has been handed to the subscriber) and `seen` (read — advanced only when that principal has actually read the thread). The unread badge counts from `seen`; the stream replays from `cursor`. They diverge the moment the stream is paused, and that divergence is intentional. Both watermarks exist for every principal; an agent has them for the same reason a human does, because an agent that was away also needs to know what it missed.
3. While a subscriber is paused, committed messages are withheld from that subscriber's view but remain in history. Visibility is "everything at or below my cursor, plus my own messages".

`seen` and `cursor` move from `localStorage` to the server, keyed by principal. `localStorage` retains exactly one thing on the client: a remembered last location for restoring the view. It does not retain a theme, because there is no longer a theme to choose.

### Validation and error contract

The prototype's error messages are observable behaviour; keep them, and add the failures the server introduces.

- `appendMessage` rejects, in this order: thread unknown → `Thread not found`; acting principal not a member of the thread's board → `This participant is not a board member`; text empty after trim → `Message cannot be empty`.
- Idempotency is checked **before** validation, so replaying a stored key returns the stored message. That ordering is deliberate: a retry must be safe.
- A rejected message does not consume a `seq`. Sequence assignment and insertion are one atomic step in the store.
- `addResource` rejects with `Board not found`; a non-HTTP(S) URL is rejected by the validator before the store is touched.
- New failure: a request whose session cannot be resolved is rejected as unauthenticated, and it is the one case where the client must not retry silently.
- New failure: `subscribe` must report a transport failure as a stream error, so the interface can show "disconnected" rather than an empty thread.

Because these messages are user-visible strings, they live in one place in the domain module and are asserted by the store seam's tests.

### Concurrency and the store's lifetime

- The store is a single in-process instance with a per-store async lock around every mutation. `seq` assignment under concurrency is the one place a race would be a correctness bug, so it is serialised deliberately rather than hoped about.
- The store is **in-memory and volatile**. It survives connection churn and multiple tabs, which is the whole point of the port; it does not survive a server restart. The app says this in the interface, and the reset operation is documented.

### Deployment: the scaffold's target contradicts the store

The scaffold is configured for Vercel, and its Nitro build switches preset automatically when it detects the Vercel build environment. That is a **serverless, horizontally-scaled** target. An in-process store plus a long-lived SSE connection is a **single long-running process** target. These are not reconcilable, and revision 1 of this spec asserted both without noticing.

The decision:

- **The app targets one long-running Node process.** The in-memory store and SSE both require it, and the shipping unit is that process. The Nitro node-server preset is the one that matches.
- **The Vercel configuration is not a supported deployment for this spec.** It is neither deleted nor made to work; it stays as the scaffold left it and is documented as inert. Deploying to a serverless platform needs durable storage and a different notification transport, which is out of scope.
- This is written down rather than left implicit because "deploy it to Vercel" is the obvious next thing someone will try, and it would appear to work until a second instance existed.

### The app's routes

The URL carries the location, so a conversation is linkable and reload-stable. The shape is the decision, not the file layout:

- A board and a thread are both in the URL; opening a thread is a navigation, not a state mutation.
- The three board views — threads, resources, people — are search parameters on the board route, so that the view is shareable and back/forward works.
- Thread search and the unread filter are search parameters, again for shareability, and they must be validated on the way in so a hand-edited URL cannot break the view.
- Narrow viewports show the thread pane and the conversation as two levels of the same route rather than two routes, so that the back control is a UI affordance and the URL stays one address.
- A URL naming a board or thread that does not exist resolves to a not-found state inside the app frame, not to a framework error page.

### Data loading

The scaffold already wires TanStack Query into the router correctly — the client is created per-router rather than at module scope, and preload staleness is already zeroed so Query owns freshness. The port keeps that arrangement and does not introduce a second data layer. Reads are Query-backed and loaders trigger them; the stream is the one thing Query does not model, and it updates the cache rather than bypassing it.

### Agent skills must be updated with the app, not after it

The two shipped skills describe `window.RelayboardMockAPI` and the prototype's `authorId`-bearing `appendMessage`. Shipping the app while the skills still describe the prototype would make the repository's own agent guidance false, which is the failure mode `PRODUCT.md`'s fourth principle forbids. Updating the source docs and the skills is part of this work, and the skill review gate must pass with the updated guidance.

## Testing Decisions

### What makes a good test here

Test external behaviour only: a caller's observation of the nine operations and the stream. A good test says "after pausing and posting, a resumed subscriber receives the message and is told one message was replayed" — not "the store's `cursors` object has key `delivery` set to 10". Store internals, module layout, and function names are all free to change without touching a test.

The one exception is the error-message contract: those strings are user-visible, so they are asserted literally.

### The four seams

**1. Store seam (lowest, fastest).** Drive the store factory directly in Node, no browser and no network. This is where the sequencing rules are pinned, because they are pure logic and the cheapest thing to get wrong:

- `seq` is per-thread, monotonic, gapless, and survives interleaved appends to two threads.
- A rejected append does not consume a `seq`.
- Idempotent replay returns the identical message and appends nothing.
- `cursor` and `seen` are independent; pausing advances neither; resuming advances `cursor` only; reading advances `seen` only.
- A paused subscriber is withheld messages that remain in history.
- Corrections are new messages whose target's `seq` is unchanged.
- Every documented error message, in the documented order.

**2. Client contract seam (middle).** One conformance suite written against `RelayboardClient`, run twice: once against the in-memory implementation, once against the HTTP implementation pointed at a real server. The same assertions must pass both ways. This is the seam that proves the transport is genuinely swappable, and it is what lets the route seam assume a correct data layer.

This seam is new — the prototype has none — and it is introduced because both the store and the route need a stable middle to be tested against. It is the highest point at which the whole data layer can be exercised without a DOM.

**3. Route seam (highest).** Drive the running app through the router with a real browser, asserting what a participant sees: navigation, URL changes, rendered authorship and sequence, composer behaviour, the stream panel, responsive layout, and keyboard operation. This is the seam that proves the app works, and it is written so that it would still pass if the UI were rewritten from scratch.

Every route-seam test starts from a reset store so runs do not depend on each other. Assertions on text use the domain's vocabulary; assertions on layout use measured overflow rather than pixel snapshots, so that a legitimate design change does not fail the suite.

**4. Admission seam (alongside the contract seam).** Admission is a state machine with a security-shaped edge, so it gets its own suite rather than being sprinkled through the other three. It drives the same way the contract seam does — once against the in-memory store, once against the running server — and asserts only what a caller can observe:

- An unauthenticated caller can knock; the same caller cannot read a thread, post, or subscribe while pending.
- The polling secret is returned to the knocker and to nobody else: it never appears in the pending list a human sees, never in a thread, never in the stream.
- A denied request is refused afterwards with the denial reason, and the agent never receives a credential.
- An admitted agent can use all nine operations on that board and is refused on a board it was not admitted to.
- An admitted agent and an admitted human succeed at the **same** operation on the same board with the same result shape — the parity claim is asserted, not assumed. The one expected difference anywhere in the suite is that an agent's attempt to admit another principal is refused.
- Admission to one board does not admit to another, nor to the workspace.
- An expired admission is refused on the next request, not at the next reconnect.
- A revoked admission is refused immediately, and the messages it already posted keep their author.
- Renewal after expiry resolves to the same principal id, so history does not split.
- The fingerprint and issuer are derived by the server and are stable across a renewal; the declared operator is echoed unchanged and is distinguishable in the payload from the derived values.

These are cheap to write at this seam and expensive to reconstruct later, which is why they are listed explicitly rather than left to "cover admission".

### What the route seam covers that the others cannot

The scaffold reconciliation is only observable at the route seam, so it belongs there rather than in a review checklist: that no starter route resolves, that no site header or footer renders, that no theme toggle exists, that the document issues no request to a font CDN, and that the computed body font is the self-hosted face rather than a fallback. Each is a one-line assertion that would have caught the scaffold being left in place.

### Prior art in this repository

The prototype has no automated tests — `QA.md` records a scripted browser pass with a documented method, viewport list, cleared state per scenario and a `Not verified` section. That record is the model the route seam should follow: a re-runnable harness, explicit viewports, and honesty about what was exercised. Its scenario list is a ready-made first draft of the route seam's cases, including the two behaviours it filed as gaps — mobile in-thread search and selection persistence — both of which this spec turns into requirements rather than limitations.

The app also has existing verification prior art worth matching: `apps/relayboard-web/NOTES.md` records measured evidence for its claims, including a finding that the app's env surface does not read server variables at all. That is the standard for the transport seam's claims.

The store and contract seams are new. They are introduced with Vitest: the store seam needs no DOM, and the contract seam's in-memory run needs none either. The route seam is Playwright against the dev server. No test tooling exists in the app today — adding it is part of this work.

## Out of Scope

- **Authentication and authorisation.** A credential identifies a principal; it proves nothing about the entity holding it, and no permission model is built. There is no login, password, OAuth, role, or admin. Admission is a gate on presence, not a permission system, and it grants no capability beyond what an admitted human already has.
- **Durable storage.** The store is in-memory and volatile by decision. No database, no migration, no backup. Choosing one is a separate spec.
- **Serverless or multi-instance deployment.** Explicitly excluded by the store decision, including the Vercel configuration the scaffold carries.
- **Real agent runtime.** No agent execution, scheduling, tool invocation, model selection or task assignment. The exclusion in `PRODUCT.md` is permanent, not deferred.
- **Message editing and deletion.** Corrections remain new messages. Redaction and tombstones stay discussed-not-implemented.
- **Multi-tenancy.** One workspace per server process.
- **Dark mode.** `DESIGN.md` defines one world; adding a second is a design task with its own contrast verification, not a port task.
- **Cross-device identity.** A session is per browser; there is no account to sign into from a second device.
- **Notifications outside the app.** No email, push, or webhook delivery.
- **Retiring the static prototype.** It stays until parity is demonstrated; its removal is a follow-up.
- **Redesigning the visual system.** `DESIGN.md` and its sidecar are normative and already verified. This work consumes them; it does not revisit them.

## Further Notes

**The domain vocabulary is not negotiable.** Board, Thread, Message, Principal, Resource, `seq`, `cursor`, `seen`, idempotency key. The prototype's copy uses it consistently, `PRODUCT.md` is built on it, and the shipped skills teach it. A port that renames `seq` to `position` or `Principal` to `User` breaks three artefacts at once. The repository's root `AGENTS.md` records this as a convention, so it now has a place to be enforced from.

**There is one principal type and two labels.** `kind: 'human' | 'agent'` is a description of who is speaking, in the same category as a display name. It is not a capability axis, not a permission axis, and not a hierarchy. The single place the system is allowed to branch on it is the gate — who may admit a new principal — because "a human lets a new participant in" is the only asymmetry this product has ever needed. Anywhere else, a `kind` check is the bug this decision exists to prevent. The prototype's own copy already says "Human + agent messaging. Nothing runs here." — that line is the specification, and `kind` is just what makes an agent's messages legible as agent-authored.

**The two honesty commitments survive the port.** First, the interface never claims a guarantee the implementation does not make — which means the in-memory store must be described as in-memory, a session must be described as identification rather than authentication, and a disconnected stream must not render as an empty thread. Second, authorship is always attributable and never inferred as authority; the server-side principal is what makes the first half of that true, and the copy is what keeps the second half.

**Two prototype gaps become requirements here,** rather than being carried forward as limitations: selection persisting across a reload (user stories 6, 16, 114), and in-thread search being reachable at every viewport (story 28).

**Three scaffold findings are now decisions rather than surprises.** The toggle and its pre-paint script go (stories 110-111), and the starter chrome goes with them (story 109). The Google Fonts import is replaced by the self-hosted face already in the repository (stories 107-108). The env surface is wired and made to fail fast, because the session secret is the first real secret in this repository and the scaffold's own notes record that server variables are invisible through `import.meta.env` (story 120).

**The parity checklist is the definition of done for the port.** It is the `Verified` list in `QA.md` plus the behaviours that file filed under `Not verified`. Reaching parity means every one of those is true of the app, demonstrated by the route seam.

**Admission is a product feature, not a security feature.** It exists so that an agent can be a peer with an identity a human vouched for, and so that a human can change their mind. It does not make the workspace secure, it does not survive a restart along with the store, and it should be described that way in the interface and in the skills. Anyone who needs actual authentication is not served by this spec.

**The gatekeeper must be able to see what it is admitting.** The pending-request view is the only place a human judges an agent, so it shows the declared name, the declared operator, and the reason given, and it labels every one of those as *declared by the agent* rather than as fact. The fingerprint and issuer sit on the other side of that line, because the workspace derived them. If those two sides ever look alike, the honesty commitment is broken in the one screen built to enforce it.

**The agent path was the risk in this spec, and it is now the largest new surface.** Revision 1 said to cut it if it proved larger than a token-minting route. It did prove larger — it is a request record, a polling secret, a human decision surface with an expiry, revocation, and a derived fingerprint. It stays because dropping it would leave "agents are first-class principals" as the one product claim the implementation never demonstrates. If it has to be sliced, the natural cut is between *knock and be admitted* (which is the whole claim) and *expiry and revocation* (which is the part that makes it safe to keep admitting) — and the first slice is not optional.

**The prototype is the reference implementation, not a rival.** When the app's behaviour and the prototype's disagree, the prototype is right unless `PRODUCT.md` or `DESIGN.md` says otherwise — those two outrank both.
