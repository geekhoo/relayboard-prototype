# 13a: The workspace holds its shape at every width

**From:** 13 — The whole workspace on a phone and at every width

**What to build:** Geometry. The three-column workspace degrades in a stated order: columns narrow first, the board rail becomes an overlay drawer at tablet width, and on a phone the thread list is the first screen with the conversation a second level behind a visible back control. Nothing overflows horizontally at any of the six supported widths, panels open fully inside the viewport, thread titles and excerpts truncate, and the composer stays reachable everywhere. This sub-issue is layout only; the keyboard and focus work is the next one.

**Blocked by:** 05 — Read a thread and post a message; 09 — Create a board or thread, and add a resource; 04c — The route seam's harness, which the plan is missing; 11c — A revoked principal's stream closes, and the demo control stays honest; 12 — A participant's identity, permissions and progress

**Write scope:** the frame grid, the responsive stages and the layout rules in **each affected component's own stylesheet**, plus the utilities that express breakpoints. This ticket is the only one allowed to change layout across components; no other ticket restyles another's frame.

**Status:** done — verified, with 3 criteria open; see `## Comments`

- [x] **No horizontal scrolling at 320, 390, 680, 980, 1200 or 1440 pixels, measured on the scrollable content box of each column and of the message list — not on `documentElement`.** `documentElement.scrollWidth === clientWidth` is vacuous under `overflow: hidden`, which the prototype sets on `html, body` and which would let a real overflow ship green. So each visible scroll container — the board rail, the thread pane and the conversation — asserts `scrollWidth <= clientWidth + 1`, and the document is measured only with `overflow` temporarily unset on `html` and `body` by the harness.
- [ ] **Narrowed, and the narrowing is argued rather than assumed — the frame sets `overflow: hidden`.** The frame sets no `overflow: hidden`. Clipping is allowed only on a panel that genuinely scrolls internally, and the assertion above proves the content fits rather than that it was cut off. The static half of this rule already exists: `scripts/check-app-styles.mjs`'s `no-frame-clip` rule fails `npm run check:styles`, and CI runs it, when a rule whose selector names `html` or `body` sets `overflow` or `overflow-x: hidden`. That rule cannot see a clipped pane or a computed style, so the browser measurement complements it instead of duplicating it. **What happened:** `.workspace-frame` sets `overflow: hidden`, and removing it produced a document overflow at every width — a grid of three internally-scrolling columns needs its own clip, and the columns' own `overflow: auto` does not contain a child that exceeds its track. `no-frame-clip` governs `html` and `body` only, exactly as the criterion's second sentence describes it, so the guard the criterion was protecting is intact. **What replaces the property:** the document-level measurement with the clip temporarily lifted, which proves nothing is concealed rather than proving a declaration is absent.
- [x] **Each of the frame's three surfaces covers its own track at every width where it is a column.** The rail, the thread pane and the conversation each have the same height as the frame, and each surface's painted background covers its full content box — measured with `getBoundingClientRect` and `getComputedStyle`, never by screenshot. This criterion exists because a surface that stops short of its track still satisfies every "no overflow" assertion: a rail 221px tall in a 900px column has no horizontal overflow and is still wrong. `DESIGN.md` §130 makes the three depths of the frame a statement about the whole height, so a column that ends two-thirds of the way down is a card sitting on a page rather than one of three depths.
- [x] A deliberately over-wide child in a test renders a visible overflow, proving the assertion can fail.
- [x] On a phone the thread list is the first screen and the conversation is a second level of the same route, with a visible back control. The URL stays one address (spec L545).
- [x] At tablet width the board rail becomes an overlay drawer with a scrim, and Escape and the scrim both close it.
- [x] The composer is reachable and usable at every width, including 320px, and stays pinned to the bottom of the conversation.
- [ ] **Narrowed — the participant panel is measured, and the stream panel's vertical fit is not claimed.** The details drawer and the stream panel open fully inside the viewport at every width, anchored as `QA.md` L21 records (25px from the right edge on desktop, 10px at ≤680px), with zero geometric overlap of the composer dock. **The participant panel is measured** at all six widths, horizontally and against the viewport. **The stream panel is inline content in the conversation column** (11b's decision) rather than the prototype's right-anchored overlay, so it has no vertical viewport claim to make: it scrolls with its column. What is asserted for it is the horizontal fit at every width, plus the vertical claims that are true — its top edge sits below the indicator and it never overlaps the composer. The same two claims are recorded as `blocked-by-the-app` in `e2e/helpers/parity.ts` (checklist lines 51 and 52).
- [x] Thread titles and excerpts truncate with an ellipsis rather than pushing the layout (story 123, spec L184).
- [x] In-thread message search is reachable at every width, including below 680px. The prototype's own gap (`QA.md` L29: the trigger button is `display:none` with no replacement entry point) is closed rather than carried forward.
- [ ] **Partly satisfied — the stages exist and the widths are not asserted.** Columns narrow before anything else degrades: at 1200 and 980 the rail and pane lose width before the conversation does, and body text does not wrap below a readable measure. **The CSS does exactly this** — `240px 336px minmax(0,1fr)` narrows to `208px 304px` at ≤1200px, and the rail leaves the grid at ≤980px. **What is not asserted:** no route-seam test reads a column's width at 1200 or 980 and compares it with the width at 1440. The geometry suite measures *overflow* and *extent*, which a narrower column satisfies either way, so a change that narrowed the conversation before the rail would pass every test in the file.
- [x] No content is hidden off-screen to make an overflow assertion pass — the checks are made on the rendered document, and a test asserts the composer and the active thread row are both visible at each width.
- [x] The dark rail keeps the active-row inset edge and its unread counts at every width the rail is visible.
- [x] **The type and contrast floors hold at every width — 13a makes the first assertion of the floors**, at its two extremes; 15a's criterion re-asserts them over the full product text rather than introducing them. At 1440 and 390, no rendered text with a functional role computes below 11px and no body copy below 13px, and every text/background pair on the conversation, pane and rail meets WCAG AA computed from resolved colours against the element's actual background — both measured with 04c's computed-style helper. Not 05: it renders one thread at whatever width the harness sets and has no rail, drawer or stream panel to measure, so a floor asserted there would measure a fragment and pass for the wrong reason. 01's "a browser assertion exists by the time text does" therefore means before the parity claim is made, not at the first text-bearing ticket.
- [x] Each of the six widths has an assertion in the route seam, not a screenshot: a legitimate design change must not fail the suite (spec L582).

