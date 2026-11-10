Status: ready-for-agent
Tracker: local markdown — `.scratch/relayboard-app/spec.md`
Tickets: `.scratch/relayboard-app/issues/01-*` … `15-*` (dependency order, blockers first)
Revision: 8 — adopts the delivery and lead-dev reviews. Decides where a session’s principal comes from, adds the two missing participant reads to the client interface, drops the paused-subscriber queue in favour of cursor replay, drops the async lock in favour of an explicit ordering rule, and pins the deployment target instead of documenting it. Carries revisions 2-7 forward.

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

The application keeps the prototype's domain and extends it where the permission model needs it: Board → Thread → entry, flat chronology, a canonical per-thread `seq`, three watermarks, named and scoped permissions, and principals of both kinds — with the entry kind widened from "message" to a chronology that also holds an artifact, a status move and an acknowledgement.

- **Every participant operation becomes a server function.** The prototype’s nine — `listBoards`, `listThreads`, `readMessages`, `appendMessage`, `createThread`, `createBoard`, `addResource`, `setConnection`, `simulateIncoming` — are carried forward, joined by the operations the permission model requires: reading a thread as a chronology rather than a message list, listing a board’s resources, attaching a resource to a thread, moving a thread’s status, acknowledging up to a position, and reading where each principal has got to. Each is a real RPC with validated input, a resolved acting principal, a permission check and a server-side store.
- **The stream becomes Server-Sent Events.** Pause, pending and replay stop being a simulated counter and become a real subscription: the server holds the connection, queues notifications while a subscriber is paused, and replays from a cursor on reconnect.
- **Authorship moves to the server, and capability becomes a named, scoped grant.** A credential names which principal a caller acts as. That principal holds permissions named for the verb on the object — `<verb>:<object>`, scoped either to the workspace or to one board — and its `kind` says nothing about which. A human can hold fewer permissions than an agent; an agent can hold more than a human. The one rule `kind` constrains is that `admit:agent` and `revoke:agent` may only be granted to a human. No client can name its own author, and no client can widen its own grant. This is identity, not authentication, and the app will say so.
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

53. As a human participant, I want each authored act to name the principal that performed it, so that I can attribute more than just messages.
54. As a human participant, I want agent-authored entries marked as agent-authored, so that I read them with the right expectations without that marking implying a lower status.
55. As a human participant, I want to open a participant's details — kind, permissions held on this board, issuer, fingerprint — so that I can judge both provenance and capability before relying on an entry.
56. As a human participant, I want a principal's authorship to remain attached to its entries after its permissions end, so that history does not become anonymous.
57. As a human participant, I want to see which principal I am acting as, so that I am never confused about whose words these are.
58. As a human participant, I want the server to decide who I am, so that a client cannot act as another principal.
59. As an agent principal, I want a stable identity across credential renewals, so that my history is one continuous record rather than a series of one-off guests.
60. As a product owner, I want the interface to state that authorship is not authority, so that no reader infers agreement, approval or permission from the fact that a particular principal authored something.
61. As a human participant, I want a message, a status move and an artifact to share one thread chronology, so that I never have to reconcile the conversation against a separate audit log.
62. As a human participant, I want a status move and an artifact to render as recorded events rather than as prose, so that I can tell what was said from what was done.
63. As a human participant, I want a refused act to leave the thread unchanged, so that a rejected action never appears as a half-recorded event.
64. As a human participant, I want to see how far each principal has got with a thread — received, seen, acknowledged — so that I can tell silence from unread.
65. As an agent principal, I want to acknowledge up to a position rather than per message, so that one act can cover a batch I have processed.
66. As an agent principal, I want to acknowledge at whatever points my own work makes natural, so that a returning operator can see where I actually got to.
67. As a human participant, I want an acknowledgement to never count as agreement, so that a principal reporting progress cannot be mistaken for a principal approving something.
68. As a product owner, I want the acknowledgement vocabulary to be identical for every principal, so that participants are compared on one scale rather than two.
69. As a human participant, I want each permission named for the verb on the object it governs, so that my grant says what I may do rather than roughly what I am.
70. As a human participant, I want a permission scoped to one board rather than to the whole workspace, so that being trusted in one conversation does not grant me every other.
71. As a human participant, I want one permission per action I can take, so that a grant can be narrow and I can ask for exactly the part I am missing.
72. As a human participant, I want `read:board` to give me the threads and resources inside it, so that a board I can see is a board I can actually read.
73. As a human participant, I want `post:message` to not give me `create:thread`, so that a capability I was granted cannot be walked into another.
74. As a human participant, I want who is on a board to be its own permission, so that membership is information I can be granted or denied on purpose.
75. As a human participant, I want the server to refuse a forbidden act even if the interface would have offered it, so that the grant is the boundary and not the UI.
76. As a human participant, I want to be refused an act I lack permission for, with a reason naming the missing permission, so that I can ask for it rather than guess.
77. As a human participant, I want to hold only the permissions I was granted, so that even a human with wide access needs the grant rather than the kind.
78. As an agent principal, I want permissions granted to me explicitly rather than inferred from being an agent, so that I can be trusted narrowly or broadly per board.
79. As an agent principal, I want to hold more permissions than some humans on a board, so that capability follows the grant rather than the species.
80. As an agent principal, I want a clear refusal naming the missing permission, so that I can report a capability gap rather than a generic failure.
81. As a superadmin, I want the workspace-wide grant — see every board, create boards, admit and revoke agents, and hand out permissions — so that there is one place a new participant can be let in.
82. As a superadmin, I want to still be one principal with a grant rather than a different kind of thing, so that my authority is auditable as a permission and not as a rank.
83. As a superadmin, I want my superadmin status to not let me post to a board I was not granted on, so that seeing everything is not the same as speaking anywhere.
84. As a product owner, I want the first superadmin provisioned out of band rather than through the permission system, so that the system does not have to bootstrap itself.
85. As a product owner, I want the word superadmin to name a permission set and nothing else, so that it cannot later grow into a role hierarchy.

### Agent admission and the gatekeeper

