# 10b: An act reads as an event without becoming louder than a message

**From:** 10 — Authored acts share the thread chronology

**What to build:** The rendering half, to `DESIGN.md` §247–254. A status move, an artifact and an acknowledgement appear in the same chronology as messages, in `seq` order, with the same vertical rhythm and a smaller marker in place of the avatar — so a scan of the thread finds the conversation first. Each act's detail is inline rather than on a second row, an artifact shows the resource chip pointing at the canonical resource, and a refused act renders nothing at all.

**Blocked by:** 10a — Entry kinds in the domain, the store and the contract

**Write scope:** act rendering inside the entry list, as its own component with a co-located stylesheet; layout as utilities.

**Status:** ready-for-agent

- [ ] Acts and messages render in one list, ordered strictly by `seq`, with date dividers spanning both.
- [ ] An act uses a 28px rounded-square marker in place of the 35px avatar, one 13px line of description at Ink-muted rather than Ink-body, and the act's detail inline: from → to for a status move, the resource name for an artifact, the position range for an acknowledgement. No prose block, no second row (`DESIGN.md` §250–252).
- [ ] This is asserted as computed style, not as an impression: marker size, line count and text colour are each checked once, so "distinguishably but not louder" is checkable by a reviewer.
- [ ] An artifact renders the resource chip inline, pointing at the canonical resource — never a copy of its content — and following it opens the external document safely (`rel="noopener noreferrer"`, new context).
- [ ] Every act shows its author, the author's kind marker where the author is an agent, and its `#seq`, exactly as a message does (`DESIGN.md` §281: authorship, kind, time and sequence for every entry, whatever kind of principal authored it).
- [ ] An acknowledgement renders with no accent colour and no wording that could read as approval (`DESIGN.md` §295); a test asserts the accent tokens are absent from that entry.
- [ ] A refused act renders nothing in the chronology, and the refusal is reported where the attempt was made instead (`DESIGN.md` §254). A test attempts a refused act and asserts the thread's entry count is unchanged and no error entry appears.
- [ ] The three act-producing controls exist where the act is made: attach a resource to the thread, move the thread's status, acknowledge up to the latest position. Each is disabled with a stated reason when the reader lacks its permission (the rule from 07a).
- [ ] The thread details panel's counts and last-sequence read from the entry chronology, so they agree with what is on screen.
- [ ] The route seam covers one of each act end to end: the act appears at the right position, the thread's sequence advances by one, and a reload shows it still there.

**Leaves the build green:** yes.
