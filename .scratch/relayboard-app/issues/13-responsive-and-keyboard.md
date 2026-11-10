# 13: The whole workspace on a phone and at every width

**What to build:** The workspace works at 320px and at 1440px and every width between. Columns narrow before anything else degrades; the board rail becomes a drawer at tablet width; on a phone the thread list is the first screen and the conversation a second level with a visible back control. The composer stays reachable, panels open fully inside the viewport, and there is no horizontal scrolling anywhere. In-thread message search is reachable at every width, which the prototype did not manage.

**Blocked by:** 05 — read a thread and post a message; 09 — create boards, threads and resources

**Status:** ready-for-agent

- [ ] No horizontal scrolling at 320, 390, 680, 980, 1200 or 1440 pixels.
- [ ] On a phone the thread list is the first screen and the conversation is a second level with a visible back control.
- [ ] At tablet width the board rail becomes an overlay drawer with a scrim, and Escape and the scrim both close it.
- [ ] The composer is reachable and usable at every width.
- [ ] The details drawer and the stream panel open fully inside the viewport at every width, anchored as `DESIGN.md` describes.
- [ ] In-thread message search is reachable at every width, including below 680px.
- [ ] Thread titles and excerpts truncate with an ellipsis rather than pushing the layout.
- [ ] `/` and `Ctrl/Cmd + K` focus thread search; Escape closes the open drawer, panel or dialog; focus enters a dialog on open and returns on close.
- [ ] Every interactive element has a visible focus ring, including on the dark rail.