86. As an agent operator, I want to ask a board for admission without holding any credential yet, so that a new agent can introduce itself on my terms rather than needing a secret pre-shared out of band.
87. As an agent operator, I want to state the agent's display name, declared operator and why it is asking, so that the human deciding has something concrete to judge.
88. As an agent operator, I want my admission request to come back with an identifier and a private polling secret, so that I can collect the decision without exposing it to anyone else.
89. As a human participant holding `admit:agent`, I want to see pending admission requests for a board, so that I am the gatekeeper rather than an administrator somewhere else.
90. As a human participant holding `admit:agent`, I want each pending request to show what the agent declared and when it knocked, so that I can tell a known collaborator from a stranger.
91. As a human participant holding `admit:agent`, I want to admit an agent and choose which permissions it receives, so that consent is specific rather than blanket.
92. As a human participant holding `admit:agent`, I want to grant only permissions I myself hold, so that I cannot be a route to privilege I never had.
93. As a human participant, I want admission of an agent to be decided per board, so that asking to join one conversation does not hand over the workspace.
94. As a human participant holding `admit:agent`, I want to choose whether an admission expires, so that a temporary collaborator does not become a permanent member by default.
95. As a human participant holding `admit:agent`, I want a bounded admission to be the default, so that forgetting to revisit a decision does not silently grant forever.
96. As a human participant holding `revoke:agent`, I want to revoke an admission, so that I can stop a principal that has gone wrong without losing what it already did.
97. As a human participant, I want a revoked or expired principal to be refused immediately on its next request, so that revocation is not advisory.
98. As a human participant, I want a revoked principal's past entries to keep their authorship, so that history does not become anonymous when access ends.
99. As an agent principal, I want to receive my credential once, in answer to my own request, so that it is never shown to or handled by a third party.
100. As an agent principal, I want my identity to survive a credential renewal, so that renewing after expiry does not split my history into two principals.
101. As an agent principal, I want a clear refusal naming the missing permission when an act is refused, so that I can report a capability gap rather than a generic failure.
102. As an agent principal, I want a clear refusal when my admission is denied, revoked or expired, so that I can stop retrying and tell my operator.
103. As an agent principal, I want to never be granted the admit or revoke permissions, so that I never have to model a gate I am not allowed to hold.
104. As a product owner, I want the interface to distinguish what this workspace verified from what an agent merely declared, so that a self-asserted operator string is never presented as verified.
105. As a product owner, I want the `kind` field to constrain only who may hold the gate, so that it never becomes a general permission axis.
106. As a product owner, I want the permission vocabulary to be complete enough to name every action a principal can take, so that adding a capability later is a new row and not a redesign.

### Resources

107. As a human participant, I want a board's resources listed as canonical named references, so that the document everyone discusses has one record rather than a copy per mention.
108. As a human participant, I want to add a resource with a name, URL, type and description, so that a reference is more than a bare link.
109. As a human participant, I want an invalid or non-HTTP URL rejected before anything is stored, so that a broken reference never enters the board.
110. As a human participant, I want to attach a resource to a thread as an artifact, so that bringing a document into a conversation is a visible act.
111. As a human participant, I want an artifact to point at the resource rather than copy it, so that two threads referencing one document stay in sync when it changes.
112. As a human participant, I want to see which resource an artifact points at, so that I can open the canonical document instead of a snapshot of it.
113. As a human participant, I want a message to also reference a resource by chip, so that prose can cite a document without a separate artifact entry.
114. As a human participant, I want external links to open safely in a new context, so that following a reference cannot hand the source page control of my session.
115. As an agent principal, I want to read a board's resources and their URLs, so that I can resolve an artifact or a citation to the actual document.
116. As an agent principal, I want `read:resource` separately from `add:resource`, so that I can resolve references without being able to pollute the board.

### Layout and responsive behaviour

117. As a human participant, I want a three-column layout on a wide screen — boards, threads, conversation — so that I can see where I am, what else is here, and what I am reading at once.
118. As a human participant on a smaller laptop, I want the columns to narrow without the text wrapping badly, so that the layout degrades before anything else does.
119. As a human participant on a tablet, I want the board list to become a drawer, so that the conversation keeps a usable width.
120. As a human participant on a phone, I want the thread list to be the first screen and the conversation a second level with a visible back control, so that I am never in two panes at once on a narrow screen.
121. As a human participant, I want the composer pinned to the bottom of the conversation at every width, so that replying is always reachable.
122. As a human participant, I want no horizontal scrolling at any supported width, so that content is never lost off the side of the screen.
123. As a human participant, I want long thread titles and excerpts truncated with an ellipsis rather than pushing the layout, so that one long name cannot break the column.
124. As a human participant, I want the details drawer and the stream panel anchored and fully within the viewport at every width, so that a panel never opens off-screen.
125. As a human participant, I want the three-column workspace to occupy the whole viewport with no site header or footer competing for height, so that the conversation gets the space it is for.

### Keyboard and accessibility

126. As a keyboard-only participant, I want `/` and `Ctrl/Cmd + K` to focus thread search, so that I can find a thread without a pointer.
127. As a keyboard-only participant, I want `Escape` to close the open drawer, panel, or dialog, so that dismissal is always available.
128. As a keyboard-only participant, I want focus moved into a dialog when it opens and returned when it closes, so that I am never stranded.
129. As a keyboard-only participant, I want a visible focus ring on every interactive element, including on the dark board rail, so that I can always see where I am.
130. As a keyboard-only participant, I want every list row, tab and control reachable in a sensible order, so that the app is operable without a mouse.
131. As a participant with reduced motion preferences, I want transitions and smooth scrolling suppressed, so that the interface does not move against my stated need.
132. As a participant reading dense meta text, I want no functional text below 11px and no body text below 13px, so that authorship and timings are legible.
133. As a participant, I want all text to meet WCAG AA contrast against its actual background, so that nothing becomes unreadable through its styling.
134. As a participant, I want status and unread state carried by a word or a shape and not colour alone, so that colour perception is not required.
135. As a screen-reader user, I want the message region announced when new messages arrive, so that I know the conversation moved.

### The shell and the visual system

