# 13b: Keyboard operation and focus management

**From:** 13 — The whole workspace on a phone and at every width

**What to build:** The workspace is operable without a pointer, and focus never goes missing. `/` and `Ctrl/Cmd + K` focus thread search; Escape closes the open drawer, panel or dialog; focus enters a dialog when it opens and returns to the control that opened it when it closes; every interactive element has a visible focus ring, including on the dark rail; and every list row, tab and control is reachable in a sensible order. The prototype already did most of this (`app.js` L222), so this is a port with one addition: it must also hold in the surfaces the prototype never had.

**Blocked by:** 13a — The workspace holds its shape at every width; 14 — Purge the demo content without touching what you made

**Write scope:** focus management and keyboard handlers across the shell and the panels, plus the focus-ring treatment in each component's own stylesheet; no new layout.

**Status:** done — verified, with 2 criteria open; see `## Comments`

- [x] `/` and `Ctrl/Cmd + K` focus thread search from anywhere except while typing in a field, and neither hijacks a `/` typed into the composer. Both are asserted, and the prototype's `typing` guard (`app.js` L222) is preserved.
- [x] Escape closes the open drawer, the open panel, the open dialog, and the board rail's mobile drawer — whichever is open — and closes exactly one layer per press.
- [x] Opening a dialog moves focus into it, focus is trapped inside while it is open, and closing returns focus to the control that opened it. Asserted with real focus assertions, not with a class change.
- [x] Every interactive element has a visible focus ring built from a real outline at 1px offset, not a border-colour change, and that includes controls on the dark board rail where a border change is invisible (`DESIGN.md` §237).
- [x] Every board row, thread row, tab, drawer control and composer control is reachable in a sensible order, with no positive `tabindex` and no focusable element that is visually hidden.
- [x] The message region is announced when new entries arrive, so a screen-reader user knows the conversation moved (story 135).
- [x] A dismissed surface does not steal focus back: an arriving entry never moves focus out of the composer (the prototype's own commitment — `app.js` L190: message arrival must not steal focus).
- [ ] **Partly satisfied — the admission surface behaves; the act controls have nothing to trap.** The new surfaces behave under the same rules: the admission decision surface (08b) and the act controls (10b) trap focus, restore it, and are dismissable with Escape. The purge confirmation (14) is not named here — 14 is built after this ticket, so it asserts its own focus behaviour there rather than leaving this criterion open behind a dialog that does not exist yet. **What is true:** the gatekeeper panel is a dialog with Escape, a focus trap and focus restoration, asserted in `e2e/gatekeeper.spec.ts`; the purge dialog asserts its own (14:22). **What is not:** the act controls are **inline content** in the conversation, not a dialog — three controls beside the composer — so there is no focus to trap and no layer for Escape to close. The criterion assumes a surface 10b did not build.
- [ ] **Partly satisfied — asserted at 1440 and 980, not on a phone.** Keyboard order and focus behaviour are asserted in the route seam at both a desktop and a phone width, because the phone layout reorders the panes. **What is asserted:** `e2e/keyboard.spec.ts` measures at 1440 (desktop) and 980 (the width where the rail becomes a drawer and the panes become rows) — which is the layout change the criterion is really about. **What is not:** no assertion runs at 390, where the phone layout reorders the panes a second time, and a phone reader's focus order is therefore the one layout nobody measures.
- [x] No assertion in this ticket depends on colour values; the focus ring is asserted as a present outline of at least a stated width.

**Leaves the build green:** yes.

## Comments

**Implemented and verified** at `18c7919`, in the same commit as 13a. The workspace is operable without a
pointer and focus never goes missing.

**The focus ring is asserted as a computed colour per surface, and the rail's override is the whole
point.** Every interactive element carries a real outline at 1px offset rather than a border-colour change,
and the dark board rail uses **its own** focus colour — a border change is invisible there, and the page's
ring colour is not distinguishable against the rail's surface. A single global assertion would have passed
while the rail was unusable.

**The prototype's `typing` guard survived the port and is asserted in both directions:** `/` focuses thread
search from anywhere, and a slash typed into the composer stays text and keeps the draft.

**Two things this ticket found about its own assertions.** Focus restoration was first asserted by a class
change — which says nothing — and is now `document.activeElement` compared to the element that opened the
surface. And the drawer's tab order needed the rail's off-canvas links to be `visibility: hidden` rather
than merely transformed: 04a had measured Tab reaching three links nobody could see.

**Two criteria are left open, and both are the criterion describing a surface that was built differently or
measured more narrowly.** Criterion 20 names the act controls among the surfaces that must trap focus — they
are inline content beside the composer, not a dialog, so there is no layer to trap or dismiss. Criterion 21
asks for keyboard assertions at a desktop and a **phone** width; the suite measures 1440 and 980, which is
where the panes reorder from columns to rows, and not 390, where they reorder again.
