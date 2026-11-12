# 25: Escape closes exactly one layer, and the tests that say so open one

**What to build:** One key press closes one layer. With the rail drawer open and a modal dialog over it, Escape closes the dialog and leaves the drawer; the next press closes the drawer and returns focus to the control that opened it. Thread details dismiss from the keyboard the way the parity checklist claims, or the checklist stops claiming it. The purge dialog's Escape path is live code or it is deleted — a native dialog already does the job, so a handler that cannot run is a claim with no mechanism behind it. And the parity checklist's status field stops marking a line covered on the strength of a test whose body asserts something adjacent.

**Blocked by:** 20 — The interface, and the code's own guards, stop claiming what the build does not do. The keyboard and dialog criteria below need no blocker, but the parity-status criterion cannot be honest before 20 lands: a status may only be re-graded against a behaviour that exists, and at least one line the checklist marks covered (the indicator never reading "Live" while disconnected) is a behaviour 20 builds. Taking 20 first also keeps two edits to the same panel copy from landing in opposite orders.

**Status:** ready-for-agent

**Found by:** product F5 at `src/components/-keyboard.ts:81` against the guard at `:64`, and `e2e/keyboard.spec.ts:296`; product F6 at `src/components/Conversation.tsx:280-303` and `e2e/parity.spec.ts:1274`; product F15 at `src/components/PurgeDialog.tsx:54-67` and `e2e/purge.spec.ts:75-107`; product F11 at `e2e/helpers/parity.ts:186-193,490-505`.

- [ ] **Route seam.** At drawer width, open the drawer, then open a create dialog over it, then press Escape once: the dialog is closed, the drawer is still open, and focus is inside the dialog's layer or on the drawer's toggle — not stranded behind a modal. The test opens both layers first; the existing case, which presses Escape with only the drawer open, stays as the trivial half.
- [ ] **Route seam.** A second Escape then closes the drawer and returns focus to the control that opened it, asserted by the focused element rather than by the drawer's attribute alone.
- [ ] **Route seam.** With no dialog open the drawer's Escape is unchanged, and with no drawer open the key does nothing — both asserted, so the fix cannot make Escape a no-op.
- [ ] **Route seam.** Thread details close on Escape if the checklist keeps that claim: the test presses Escape and asserts the closed state. If the product decides a native disclosure keeps its own behaviour, the checklist line and the test's name change together and the test asserts what is true. Either way, a test whose name claims Escape must press it.
- [ ] **Route seam.** The purge dialog closes on Escape and returns focus to its opener, and the mechanism is the one the code has: if the explicit handler is kept, deleting it makes the test fail; if it is deleted as redundant, no test may credit it. Satisfied by either decision, and by neither silence.
- [ ] **Route seam.** The parity checklist's statuses mean what its legend says: lines marked covered are asserted by their named test, and any line whose covering test asserts something adjacent is marked honestly instead. Asserted by counting the covered statuses against the tests named — the substitution is recorded in the status, not only in a comment.
- [ ] **Unit/domain seam.** One layer per press is a property of the keyboard layer, not of one surface: a dialog being open suppresses the drawer branch within a single handler invocation, asserted directly so a future second listener cannot reopen the double close.

**Leaves the build green:** yes.