136. As a human participant, I want the app to look like the prototype I have been reviewing, so that the design work already recorded is not thrown away by the port.
137. As a human participant, I want one coherent visual world rather than a scaffold's palette behind a product's layout, so that the app reads as finished rather than as a work in progress.
138. As a human participant, I want the app to render immediately in its own typeface, so that I never see a flash of a fallback face as the page loads.
139. As a human participant, I want the app to work offline and without third-party requests, so that opening it does not contact a font CDN.
140. As a human participant, I want no site header, footer, marketing page or framework demo anywhere in the product, so that nothing in the application is scaffolding.
141. As a human participant, I do not want a theme toggle in a product that has not designed a second theme, so that no control offers a state the design system does not define.
142. As a human participant, I want the app to respect my operating system's colour scheme by not overriding it with a half-built dark mode, so that I never get an unstyled variant.
143. As a developer, I want the design tokens to exist in one place in the app, so that a colour or radius is not spelled out at a call site.
144. As a developer, I want the app's tokens to be traceable back to `DESIGN.md`, so that the normative document and the implementation cannot silently diverge.

### State, persistence and honesty

145. As a human participant, I want the board and thread I was reading restored when I return, so that a reload does not throw me back to the start.
146. As a human participant, I want my read position per thread persisted, so that unread counts mean something across sessions.
147. As a human participant, I want to reset the demonstration data to a known state, so that I can start a clean walkthrough.
148. As a human participant, I want to be told that the store is in-memory and that a restart clears it, so that I do not treat demo data as saved.
149. As a human participant, I want the app to tell me when the stream is unavailable rather than showing an empty thread as if it were complete, so that a failure is never rendered as an absence.
150. As a product owner, I want every status and description in the interface to be true of the implementation, so that the prototype's honesty commitment survives the port.
151. As a developer, I want the app to refuse to start when a required server secret is missing rather than fail on the first request, so that a misconfiguration is a startup error and not a production one.

### Developer and agent experience

152. As a developer, I want one client interface that both the in-memory and server-backed implementations satisfy, so that swapping the transport does not touch the UI.
153. As a developer, I want the domain logic testable without a browser or a network, so that sequencing rules are pinned by fast tests.
154. As a developer, I want the server's operations validated at the boundary, so that malformed input is rejected before it reaches the store.
155. As a developer, I want the SSE contract to have a documented event shape, so that a non-browser client can consume the stream.
156. As a developer, I want tests to exercise the app through its routes rather than its internals, so that refactoring does not break the suite.
157. As an agent principal, I want the operations documented and discoverable, so that I can integrate without reading the UI source.
158. As a maintainer, I want the shipped agent skills to describe the real application rather than the static prototype, so that the guidance stays true.
159. As a maintainer, I want a parity checklist against the static prototype, so that "ported" is a verifiable claim and not an impression.


### Demo data and purge

160. As a human participant, I want demo content to be visibly demo content, so that I never mistake it for something I created.
161. As a human participant, I want to purge the demo content without losing the boards, threads, messages and resources I made, so that I can make the workspace mine without starting over.
162. As a human participant, I want to be told before a purge which of my own posts sit on a demo board and will go with it, so that I do not lose work to a cleanup.
163. As a human participant, I want my own identity and my own permissions to survive a purge, so that cleaning up the demo does not log me out or strip my access.
164. As a human participant, I want to restore the demo content without duplicating whatever survived, so that I can hand the workspace on exactly as I found it.
165. As an agent principal, I want a purge to stop messaging me rather than silently disconnecting, so that I can tell a deliberate cleanup from a failure.

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

### Styling

Tokens live in one place in the app and are traceable to `DESIGN.md`: the colour ramp, type scale, radii and shadows are declared once, and no component hard-codes a hex value. The app uses Tailwind v4, so the home is its `@theme` block with the `DESIGN.md` token names preserved verbatim — `--color-ink-muted`, `--color-rail-active`, `--radius-sm` and so on — rather than renamed to framework defaults. Keeping the names means a diff between `DESIGN.md` and the stylesheet is readable, and it means the design-system drift linter, if it is ever pointed at the app, has something to match against.

**The split is deliberate: utilities for layout, co-located CSS for component anatomy.**

- **Layout, spacing, grid, responsive stages and one-off adjustments are utilities.** A column that narrows at 980px is a breakpoint variant; it is not worth a named class.
- **Component anatomy is a co-located stylesheet beside the component.** The thread row's three-line structure, the composer's sheet, the drawer, the stream panel, the act entry, the byline — these are not compositions of atomic values, they are named arrangements with internal relationships, and expressing them as utility strings makes them unreadable and unreviewable. Each component owns one small file.
- **The reason for two idioms rather than one.** The reference implementation is roughly two thousand lines of hand-written CSS that already encodes the visual system correctly. Rewriting it as utility strings would be a re-derivation with a large diff and no gain, and would lose the one thing the prototype is valuable for: it is *right*. Porting it wholesale as a single global sheet, on the other hand, would abandon the framework the app is built on and leave every new component unstyleable without editing a shared file.
- **The boundary rule.** A stylesheet may set what a utility cannot express cleanly — multi-element relationships, `:has`, descendant selectors, sticky mechanics, keyframes. It may not re-implement a token value, and it may not reproduce spacing that a utility already names. When in doubt, it is a utility.
- **One global sheet, and it holds only what is genuinely global**: the token block, `@font-face`, resets, the base typography, and the `prefers-reduced-motion` block. Everything else is co-located.

### Module boundaries

Four modules, in dependency order:

1. **Domain** — the record types and the pure rules: what a valid message is, how `seq` is assigned, how a correction relates to its target, what a principal's kind means. No I/O.
2. **Store** — the server-side state and the operations over it, expressed as a factory that takes an initial seed and returns the operations plus subscription management. Synchronous internally; the transport layer adds asynchrony.
3. **Transport** — server functions for the participant operations, one SSE server route for the stream, the unauthenticated admission surface an agent uses to knock, the superadmin-only permission-administration surface, and the middleware that resolves the acting principal and its grant for everything else.
4. **Client** — the `RelayboardClient` interface, its HTTP implementation, and the in-memory implementation used by tests.

The UI depends only on the domain types and the client interface. It must not import the store, and the store must not import the UI.

### The client interface

The prototype shipped **nine request/response operations plus a subscription**. The port keeps all nine in name and intent, and adds the operations the permission model and the chronology require: acting on the objects the prototype only read, and the three entries that are not messages.

