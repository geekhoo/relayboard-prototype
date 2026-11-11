# 09: Create a board or thread, and add a resource

**What to build:** A participant with the grant can create a board, create a thread in a board, and add a resource to a board, each opening immediately so creating and using are one continuous act. A resource is the board-scoped canonical reference — name, URL, type and description — and an invalid or non-HTTP URL is refused before anything is stored. External links open safely.

The prototype is a working reference for all three: `app.js` L164–L176 implements the three create paths, including the URL check and the immediate-selection behaviour. Read it before starting rather than designing this from the spec.

**Blocked by:** 07b — The two rules that keep the gate human and the grant unlaunderable

**Write scope:** the create dialogs, the resource list and the resource detail components, **each with its own co-located stylesheet**; layout as utilities.

**Status:** done — verified; see `## Comments`

- [x] `create:board`, `create:thread` and `add:resource` are each enforced independently; holding one does not grant another.
- [x] A newly created board opens immediately with an empty state that says what to do next.
- [x] A newly created thread opens and is ready to post into.
- [x] A resource carries a name, URL, type and description. **The type is a closed, named set**, stated as literals rather than a free-text box nothing can filter on later: `type ∈ { Document, Repository, Design, Link }` — the three the seed uses (`app.js` L30–32: `Document`, `Repository`, `Design`) plus `Link`, which is the prototype's own default on `addResource` (`app.js` L117). The set is a validated enum rejected at the boundary like the URL, and the seed's three values reproduce exactly.
- [x] A resource is listed on its board as a canonical reference, and **is not copied into any thread that references it**.
- [x] A non-HTTP(S) URL is refused by the validator before the store is touched, with a reason the reader can act on.
- [x] External links open in a new context without handing the destination control of the session.
- [x] A failed create leaves the dialog open with the reason rather than closing on error.
- [x] **An action the reader lacks the grant for is disabled with the missing permission named, not hidden and not silently refused** — using the one "cannot do this" affordance that 07a decides, so this ticket and 10a do not invent two.

## Comments

**Implemented and verified** at `d17ac1f`. The three create actions the prototype had, with their
validation promoted from the browser to the boundary.

Fields and wording follow the prototype. **Three departures are stated where they are made:**

- **Character limits are checked on arrival rather than by a `maxlength` attribute**, because an attribute
  is something a request can ignore and this app has a server. The limits are the prototype's numbers,
  asserted at one character past the limit and one character at it.
- **The resource type is a closed set of four with the prototype's own default** — the three the seed uses
  plus `Link`, which is `addResource`'s default in `app.js`. Stated as an enum rejected at the boundary,
  so the seeded three reproduce exactly and a free-text value cannot enter the store.
- **A failed create keeps the dialog open with the reason**, which departs from the prototype's toast: a
  toast that is missed takes the reader's typing with it.

What was checked, rather than assumed:

- A URL is refused before the store is touched if it is not HTTP or HTTPS, and the reason is actionable.
  Removing the check fails two tests, including the one that walks `javascript`, `data`, `vbscript` and
  `file` URLs.
- External links carry `noopener` with `noreferrer`, and the comment says which of the two is
  load-bearing.
- `create:board`, `create:thread` and `add:resource` are each enforced independently through the declared
  requirement table, so holding one does not grant another.
- **The disabled-with-reason affordance 07a declared and could not exercise is exercised here with a real
  asymmetry rather than a mock:** a principal holding two of the three create grants on a board sees the
  third control disabled with the workspace-scoped permission named. That closes 07a's open box in
  practice, though 07a's line stays open for the reason it gives.

**Two defects, both found by a route-seam test rather than by the unit suite:**

- **A workspace-scoped permission was read as a board-scoped list**, so the one principal who holds
  `create:board` saw every board-creating control disabled. Each read was correct in isolation; the defect
  was that the surface asked one question and rendered two kinds of control. The fix is a read returning
  two lists rather than a union — the same rule the grant fix established: a board-scoped answer and a
  workspace-scoped answer are different statements.
- **Creating a board did not invalidate the rail's cached read**, so the board was created and the rail
  still showed the old count until a reload. That is the cost of priming: the command that makes first
  paint correct is the command that can leave it stale.

**Creating is guarded by a ref set before the await** — the third place that shape has been needed — and
the test fires both activations inside one page task so React gets no render between them. Removing the
guard creates two boards from one click.

**The new operation moved four deliberate assertions** — the operation list, the permission table, and the
two requirement shapes — which is the behaviour those assertions exist for rather than an inconvenience.
