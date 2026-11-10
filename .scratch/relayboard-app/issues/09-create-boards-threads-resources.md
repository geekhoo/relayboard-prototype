# 09: Create a board or thread, and add a resource

**What to build:** A participant with the grant can create a board, create a thread in a board, and add a resource to a board, each opening immediately so creating and using are one continuous act. A resource is the board-scoped canonical reference — name, URL, type and description — and an invalid or non-HTTP URL is refused before anything is stored. External links open safely.

**Blocked by:** 07 — named, scoped permissions

**Status:** ready-for-agent

- [ ] `create:board`, `create:thread` and `add:resource` are each enforced independently; holding one does not grant another.
- [ ] A newly created board opens immediately with an empty state that says what to do next.
- [ ] A newly created thread opens and is ready to post into.
- [ ] A resource carries a name, URL, type and description, and is listed on its board as a canonical reference.
- [ ] A non-HTTP(S) URL is refused by the validator before the store is touched, with a reason the reader can act on.
- [ ] External links open in a new context without handing the destination control of the session.
- [ ] A failed create leaves the dialog open with the reason rather than closing on error.
