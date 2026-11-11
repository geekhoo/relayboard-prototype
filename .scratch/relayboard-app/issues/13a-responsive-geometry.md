# 13a: The workspace holds its shape at every width

**From:** 13 — The whole workspace on a phone and at every width

**What to build:** Geometry. The three-column workspace degrades in a stated order: columns narrow first, the board rail becomes an overlay drawer at tablet width, and on a phone the thread list is the first screen with the conversation a second level behind a visible back control. Nothing overflows horizontally at any of the six supported widths, panels open fully inside the viewport, thread titles and excerpts truncate, and the composer stays reachable everywhere. This sub-issue is layout only; the keyboard and focus work is the next one.

**Blocked by:** 05 — Read a thread and post a message; 09 — Create a board or thread, and add a resource; 04c — The route seam's harness, which the plan is missing; 11c — A revoked principal's stream closes, and the demo control stays honest; 12 — A participant's identity, permissions and progress

**Write scope:** the frame grid, the responsive stages and the layout rules in **each affected component's own stylesheet**, plus the utilities that express breakpoints. This ticket is the only one allowed to change layout across components; no other ticket restyles another's frame.

**Status:** ready-for-agent

- [ ] **No horizontal scrolling at 320, 390, 680, 980, 1200 or 1440 pixels, measured on the scrollable content box of each column and of the message list — not on `documentElement`.** `documentElement.scrollWidth === clientWidth` is vacuous under `overflow: hidden`, which the prototype sets on `html, body` and which would let a real overflow ship green. So each visible scroll container — the board rail, the thread pane and the conversation — asserts `scrollWidth <= clientWidth + 1`, and the document is measured only with `overflow` temporarily unset on `html` and `body` by the harness.
- [ ] **The frame sets no `overflow: hidden`.** Clipping is allowed only on a panel that genuinely scrolls internally, and the assertion above proves the content fits rather than that it was cut off. The static half of this rule already exists: `scripts/check-app-styles.mjs`'s `no-frame-clip` rule fails `npm run check:styles`, and CI runs it, when a rule whose selector names `html` or `body` sets `overflow` or `overflow-x: hidden`. That rule cannot see a clipped pane or a computed style, so the browser measurement complements it instead of duplicating it.
- [ ] **Each of the frame's three surfaces covers its own track at every width where it is a column.** The rail, the thread pane and the conversation each have the same height as the frame, and each surface's painted background covers its full content box — measured with `getBoundingClientRect` and `getComputedStyle`, never by screenshot. This criterion exists because a surface that stops short of its track still satisfies every "no overflow" assertion: a rail 221px tall in a 900px column has no horizontal overflow and is still wrong. `DESIGN.md` §130 makes the three depths of the frame a statement about the whole height, so a column that ends two-thirds of the way down is a card sitting on a page rather than one of three depths.
- [ ] A deliberately over-wide child in a test renders a visible overflow, proving the assertion can fail.
- [ ] On a phone the thread list is the first screen and the conversation is a second level of the same route, with a visible back control. The URL stays one address (spec L545).
- [ ] At tablet width the board rail becomes an overlay drawer with a scrim, and Escape and the scrim both close it.
- [ ] The composer is reachable and usable at every width, including 320px, and stays pinned to the bottom of the conversation.
- [ ] The details drawer and the stream panel open fully inside the viewport at every width, anchored as `QA.md` L21 records (25px from the right edge on desktop, 10px at ≤680px), with zero geometric overlap of the composer dock.
- [ ] Thread titles and excerpts truncate with an ellipsis rather than pushing the layout (story 123, spec L184).
- [ ] In-thread message search is reachable at every width, including below 680px. The prototype's own gap (`QA.md` L29: the trigger button is `display:none` with no replacement entry point) is closed rather than carried forward.
- [ ] Columns narrow before anything else degrades: at 1200 and 980 the rail and pane lose width before the conversation does, and body text does not wrap below a readable measure.
- [ ] No content is hidden off-screen to make an overflow assertion pass — the checks are made on the rendered document, and a test asserts the composer and the active thread row are both visible at each width.
- [ ] The dark rail keeps the active-row inset edge and its unread counts at every width the rail is visible.
- [ ] **The type and contrast floors hold at every width — 13a makes the first assertion of the floors**, at its two extremes; 15a's criterion re-asserts them over the full product text rather than introducing them. At 1440 and 390, no rendered text with a functional role computes below 11px and no body copy below 13px, and every text/background pair on the conversation, pane and rail meets WCAG AA computed from resolved colours against the element's actual background — both measured with 04c's computed-style helper. Not 05: it renders one thread at whatever width the harness sets and has no rail, drawer or stream panel to measure, so a floor asserted there would measure a fragment and pass for the wrong reason. 01's "a browser assertion exists by the time text does" therefore means before the parity claim is made, not at the first text-bearing ticket.
- [ ] Each of the six widths has an assertion in the route seam, not a screenshot: a legitimate design change must not fail the suite (spec L582).

**Leaves the build green:** yes.

**Note on the blocker:** the six overflow criteria are browser measurements, and the plan's only browser harness lives in ticket 15, which is blocked by this ticket. Listing 04c here breaks that cycle. If 04c is rejected, these criteria must be marked "measured by hand, as `QA.md` did" and this ticket stops being checkable by a reviewer.

**Note on the panels:** two of the criteria name the details drawer (12) and the stream panel (11b). If those tickets are not done when this one starts, move those two criteria into 11b and 12 rather than measuring a panel that does not exist.
