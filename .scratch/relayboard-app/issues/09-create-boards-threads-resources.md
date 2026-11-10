# 09: Create a board or thread, and add a resource

**What to build:** A participant with the grant can create a board, create a thread in a board, and add a resource to a board, each opening immediately so creating and using are one continuous act. A resource is the board-scoped canonical reference — name, URL, type and description — and an invalid or non-HTTP URL is refused before anything is stored. External links open safely.

The prototype is a working reference for all three: `app.js` L164–L176 implements the three create paths, including the URL check and the immediate-selection behaviour. Read it before starting rather than designing this from the spec.

**Blocked by:** 07b — The two rules that keep the gate human and the grant unlaunderable

**Write scope:** the create dialogs, the resource list and the resource detail components; append-only additions to `src/styles.css`.

**Status:** ready-for-agent

- [ ] `create:board`, `create:thread` and `add:resource` are each enforced independently; holding one does not grant another.
- [ ] A newly created board opens immediately with an empty state that says what to do next.
- [ ] A newly created thread opens and is ready to post into.
- [ ] A resource carries a name, URL, type and description. **The type is a closed, named set** — the prototype hard-codes one value and the spec treats it as a field, so this ticket fixes the set (a document, a repository, a specification, a design file, and an "other" that still names its source) rather than shipping a free-text box nothing can filter on later.
- [ ] A resource is listed on its board as a canonical reference, and **is not copied into any thread that references it**.
- [ ] A non-HTTP(S) URL is refused by the validator before the store is touched, with a reason the reader can act on.
- [ ] External links open in a new context without handing the destination control of the session.
- [ ] A failed create leaves the dialog open with the reason rather than closing on error.
- [ ] **An action the reader lacks the grant for is disabled with the missing permission named, not hidden and not silently refused** — using the one "cannot do this" affordance that 07a decides, so this ticket and 10a do not invent two.
