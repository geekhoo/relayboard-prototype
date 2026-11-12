# 26: A failure is never rendered as an absence

**What to build:** The app distinguishes "there is nothing" from "I could not find out". A permission read that failed says so, rather than asserting to the reader that they hold no permission and disabling every control on the strength of an unread answer. A workspace with no boards is a screen with an action on it — inside the frame, with the control that creates a board — and a principal refused the workspace read lands on a stated refusal inside the frame rather than a framework error page. A board address that names nothing renders the app's own not-found state, and a route-seam test asserts it.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Found by:** product F7 at `src/routes/boards.$boardId.tsx:189-190`, `src/components/SessionNote.tsx:58,71-73`, `src/components/BoardPane.tsx:96-116`; product F12 at `src/routes/index.tsx:69-80` and `src/server/functions/read.ts:76-79`; product F13's board-not-found case at `src/routes/boards.$boardId.tsx:390-407`; security F15 at `src/components/BoardPane.tsx:384-388`.

- [ ] **Route seam.** When the held-permission read fails, the session note says the permissions could not be read, not that the reader holds none, and the create controls are disabled with a reason that names the failed read rather than a missing permission. Asserted by failing the read for that request and reading the rendered note; the test must fail if the fallback is an empty list.
- [ ] **Route seam.** The participant view's refusal stops telling the reader this build does not check grants. Its copy names the permission that was refused, which is what the reader is actually seeing.
- [ ] **Route seam.** A workspace with zero boards renders inside the frame, shows the control that creates a board, and creating one from that screen lands on the new board. The test starts from a workspace whose demo content has been purged, so the state is reachable without hand-editing the seed.
- [ ] **Route seam.** A principal holding `read:board` nowhere gets a stated refusal inside the frame — the rail still renders, the copy names the permission — and not the framework's error page. Asserted on the rendered frame, since no error boundary exists today.
- [ ] **Route seam.** A board address naming no board renders the app's own not-found state with a way back, and the rail is present. No test mentions this state today.
- [ ] **Unit/domain seam.** A refusal and an empty result remain distinguishable at the data layer: the query that answers "what may I do here" carries an error state that a component can branch on, so a future surface cannot repeat the `?? []` collapse in a third place.

**Leaves the build green:** yes.