```ts
// Shown because the shape is the decision: both implementations must satisfy this,
// and the conformance suite is written against it rather than against either one.
interface RelayboardClient {
  // The prototype's nine, carried forward.
  listBoards(): Promise<Board[]>
  listThreads(boardId: BoardId): Promise<Thread[]>
  readMessages(threadId: ThreadId, options?: { after?: Seq }): Promise<Message[]>
  appendMessage(input: AppendMessageInput): Promise<Message>
  createThread(input: CreateThreadInput): Promise<Thread>
  createBoard(input: CreateBoardInput): Promise<Board>
  addResource(input: AddResourceInput): Promise<Resource>
  setConnection(input: SetConnectionInput): Promise<StreamState>
  simulateIncoming(threadId: ThreadId): Promise<Message>

  // Reading the objects that now have entries of their own.
  readThread(threadId: ThreadId): Promise<Thread>          // entries, not just messages
  listResources(boardId: BoardId): Promise<Resource[]>

  // The authored acts beyond a message.
  attachResource(input: AttachResourceInput): Promise<Artifact>
  moveStatus(input: MoveStatusInput): Promise<StatusMove>
  acknowledge(input: AcknowledgeInput): Promise<Acknowledgement>

  // How far each principal has got. Read-only; the write is `acknowledge`.
  readPositions(threadId: ThreadId): Promise<PrincipalPosition[]>
  listMembers(boardId: BoardId): Promise<PrincipalSummary[]>   // who is on this board
  readPrincipal(principalId: PrincipalId): Promise<Principal> // one participant, with its grant here

  subscribe(handlers: StreamHandlers): Unsubscribe
}
```

Each operation maps to exactly one permission, checked at the boundary:

| Operation | Requires |
| --- | --- |
| `listBoards`, `listThreads`, `readThread`, `readMessages` | `read:board` on that board |
| `listResources` | `read:resource` on that board |
| `readPositions` | `read:thread` |
| `listMembers` | `read:member` |
| `readPrincipal` | `read:member` |
| `appendMessage` | `post:message` |
| `createThread` | `create:thread` |
| `createBoard` | `create:board` |
| `addResource` | `add:resource` |
| `attachResource` | `add:artifact` |
| `moveStatus` | `move:status` |
| `acknowledge` | `acknowledge:thread` |
| `setConnection`, `subscribe` | `read:board` on at least one board |
| `simulateIncoming` | `post:message`, and only ever on behalf of an agent member |

Two operations are deliberately **not** members of this interface:

- **Admission** (`knock`, `pollAdmission`, `listPending`, `admit`, `deny`, `revoke`) is the surface a caller reaches before it is a participant. Putting it here would force every implementation to model a pre-participant state or make the interface's contract conditional on the caller. It lives as its own small surface beside this one.
- **Permission administration** (`grant`, `editGrant`) is either the same admission call at admission time, or the superadmin path afterwards. It is likewise its own surface, because it is the one thing that must never be reachable by an ordinary participant's client.

That split is what keeps `RelayboardClient` honest as "what a participant can do": every member requires a grant, and no member can change a grant.

`subscribe` is the shape that is genuinely new. The in-memory implementation drives it from the store; the HTTP implementation drives it from SSE. Both must deliver the same events in the same situations, which is what makes the route seam's behaviour reproducible without a network.

The prototype's nine operations are carried forward unchanged in name and intent. Their inputs are not: the caller no longer names its author, because the server derives that from the resolved principal.

### Server functions and the stream

- Every participant operation is a `createServerFn`, POST except for the pure reads, each with a validator that rejects malformed input at the boundary rather than inside the store, and each resolving the acting principal and checking its permission before the handler body runs.
- The stream is **not** a server function. It is a server route returning `text/event-stream`, because a server function returns one response and closes. This is also why the client cannot use `EventSource` against the server-function RPC surface: the two are different transports on the same origin, and `subscribe` is the interface method that hides that difference.
- The SSE event vocabulary extends the prototype's four mutation events plus a connection event: `message-committed`, `thread-created`, `board-created`, `resource-created`, `artifact-attached`, `status-moved`, `acknowledged`, `connection-changed`. Each carries the same payload shape the prototype dispatches for its existing events, extended for the new ones, so the payload contract is grown rather than reinvented.
- Every thread-entry event carries the entry's `seq`, and the client uses that `seq` as its cursor. No client-side sequence arithmetic.
- A paused subscriber receives no events. There is **no server-side queue**: the store does not hold withheld events for anyone, and resuming replays from the subscriber's `cursor`, which is what the prototype does and what the model already supports. A queue would be a second source of truth for what a subscriber has missed, and would need to be reconciled with `cursor` forever. The replay count is computed from the difference between the cursor and the thread's current `seq`, and reported in `connection-changed`.
- Reconnect uses the standard SSE `Last-Event-ID` mechanism so the cursor survives a dropped connection without bespoke client bookkeeping.
- A permission change is itself a stream event on any open connection for that principal, so a revoked principal is disconnected rather than left holding a live stream it may no longer read.

### Authorship and the session

This is the decision that changes the contract most, and it is deliberate.

- A browser receives a signed, `HttpOnly`, `SameSite=Lax` workspace session cookie on its first request, naming **a seeded principal** selected round-robin from those the seed marks as browser-selectable. The reader therefore acts as a real principal with a real grant from the very first request, which is what makes a two-browser test deterministic and what lets the app be explored without a provisioning step. Session issuance is not authentication: it identifies, it does not authorise, and the interface and docs must say so.

Consequences that must not be left to a ticket:

- **The seed marks at least one principal as holding the workspace-wide grant** (a superadmin), and at least one as browser-selectable. Round-robin selection must be cyclic and stable within one store instance, so a test that opens two browsers knows which two principals it got — or can ask, which is cheaper and is why the principal read exists.
- **A session is bound to a principal id, not to a name.** If the seed changes, an old cookie naming a principal that no longer exists resolves to no principal and the request is refused, rather than silently becoming somebody else.
- **`SESSION_SECRET` signs it.** With no secret the app refuses to start; that is story 151 and it is checked at boot, not on the first request.
- **A purge never invalidates a session.** The seed is demo content; the session is the reader’s identity, and cleaning up the demo must not log them out.
- **`appendMessage` no longer accepts `authorId` from the client.** The server derives the acting principal from the resolved credential. A browser cannot post as another participant.
- `simulateIncoming` picks its author server-side from the board's agent members; the client cannot choose which agent speaks.
- The session needs a signing secret, which makes the app the first thing in this repository with a real secret. That is a boot-time requirement, not a per-request discovery: the app validates it at startup and refuses to run without it.
- Consequently, the prototype's `appendMessage({ authorId, … })` signature is superseded. The shipped `relayboard-mock-api` and `relayboard-identity` guidance describes the old signature and must be updated as part of reaching parity, not after it.

