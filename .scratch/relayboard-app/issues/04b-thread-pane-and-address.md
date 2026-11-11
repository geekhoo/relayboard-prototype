# 04b: The thread pane and the rest of the address

**From:** 04 — Browse boards and threads at a shareable URL

**What to build:** The middle column: a searchable, filterable, keyboard-operable list of the open board's threads, each row carrying title, latest excerpt, last author, entry count and an unread marker, ordered by the timestamp of the latest entry. The open thread is in the URL as well, a deep link restores it, a thread id that does not exist lands in the not-found state, and the resources and people views render their rows from the client. This is the ticket where the three-column workspace is complete enough to navigate without touching a thread's contents.

**Blocked by:** 04a — The route tree, the URL contract and the board rail

**Write scope:** the thread-pane route and its components, **each with its own co-located stylesheet**; layout and responsive stages as Tailwind utilities. Does not append to a shared stylesheet.

**Status:** ready-for-agent

- [ ] The open thread is in the URL, and reloading or pasting that URL restores the same board and thread.
- [ ] A thread id in the URL that does not exist, or that belongs to a different board than the one named, renders the not-found state inside the app frame.
- [ ] The prototype's `thread.pinned` (`app.js` L35, rendered by the sort at L142) is either carried into the domain and rendered as a pinned state, or dropped deliberately by a line in this ticket saying so — the one seeded pinned thread is why the question cannot be answered by silence.
- [ ] Threads are ordered by the `createdAt` of their latest entry, descending. This is the one place a timestamp orders anything — a thread has no `seq` — and the ordering rule is stated in the code next to the sort so it is not mistaken for a violation of "order by `seq`". This sort is *across* threads and is the only timestamp ordering in the product; it proves nothing about in-thread ordering, and the seed's one out-of-order thread (spec L501) is a deviation the app adds, so the thread list must not be cited as evidence that a timestamp sort is safe.
- [ ] Thread search filters on title and latest-entry text, and a search matching nothing renders a zero-result state with the prototype's copy ("No matching threads" / "Try a different search term.").
- [ ] The unread filter narrows to threads whose `seen` watermark is behind the latest `seq`; with no unread threads it renders the "All caught up" state, and its control exposes `aria-pressed`.
- [ ] Search text and filter state survive a reload because they are in the URL, and clearing them restores the full list.
- [ ] Long titles and excerpts truncate with an ellipsis rather than widening the column.
- [ ] Rows are reachable and activatable from the keyboard, the active row carries `aria-current` **and** the 1px inset edge, and its selected state does not rely on colour alone.
- [ ] The resources view lists the open board's resources with name, URL and description, each as a canonical reference — no entry carries a copy of a resource's content.
- [ ] The people view lists the principals on the open board from the client (see the members-read gap in the review, §5-C); a principal without the members permission sees the view disabled with a stated reason rather than an empty list.
- [ ] Opening a thread is a navigation that changes the URL, not a state mutation.

**Leaves the build green:** yes.
