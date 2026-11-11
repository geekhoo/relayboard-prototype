# 04b: The thread pane and the rest of the address

**From:** 04 — Browse boards and threads at a shareable URL

**What to build:** The middle column: a searchable, filterable, keyboard-operable list of the open board's threads, each row carrying title, latest excerpt, last author, entry count and an unread marker, ordered by the timestamp of the latest entry. The open thread is in the URL as well, a deep link restores it, a thread id that does not exist lands in the not-found state, and the resources and people views render their rows from the client. This is the ticket where the three-column workspace is complete enough to navigate without touching a thread's contents.

**Blocked by:** 04a — The route tree, the URL contract and the board rail

**Write scope:** the thread-pane route and its components, **each with its own co-located stylesheet**; layout and responsive stages as Tailwind utilities. Does not append to a shared stylesheet.

**Status:** done — verified, see `## Comments`

- [x] The open thread is in the URL, and reloading or pasting that URL restores the same board and thread.
- [x] A thread id in the URL that does not exist, or that belongs to a different board than the one named, renders the not-found state inside the app frame.
- [x] The prototype's `thread.pinned` (`app.js` L35, rendered by the sort at L142) is either carried into the domain and rendered as a pinned state, or dropped deliberately by a line in this ticket saying so — the one seeded pinned thread is why the question cannot be answered by silence.
- [x] Threads are ordered by the `createdAt` of their latest entry, descending. This is the one place a timestamp orders anything — a thread has no `seq` — and the ordering rule is stated in the code next to the sort so it is not mistaken for a violation of "order by `seq`". This sort is *across* threads and is the only timestamp ordering in the product; it proves nothing about in-thread ordering, and the seed's one out-of-order thread (spec L501) is a deviation the app adds, so the thread list must not be cited as evidence that a timestamp sort is safe.
- [x] Thread search filters on title and latest-entry text, and a search matching nothing renders a zero-result state with the prototype's copy ("No matching threads" / "Try a different search term.").
- [x] The unread filter narrows to threads whose `seen` watermark is behind the latest `seq`; with no unread threads it renders the "All caught up" state, and its control exposes `aria-pressed`.
- [x] Search text and filter state survive a reload because they are in the URL, and clearing them restores the full list.
- [x] Long titles and excerpts truncate with an ellipsis rather than widening the column.
- [x] Rows are reachable and activatable from the keyboard, the active row carries `aria-current` **and** the 1px inset edge, and its selected state does not rely on colour alone.
- [x] The resources view lists the open board's resources with name, URL and description, each as a canonical reference — no entry carries a copy of a resource's content.
- [x] The people view lists the principals on the open board from the client (see the members-read gap in the review, §5-C); a principal without the members permission sees the view disabled with a stated reason rather than an empty list.
- [x] Opening a thread is a navigation that changes the URL, not a state mutation.

**Leaves the build green:** yes.
## Comments

**Implemented and verified** at `1c35e22`. The middle column is the real thread list, the open thread is in
the address, and the resources and people views render from the client.

What was checked, rather than assumed:

- Opening a thread is a navigation: every row is an `<a href>` built by `threadHref` rather than a click
  handler, so middle-click, copy-link and the address bar work, and the route's `loaderDeps` re-runs the
  loader when the thread changes.
- A thread id that this board does not hold renders `ThreadNotFound` **inside** the conversation column
  with the thread list still usable beside it, because the board is real and a whole-frame error would be
  a worse place to land than the one the reader was trying to reach. The board-level case is a different
  state: `notFound()` from the loader lands on `BoardNotFound`, which keeps the rail.
- Ordering is the latest entry's `createdAt` descending, tie-broken by thread id so the list cannot
  reshuffle between two reads of the same data. The rule is stated **next to the sort** in
  `-thread-list.ts`, and so is the limit: it is the only timestamp ordering in the product, it holds
  *across* threads only, and it must not be cited as evidence that ordering by timestamp is safe
  anywhere else. `e2e/conversation.spec.ts` asserts the converse inside a thread against the seed's
  one out-of-order thread.
- Search matches title and latest-entry text, and there are **three** empty states rather than one:
  "No matching threads" / "All caught up" / "Start a conversation". The prototype's copy is kept for the
  first two, because a reader comparing the two products should see the same sentence.
- **`thread.pinned` is carried, and deliberately as a label rather than a sort key.** The prototype pins
  exactly one seeded thread (`app.js` L35) and renders a pin beside it; its sort (`app.js` L142) orders by
  the latest entry's timestamp and **never consults `pinned`**. Measured, not assumed: a pinned thread
  appears wherever its recency puts it. `src/domain/types.ts` records that in the field's own comment and
  `ThreadList.tsx` renders the word "Pinned" — a word, not a bare glyph, because a pin icon alone has no
  accessible name.
- **The session guard shipped into the client bundle once, and every gate was green.** `src/server/principal.ts`
  read `SESSION_SECRET` at module scope, the client entry's import graph reached it, and the bundler kept
  the top-level throw when it stripped the function bodies — so React never hydrated: the search box took
  text and wrote nothing, the filter did nothing, and links "worked" only because a browser follows an
  anchor without JavaScript. Every measurement in 06b was of the server's HTML, which was correct
  throughout. The fix gates the read on `import.meta.env.SSR`, a build-time constant, and `check:bundle`
  now fails if the secret's name, the guard's name or a Node built-in appears in any built client asset.
  This belongs to 04b's record because it was found by driving this screen.

**The unread filter and the badge** read the `seen` watermark and nothing else — the prototype's own
computation also excluded the reader's own entries, and that exclusion is deliberately not carried: 11b
settles it, together with the three seeded threads whose badge numbers differ between the two rules.