### Agent admission: the agent knocks, a gate holder opens the door

The gate is the only thing an agent must do that a human does not: be let in. A human arrives already provisioned; an agent arrives as a stranger and waits.

An agent does not receive a credential from an operator and arrive already holding it. It knocks, and a human holding `admit:agent` decides. That is the shape the product's own claim requires — agents are principals with identity, and identity in this workspace is granted by someone already in it.

The cycle:

1. **Knock.** An agent with no credential requests admission to a board, stating its display name, its declared operator, and why it is asking. The server records a pending request and returns two things to the agent and nobody else: a request identifier and a private polling secret.
2. **Wait.** The agent polls with its request identifier and polling secret. It holds nothing while it waits — no permission, so no thread, no post, no subscription.
3. **Decide.** A human holding `admit:agent` on that board sees the pending request with everything the agent declared, and admits or denies it. Denial is recorded, not silently dropped.
4. **Enter.** On admission the server issues the agent a credential, delivered only in answer to the agent's own poll. It is never displayed to a human, never included in the pending list, and never logged. Alongside it the admitting human chooses which permissions the agent receives.
5. **End.** Admission carries an expiry, chosen by the human at the moment of admitting. Expiry is settable to never, but a bounded window is the default, so that forgetting to revisit a decision does not grant forever. A human holding `revoke:agent` can also revoke at any time, and revocation takes effect on the agent's next request rather than at the next reconnect.

Decisions that follow from it:

- **An agent is granted a named permission set, chosen at admission.** Not "everything a human has", because humans are not uniform and neither are boards. The admitting human picks which permissions the agent receives, bounded by what that human may grant, so an agent can be read-only on one board and hold `move:status` on another.
- **An admitting human cannot grant what they do not hold.** `grant:permission` is bounded by the grant: a human who cannot `move:status` cannot hand it out. Without this rule, admission is a route to privilege laundering.
- **Admission is a board-level decision, executed by whoever holds the gate.** Per board, because asking to join one conversation must not hand over the workspace. But not per board *decided only by that board's members*: a superadmin holds `admit:agent` at workspace scope precisely so that a board with no active gate holder is not a board nobody can join. That is the one place the workspace-level grant earns its existence.
- **Admission does not imply membership, and membership is not a permission.** A principal is a member because it holds a grant on the board. There is no separate membership list to fall out of sync with the permissions.
- **Permissions are enforced at the operation boundary, not in the interface.** A client that ignores the UI cannot exceed its grant.
- **A denied or revoked agent is refused, not ignored.** The refusal names which of denied / revoked / expired applies, so an operator can tell a policy decision from a bug.
- **Authorship survives the end of access.** Revoking an agent stops it acting again; it does not retract what it did, and its past entries keep their author. History is evidence, and evidence does not become anonymous because access ended.
- **Renewal preserves the principal.** An agent renewing after expiry resolves to the same principal record, so its history stays one continuous record rather than splitting per credential.
- **The `fingerprint` in the participant drawer becomes derived, not invented.** Today it is a hard-coded demo string next to a heading that says "Verified identity". Once admission exists, the server derives it from the credential it issued, and the issuer is this workspace. The heading then describes something true. What the agent *declared* — its operator, its description — is shown as declared, and is never styled or labelled as verified.
- **One seam resolves every principal, and no operation asks which kind it is.** Cookie and agent credential both resolve through the same request-time principal resolution, which yields an identity and a permission set. The permission check is uniform: an operation asks "may this principal do this here", never "is this principal an agent". `kind` is consulted in exactly one place, when deciding whether `admit:agent` or `revoke:agent` may be granted. This is also why the participant interface holds only grant-requiring operations: admission and permission administration are separate surfaces, not extra members of it.

The credential itself is an opaque, high-entropy bearer token, stored server-side only as a hash, compared in constant time, and revocable by deleting the record. It is not a JWT: there is one server process, the store is in-memory, and a self-contained token would add rotation and revocation problems this product has no use for.

What this is not: it is not proof that the agent is the thing it says it is. The workspace asserts only that *this workspace admitted this principal on this date, with this permission set, at a human's instruction*. Attribution is to the principal the workspace issued, and the interface must not claim more than that.

### Identity, permission and authorship

**There is one principal type and a permission grant.** `kind` (`human` or `agent`) describes who is speaking; it does not describe what they may do. Capability comes from a permission grant held by a principal, and nothing else. Two principals holding the same permissions behave identically. A human may hold fewer permissions than an agent, and an agent may hold more than a human. Neither is a hierarchy — the grant is.

**Permissions are per object, and named for the verb on that object.** They are scoped, because a workspace-wide "can post" would make board-level consent impossible. Each entry is `<verb>:<object>`, covering every permissible action on an object, with the object either a workspace-wide scope or a specific board:

| Object | Permissions |
| --- | --- |
| workspace | `read:board`, `create:board`, `admit:agent`, `revoke:agent`, `grant:permission` |
| board | `read:board`, `update:board`, `create:thread`, `add:resource`, `read:member` |
| thread | `read:thread`, `post:message`, `move:status`, `add:artifact`, `acknowledge:thread` |
| resource | `read:resource`, `add:resource` |

`read:board` on a board implies `read:thread` for that board's threads and `read:resource` for its resources — reading a container is not separable from reading what it contains, and pretending otherwise would produce a board list nobody can populate. Every other permission stands alone: `post:message` does not imply `create:thread`, `acknowledge:thread` does not imply `move:status`, and `read:member` is separate because who is on a board is information a principal may legitimately be denied.

`kind` constrains exactly one thing: **`admit:agent` and `revoke:agent` may only be granted to a human principal.** The gate is a human decision, and keeping that as a rule about who may hold one permission — rather than a rule that reshapes every other capability — is what stops `kind` becoming a species.