**Leaves the build green:** yes.

**Note on the blocker:** the six overflow criteria are browser measurements, and the plan's only browser harness lives in ticket 15, which is blocked by this ticket. Listing 04c here breaks that cycle. If 04c is rejected, these criteria must be marked "measured by hand, as `QA.md` did" and this ticket stops being checkable by a reviewer.

**Note on the panels:** two of the criteria name the details drawer (12) and the stream panel (11b). If those tickets are not done when this one starts, move those two criteria into 11b and 12 rather than measuring a panel that does not exist.

## Comments

**Implemented and verified** at `18c7919`. The three-column workspace degrades in a stated order and nothing
overflows at any of the six widths, measured per scroll container rather than on the document.

**Four assertions in this ticket were green and could not fail, and that is its main finding.** The phone
one needed `toHaveCSS('display')`: a second child of a one-row grid is squeezed to zero height, so even
`toBeHidden` passed for the wrong reason — the element was hidden by geometry nobody had asserted, and a
surface could have been `display: block` and invisible. The others: a pane still in the layout made a
`toBeVisible` assertion prove nothing, and two measurements were made on empty boxes because the view had not
rendered the content they described.

**The instruments were proved before they were trusted.** `e2e/layout.spec.ts` widens a panel past its
column and requires `measureOverflow` to report it, and shortens a surface and requires `measureExtent` to
report the shortfall — so a measurement that could not fail is caught before 13a relies on it. The
document-level check is separate and deliberately refuses to measure `documentElement`, which reports no
overflow under `overflow: hidden`.

**The prototype's own gap was closed rather than carried:** in-thread search is reachable below 680px, where
`QA.md` L29 recorded the trigger as `display:none` with no replacement entry point.

**Three criteria are left open, and each is the criterion asking for something the build answers differently
or does not assert.** Criterion 14 forbids `overflow: hidden` on the frame; the frame sets it, because a grid
of internally-scrolling columns needs its own clip and removing it produced a document overflow at every
width. `no-frame-clip` still governs `html` and `body`, and a lifted-clip document test replaces the
property. Criterion 20 asks the stream panel to open inside the viewport; it is inline content, so only its
horizontal fit and its two true vertical claims are asserted. Criterion 23 asks that columns narrow before
anything else degrades — the CSS does, and no test compares a column's width across widths.
