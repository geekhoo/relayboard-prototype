# 13a: The workspace holds its shape at every width

**From:** 13 — The whole workspace on a phone and at every width

**What to build:** Geometry. The three-column workspace degrades in a stated order: columns narrow first, the board rail becomes an overlay drawer at tablet width, and on a phone the thread list is the first screen with the conversation a second level behind a visible back control. Nothing overflows horizontally at any of the six supported widths, panels open fully inside the viewport, thread titles and excerpts truncate, and the composer stays reachable everywhere. This sub-issue is layout only; the keyboard and focus work is the next one.

**Blocked by:** 05 — Read a thread and post a message; 09 — Create a board or thread, and add a resource; 04c — The route seam's harness, which the plan is missing; 11c — A revoked principal's stream closes, and the demo control stays honest; 12 — A participant's identity, permissions and progress

**Status:** ready-for-agent

- [ ] No horizontal scrolling at 320, 390, 680, 980, 1200 or 1440 pixels: `documentElement.scrollWidth === clientWidth` at each width, measured by the harness in 04c. The six widths are the ones `QA.md` L20 and spec L9 record.
- [ ] On a phone the thread list is the first screen and the conversation is a second level of the same route, with a visible back control. The URL stays one address (spec L521).
- [ ] At tablet width the board rail becomes an overlay drawer with a scrim, and Escape and the scrim both close it.
- [ ] The composer is reachable and usable at every width, including 320px, and stays pinned to the bottom of the conversation.
- [ ] The details drawer and the stream panel open fully inside the viewport at every width, anchored as `QA.md` L21 records (25px from the right edge on desktop, 10px at ≤680px), with zero geometric overlap of the composer dock.
- [ ] Thread titles and excerpts truncate with an ellipsis rather than pushing the layout (`DESIGN.md` §123/story 123).
- [ ] In-thread message search is reachable at every width, including below 680px. The prototype's own gap (`QA.md` L27: the trigger button is `display:none` with no replacement entry point) is closed rather than carried forward.
- [ ] Columns narrow before anything else degrades: at 1200 and 980 the rail and pane lose width before the conversation does, and body text does not wrap below a readable measure.
- [ ] No content is hidden off-screen to make an overflow assertion pass — the checks are made on the rendered document, and a test asserts the composer and the active thread row are both visible at each width.
- [ ] The dark rail keeps the active-row inset edge and its unread counts at every width the rail is visible.
- [ ] Each of the six widths has an assertion in the route seam, not a screenshot: a legitimate design change must not fail the suite (spec L558).

**Leaves the build green:** yes.

**Note on the blocker:** the six overflow criteria are browser measurements, and the plan's only browser harness lives in ticket 15, which is blocked by this ticket. Listing 04c here breaks that cycle. If 04c is rejected, these criteria must be marked "measured by hand, as `QA.md` did" and this ticket stops being checkable by a reviewer.

**Note on the panels:** two of the criteria name the details drawer (12) and the stream panel (11b). If those tickets are not done when this one starts, move those two criteria into 11b and 12 rather than measuring a panel that does not exist.