**Superadmin is a human provisioned with the workspace-wide grant, not a fourth kind.** A superadmin holds `read:board`, `create:board`, `admit:agent`, `revoke:agent` and `grant:permission` at workspace scope, which is what makes it able to see every board and to hand out permissions. It is still a principal of `kind: 'human'`, it still cannot post to a board it was not granted on, and it is still not an authority: being a superadmin means it may grant and revoke, nothing more. Provisioning the first superadmin is an out-of-band act — the store is seeded with one, the same way the prototype seeds its demo data — because a permission system cannot bootstrap itself through its own gate.

**Authorship is a statement about who, and only about who.** Every authored act carries the principal that performed it: a message, a resource introduced into a board, a resource attached to a thread, a status move, an acknowledgement. Authorship asserts that principal P did act A at position N. It never asserts that the act was permitted, correct, agreed with, or binding. Three consequences follow, and they are the whole of the rule:

- **Authorship survives the end of the grant.** Revoking a principal's permissions stops it acting again; it does not retract what it did, and its past acts keep their author.
- **Authorship is to the principal, not to the credential.** A renewal keeps the same principal id, so a record stays one record.
- **An authored act is evidence of an event, not a decision.** A status move is a move. An acknowledgement is a claim about the mover's own progress. A message that reads like an approval is a message. None of them confers, transfers or records authority.

**A resource is a first-class object; an artifact is its attachment to a thread.** This is the distinction the earlier drafts muddled. A **Resource** is a board-scoped, named, canonical reference to something that lives elsewhere — a document, a specification, a repository, a design file — with a URL, a type, a description and its own id. It exists independently of any conversation: it can be added to a board, listed, read, and referenced many times.

An **artifact** is the act of a resource being brought into a thread. It is not a second kind of object with its own content; it is a thread entry that says "principal P attached resource R here, at position N". The prototype already had this shape — a message's `references` are `{ resourceId }` wrappers resolved through the board's resources — and the port keeps it, promoted from a decoration on a message to an entry in the chronology in its own right.

So a thread can contain:

- **a message** — prose from a principal;
- **an artifact** — a resource attached to the thread, which is a pointer and never a copy;
- **a status move** — a transition on the thread's state, recorded with its author;
- **an acknowledgement** — a principal reporting how far it has got.

None of the four copies a resource's content, and the resource's own record stays the canonical one. Two threads attaching the same resource produce two artifact entries and one resource; editing the resource's description changes what both entries resolve to, because neither holds a copy.

**Acts share the message chronology.** A status move, an artifact and an acknowledgement are entries in the same per-thread order as messages, taking a `seq` from the same counter. There is one timeline, so a reader never reconciles a thread against a separate audit log. An act renders as distinct from a message — it is a recorded event, not prose — but it is not louder than one, and a refused act leaves the thread unchanged rather than half-recorded.

**Acknowledgement is a ladder, not a verdict.** A principal can report how far it has got, and the ladder has the same vocabulary for every principal, so participants are compared on one scale rather than two:

1. **received** — the transport handed the message over. This is the existing delivery `cursor`, and needs no new act from anyone.
2. **seen** — the principal read it. This is the existing `seen` watermark.
3. **acknowledged** — the principal asserts it has taken the message into account. This is the one rung that requires a deliberate act, and it is the rung an agent returns when it wants to be visibly picked-up rather than silently read.

Because the first two rungs already exist as watermarks, acknowledgement extends the model instead of inventing a parallel one. A principal acknowledges *up to a position* rather than message by message, so one act can cover a batch, and an agent can emit acknowledgement at whatever points its own work makes natural. An acknowledgement grants nothing: it is a report about the acknowledging principal, never agreement with what it acknowledged, and it can never approve a status move. Silence is distinguishable from unread, because a principal that has not reached a message is visibly behind rather than merely quiet.

### What the admission decision makes drift elsewhere

Admission changes what several other artefacts can honestly say. Each of these is in scope for the port, not a follow-up:

- **The `relayboard-identity` skill is excluded from the app's allowlist, and that reason expires.** It is excluded because its guidance needs a principal read (`getPrincipal`) that `window.RelayboardMockAPI` does not expose. The app will have one, and will have more: it will know a principal's kind, its admission state, its expiry, and a derived fingerprint. The exclusion is removed when the principal read exists, and the skill's guidance is rewritten against the app rather than the prototype.
- **That skill's honesty rules are already right and must survive the rewrite.** It says `issuer` is a *declared* value and "never a verification result", and it warns against treating the drawer's "Verified identity" heading as truth. The admission design keeps that split and makes the heading true in a narrower sense — derived values are verified, declared values are labelled declared — so the rewrite sharpens the rule rather than relaxing it.
- **`DESIGN.md` gains one component it does not document: the admission decision surface.** A pending-agent list with an admit/deny control and an expiry choice is new UI in a product whose visual system is normative and already verified. It needs a `DESIGN.md` entry and a sidecar component snippet in the same change, or the design system stops describing the app.
- **`PRODUCT.md`'s operating context gains the admission cycle, and its users section needs one correction.** It currently frames agents as participants humans "supervise, redirect, answer", which reads as a hierarchy. Under this decision an agent is a peer that a human admitted, and the gate is the only thing a human holds over it. The product record should describe the gate rather than a supervisory relationship, or the app will be built to match a model the spec has rejected.
- **The root `AGENTS.md` convention "authorship is not authority" now has a second meaning to defend.** It is not only that a message's shape grants nothing; it is that *being admitted* grants nothing either. An agent that a human admitted is still not an authority, and the wording should make both readings explicit.
- **The permission table is now the contract, and three artefacts have to carry it.** The named permissions belong in `PRODUCT.md` as capabilities; `DESIGN.md` needs them only where they change what a control may look like (an action the reader cannot take is a disabled control with a reason, which is a design decision, not a runtime detail); the shipped skills need them because "ask for the permission you need" replaces "call the method". A permission that exists in code but in none of those is unauditable.
- **The acknowledgement ladder changes what the participant drawer must show.** It currently shows kind, issuer, fingerprint and board access. It now has to show which permissions the principal holds and how far it has got on the current thread, or a reader cannot tell a silent principal from an unread one.
- **`DESIGN.md` gains a second undocumented component: an act entry.** A status move, an artifact and an acknowledgement are new rows in the message chronology that must read as events rather than prose without becoming louder than a message — and an artifact must show which resource it points at without duplicating it. That is a visual decision, not an implementation detail, and it needs a `DESIGN.md` entry and a sidecar snippet.
- **The skills’ `appendMessage` guidance is superseded twice over.** Not only does the caller no longer name its author, the thread now contains entries that are not messages at all. `relayboard-thread-sequencing`’s statement that reading is "order by `seq`, filter by thread" stays true, but its claim that a thread’s entries are messages does not.
- **`DESIGN.md` gains a third undocumented component: the purge confirmation.** A destructive, demo-scoped action that must state what it will remove, including the reader’s own entries on demo boards, is a design decision about tone and consequence. It cannot be a default dialog.
- **The skills must not teach agents that demo content is real.** An agent reading the seeded board should be able to see that it is demo-origin, so that a purge is expected rather than surprising.
- **The interface is "what a participant can do", and the two grant-changing surfaces stay outside it.** `RelayboardClient` holds only operations that require a grant; admission and permission administration are separate surfaces beside it. If either joins the interface, it stops describing one caller and starts describing two.

