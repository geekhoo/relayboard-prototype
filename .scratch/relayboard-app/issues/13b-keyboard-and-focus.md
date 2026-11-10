# 13b: Keyboard operation and focus management

**From:** 13 — The whole workspace on a phone and at every width

**What to build:** The workspace is operable without a pointer, and focus never goes missing. `/` and `Ctrl/Cmd + K` focus thread search; Escape closes the open drawer, panel or dialog; focus enters a dialog when it opens and returns to the control that opened it when it closes; every interactive element has a visible focus ring, including on the dark rail; and every list row, tab and control is reachable in a sensible order. The prototype already did most of this (`app.js` L222), so this is a port with one addition: it must also hold in the surfaces the prototype never had.

**Blocked by:** 13a — The workspace holds its shape at every width; 14 — Purge the demo content without touching what you made

**Write scope:** focus management and keyboard handlers across the shell and the panels; no new layout.

**Status:** ready-for-agent

- [ ] `/` and `Ctrl/Cmd + K` focus thread search from anywhere except while typing in a field, and neither hijacks a `/` typed into the composer. Both are asserted, and the prototype's `typing` guard (`app.js` L222) is preserved.
- [ ] Escape closes the open drawer, the open panel, the open dialog, and the board rail's mobile drawer — whichever is open — and closes exactly one layer per press.
- [ ] Opening a dialog moves focus into it, focus is trapped inside while it is open, and closing returns focus to the control that opened it. Asserted with real focus assertions, not with a class change.
- [ ] Every interactive element has a visible focus ring built from a real outline at 1px offset, not a border-colour change, and that includes controls on the dark board rail where a border change is invisible (`DESIGN.md` §229).
- [ ] Every board row, thread row, tab, drawer control and composer control is reachable in a sensible order, with no positive `tabindex` and no focusable element that is visually hidden.
- [ ] The message region is announced when new entries arrive, so a screen-reader user knows the conversation moved (story 135).
- [ ] A dismissed surface does not steal focus back: an arriving entry never moves focus out of the composer (the prototype's own commitment — `app.js` L190: message arrival must not steal focus).
- [ ] The new surfaces behave under the same rules: the admission decision surface (08b), the purge confirmation (14) and the act controls (10b) trap focus, restore it, and are dismissable with Escape.
- [ ] Keyboard order and focus behaviour are asserted in the route seam at both a desktop and a phone width, because the phone layout reorders the panes.
- [ ] No assertion in this ticket depends on colour values; the focus ring is asserted as a present outline of at least a stated width.

**Leaves the build green:** yes.
