# 10b: An act reads as an event without becoming louder than a message

**From:** 10 — Authored acts share the thread chronology

**What to build:** The rendering half, to `DESIGN.md` §247–254. A status move, an artifact and an acknowledgement appear in the same chronology as messages, in `seq` order, with the same vertical rhythm and a smaller marker in place of the avatar — so a scan of the thread finds the conversation first. Each act's detail is inline rather than on a second row, an artifact shows the resource chip pointing at the canonical resource, and a refused act renders nothing at all.

**Blocked by:** 10a — Entry kinds in the domain, the store and the contract

**Write scope:** act rendering inside the entry list, as its own component with a co-located stylesheet; layout as utilities.

**Status:** done — verified, with 1 criterion open; see `## Comments`

- [x] Acts and messages render in one list, ordered strictly by `seq`, with date dividers spanning both.
- [x] An act uses a 28px rounded-square marker in place of the 35px avatar, one 13px line of description at Ink-muted rather than Ink-body, and the act's detail inline: from → to for a status move, the resource name for an artifact, the position range for an acknowledgement. No prose block, no second row (`DESIGN.md` §250–252).
- [x] This is asserted as computed style, not as an impression: marker size, line count and text colour are each checked once, so "distinguishably but not louder" is checkable by a reviewer.
- [x] An artifact renders the resource chip inline, pointing at the canonical resource — never a copy of its content — and following it opens the external document safely (`rel="noopener noreferrer"`, new context).
- [x] Every act shows its author, the author's kind marker where the author is an agent, and its `#seq`, exactly as a message does (`DESIGN.md` §281: authorship, kind, time and sequence for every entry, whatever kind of principal authored it).
- [x] An acknowledgement renders with no accent colour and no wording that could read as approval (`DESIGN.md` §295); a test asserts the accent tokens are absent from that entry.
- [ ] **Partly satisfied — a refused act renders nothing, and the refusal at the seam is not asserted.** A refused act renders nothing in the chronology, and the refusal is reported where the attempt was made instead (`DESIGN.md` §254). **The rendering half is true and structural:** an act reaches the chronology only by being committed, a refusal throws before the store is touched, and the surface renders the reason in `role="alert"` beside the controls it came from. **What is missing:** no route-seam test attempts a refused act and asserts the entry count is unchanged and no error entry appears. The unit suite asserts the store's refusal; the browser never attempts one.
- [x] The three act-producing controls exist where the act is made: attach a resource to the thread, move the thread's status, acknowledge up to the latest position. Each is disabled with a stated reason when the reader lacks its permission (the rule from 07a).
- [x] The thread details panel's counts and last-sequence read from the entry chronology, so they agree with what is on screen.
- [x] The route seam covers one of each act end to end: the act appears at the right position, the thread's sequence advances by one, and a reload shows it still there.

**Leaves the build green:** yes.

## Comments

**Implemented and verified** at `333923d`. Artifacts, status moves and acknowledgements render inside the
one chronology, ordered by `seq` with the messages, separated by styling rather than by position.

**This was the first ticket where `DESIGN.md` rather than the prototype was the reference, and reading it
found a pre-existing deviation:** the message avatar had been drawn as a **circle**, which the design
system reserves for status dots and which gives avatars a corner radius and 35px. It is now a 35px rounded
square, the act marker took the 28px the message had been using wrongly, and the comment says which moved
and why.

**The separation is measured rather than eyeballed:** the marker is 35px for a message and 28px for an act,
the act's computed colour equals the ink-muted token while the message's does not, and both properties were
proved to fail when removed.

**An acknowledgement carries no verdict and the surface holds that line three times over:** no field in the
model, a rendered line that reads as a position rather than an opinion, and a control named for what it
does. Asserted twice — the text must match the acknowledged-up-to wording and must **not** contain
approved, agreed, done, complete, resolved or signed, and no element in that entry may carry an accent.

**A stub-transport defect, and it is the same shape as one 11a later found.** A fix landed in the in-memory
client and not the HTTP one, and the suite could not see it because its assertions ran against whichever
transport the workspace supplied. That is why the stream conformance suite drives **both** transports and
says so where the subject is built.

**One criterion is left open and it is a missing assertion, not a missing behaviour.** Criterion 19 asks
that a refused act renders nothing in the chronology and that the refusal is reported where the attempt was
made. Both are true of the code — a refusal throws before the store is touched, and the reason renders in a
`role="alert"` beside the control — but no browser test attempts a refused act and counts the entries. The
unit suite asserts the store's refusal and the surface's rendering is unexercised; ticking it would claim a
seam assertion nobody wrote.