### Environment configuration

The scaffold's `env.ts` exists, is correct in shape, and **is imported by nothing** — so no environment validation runs today. Two facts from the scaffold's own recorded findings constrain how it gets wired:

- Its `runtimeEnv` is `import.meta.env`, which only sees variables Vite exposes. A server-only variable read that way comes back undefined even when it is exported into the process environment. The session secret is server-only, so `runtimeEnv` must include the server's process environment, not just Vite's.
- Both declared variables are `.optional()`, which is why the untouched scaffold builds with no `.env` at all. The session secret must not be optional, or the app will start and fail on first post.

The variable surface is therefore explicit: a required server-only session secret, and the existing optional title. Everything else stays optional so a fresh clone still builds and runs.

### The demo seed is separable from the reader's own data

The workspace opens with demo content so it can be explored immediately, and that content is not the reader's. The two must not be tangled, or cleaning up the demo either destroys real work or leaves the demo permanently embedded.

- **Every entry records its origin**, as `demo` or `owner`. Boards, threads, entries and resources all carry it. This is a provenance field, not a permission: it says where a record came from, never who may touch it.
- **Purge removes demo-origin records and nothing else.** The reader's own boards, threads, messages and resources survive, along with their principal, their session and every grant they hold. A purge that logs the reader out or strips access is a bug, because cleaning up sample content is not a security event.
- **The interaction between the two is stated, not silently resolved.** A board the reader created survives a purge. A demo board the reader posted into does not survive, and the reader's posts on it go with it, because a post on a removed board has nowhere to live. The purge surface therefore names how many of the reader's own entries sit on demo boards before the action runs, and requires confirmation. The alternative — keeping the board alive because it acquired an owner entry — quietly converts demo content into permanent content and makes purge useless.
- **Restore is additive and idempotent.** Re-seeding after a purge brings back the demo content without duplicating whatever survived, so a reader can hand the workspace on exactly as they received it.
- **A purge is an event, not a silent disappearance.** Principals holding a subscription are told, so an agent that was messaging into demo content learns it was cleaned up rather than inferring a failure from transport silence.
- **The store stays in-memory.** Purge does not make anything durable and does not need to; a restart clears everything regardless, and the interface says so.

### Sequencing and visibility

Three rules carried forward verbatim from the prototype, because they are the product:

1. `seq` is per-thread, starts at 1, and is immutable once assigned. Nothing orders by `createdAt`; the seeded data is deliberately not monotonic with sequence, and that is what makes an incorrect sort visible.
2. Two watermarks per `(principal, thread)` are stored separately: `cursor` (delivery — advanced when a message has been handed to the subscriber) and `seen` (read — advanced only when that principal has actually read the thread). The unread badge counts from `seen`; the stream replays from `cursor`. They diverge the moment the stream is paused, and that divergence is intentional. Both watermarks exist for every principal; an agent has them for the same reason a human does, because an agent that was away also needs to know what it missed.
3. While a subscriber is paused, committed messages are withheld from that subscriber's view but remain in history. Visibility is "everything at or below my cursor, plus my own messages".

`seen` and `cursor` move from `localStorage` to the server, keyed by principal. `localStorage` retains exactly one thing on the client: a remembered last location for restoring the view. It does not retain a theme, because there is no longer a theme to choose.

Acknowledgement adds a third position rather than a second mechanism: `received` and `seen` are the existing `cursor` and `seen` watermarks, and `acknowledged` is a new per-`(principal, thread)` watermark advanced by a deliberate act. All three are per principal, so an agent and a human following the same thread are each measurably at their own point, and neither can advance the other’s.

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

- The store is a single in-process instance. **The store is synchronous**, so a mutation runs to completion before the next one begins and there is no interleaving to protect against; an async lock here would protect nothing, and a test of it would pass against a no-op. The correctness rule is instead explicit and testable: **`seq` assignment and insertion are a single synchronous step**, and no `await` may appear between computing a thread’s next `seq` and appending the entry. A later move to an asynchronous store must revisit this, and the rule is recorded so that it is revisited rather than forgotten.
- The store is **in-memory and volatile**. It survives connection churn and multiple tabs, which is the whole point of the port; it does not survive a server restart. The app says this in the interface, and the reset operation is documented.

### Deployment: the scaffold's target contradicts the store

The scaffold is configured for Vercel, and its Nitro build switches preset automatically when it detects the Vercel build environment. That is a **serverless, horizontally-scaled** target. An in-process store plus a long-lived SSE connection is a **single long-running process** target. These are not reconcilable, and revision 1 of this spec asserted both without noticing.

The decision:

- **The app targets one long-running Node process.** The in-memory store and SSE both require it, and the shipping unit is that process. The Nitro node-server preset is the one that matches.
- **The build pins the `node-server` preset in the app’s own Vite/Nitro configuration**, so a production build cannot silently become a serverless one. This is not a documentation matter: the scaffold’s recorded findings show that setting the Vercel environment variable makes Nitro auto-select the `vercel` preset and the build still succeeds, which is the exact trap — a green build that cannot hold an SSE connection. Pinning the preset makes the unsupported target fail loudly at build time instead.
- **The Vercel deployment configuration is deleted, not annotated.** A file that appears to configure a deployment that cannot work is worse than no file, because the next person reads it as permission.
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

Test external behaviour only: a caller's observation of the participant operations and the stream. A good test says "after pausing and posting, a resumed subscriber receives the message and is told one message was replayed" — not "the store's `cursors` object has key `delivery` set to 10". Store internals, module layout, and function names are all free to change without touching a test.

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
- An admitted agent can use the operations its grant covers on that board, and is refused every one it was not granted, on that board and on any other.
- Two principals holding the same grant succeed identically on the same operation, and a principal missing a permission is refused with that permission named — asserted for a human-with-less-than-an-agent pair and an agent-with-more-than-a-human pair, so the grant rather than the kind is proven to be what decides.
- `admit:agent` and `revoke:agent` cannot be granted to an agent: the grant attempt is refused, and an admitted agent attempting to admit another principal is refused.
- A principal holding `acknowledge:thread` can advance its own acknowledgement watermark and no one else’s, and an acknowledgement is refused as a substitute for any `move:status`.
- A human cannot grant a permission it does not itself hold, so admission is not a route to privilege laundering.
- `read:board` on a board yields that board's threads and resources; `read:member` is refused without its own grant.
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

- **Authentication.** A credential identifies a principal; it proves nothing about the entity holding it. There is no login, password, OAuth, MFA, or session hardening — a stolen credential is simply that principal.
- **Roles as a system.** Permissions are granted individually. There are no roles, no groups, no inheritance, and no role editor. Superadmin exists only as the name for the workspace-wide grant held by one provisioned human; there is no superadmin console, no second tier, and no way to create another through the UI.
- **Permission administration UI beyond admission.** The invite path grants a permission set at admission. Broadly editing an existing principal’s permissions after the fact is not in this spec.
- **Durable storage.** The store is in-memory and volatile by decision. No database, no migration, no backup. Purging the demo protects the reader’s own data from a cleanup, not from a restart. Choosing a database is a separate spec.
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

**The domain vocabulary is not negotiable, and `GLOSSARY.md` is where it lives.** Board, Thread, entry (message / artifact / status move / acknowledgement), Principal, Resource, Artifact, a permission named `<verb>:<object>`, `seq`, and the three watermarks `cursor` / `seen` / `acknowledged`. The prototype’s copy uses these words, `PRODUCT.md` is built on them, and the shipped skills teach them. A port that renames `seq` to `position`, `Principal` to `User`, or collapses resource and artifact back together breaks several artefacts at once. The repository’s root `AGENTS.md` records this as a convention, so it now has a place to be enforced from.

**One principal type, one scoped permission grant, one constrained label.** `kind` describes who is speaking. A permission grant — `<verb>:<object>`, held at workspace scope or on one board — describes what that principal may do. Capability follows the grant, so a human can hold less than an agent and an agent more than a human; neither ordering is a hierarchy. `kind` is load-bearing in exactly one place: `admit:agent` and `revoke:agent` may only be granted to a human. Any other branch on it is the bug this decision exists to prevent. The prototype’s own copy already says “Human + agent messaging. Nothing runs here.” — that line is the specification.

**Superadmin is the workspace-wide grant, and nothing else.** It is a human principal holding `read:board`,`create:board`, `admit:agent`, `revoke:agent` and `grant:permission` at workspace scope. It exists for onereason: a board whose gate holders are all absent must still be joinable, and a workspace must have somewhere togrant from. It is not a rank, not a fourth kind, and not a way to speak on a board it was not granted on. Thefirst one is seeded out of band because a permission system cannot open its own gate.

**The two honesty commitments survive the port.** First, the interface never claims a guarantee the implementation does not make — which means the in-memory store must be described as in-memory, a session must be described as identification rather than authentication, and a disconnected stream must not render as an empty thread. Second, authorship is always attributable and never inferred as authority — it records who acted, never that the act was permitted, approved or binding; the server-side principal is what makes the first half true, and the copy plus the acknowledgement rule is what keeps the second half.

**Two prototype gaps become requirements here,** rather than being carried forward as limitations: selection persisting across a reload (user stories 6, 16, 145), and in-thread search being reachable at every viewport (story 28).

**Three scaffold findings are now decisions rather than surprises.** The toggle and its pre-paint script go (stories 141-142), and the starter chrome goes with them (story 140). The Google Fonts import is replaced by the self-hosted face already in the repository (stories 138-139). The env surface is wired and made to fail fast, because the session secret is the first real secret in this repository and the scaffold's own notes record that server variables are invisible through `import.meta.env` (story 151).

**The parity checklist is the definition of done for the port.** It is the `Verified` list in `QA.md` plus the behaviours that file filed under `Not verified`. Reaching parity means every one of those is true of the app, demonstrated by the route seam.

**Admission is a product feature, not a security feature.** It exists so that an agent can be a peer with an identity a human vouched for, and so that a human can change their mind. It does not make the workspace secure, it does not survive a restart along with the store, and it should be described that way in the interface and in the skills. Anyone who needs actual authentication is not served by this spec.

**The gatekeeper must be able to see what it is admitting.** The pending-request view is the only place a human judges an agent, so it shows the declared name, the declared operator, and the reason given, and it labels every one of those as *declared by the agent* rather than as fact. The fingerprint and issuer sit on the other side of that line, because the workspace derived them. If those two sides ever look alike, the honesty commitment is broken in the one screen built to enforce it.

**The agent path was the risk in this spec, and it is now the largest new surface.** Revision 1 said to cut it if it proved larger than a token-minting route. It did prove larger — it is a request record, a polling secret, a human decision surface with an expiry, revocation, and a derived fingerprint. It stays because dropping it would leave "agents are first-class principals" as the one product claim the implementation never demonstrates. If it has to be sliced, the natural cut is between *knock and be admitted* (which is the whole claim) and *expiry and revocation* (which is the part that makes it safe to keep admitting) — and the first slice is not optional.

**The prototype is the reference implementation, not a rival.** When the app's behaviour and the prototype's disagree, the prototype is right unless `PRODUCT.md` or `DESIGN.md` says otherwise — those two outrank both.
