# Product, UX & spec parity — review of the Relayboard app implementation

**Verdict:** do not ship
**Scope:** `apps/relayboard-web` at `c9304d6`: all 33 files under `src/components/**` (13 `.tsx`, 13 co-located `.css`, 7 `-*.ts` helpers), `src/styles.css`, the four route files, `src/routes/api/stream.ts`, all 23 files under `e2e/**` including the four helpers, and `src/client/{http,context}.ts` + `src/server/{permissions,stream}.ts` + `src/server/functions/{read,write}.ts` where a UI claim depends on them. Judged against `PRODUCT.md`, `DESIGN.md`, `spec.md` §User Stories (1–165), `.scratch/relayboard-app/parity-checklist.md` (all 64 lines), tickets 05/13a/13b/15a and `scripts/check-app-styles.mjs`.
**Method:** read in full — `PRODUCT.md`, `DESIGN.md`, `parity-checklist.md`, `spec.md` §User Stories and §Implementation Decisions/Testing, tickets 05, 13a, 13b, 15a; every component and its stylesheet; `styles.css`; `routes/index.tsx`, `routes/boards.$boardId.tsx`, `-conversation.ts`, `-thread-list.ts`, `-board-search.ts`; `e2e/parity.spec.ts` (1768 lines), `helpers/{parity,layout,style,workspace,fixtures}.ts`, `keyboard`, `geometry`, `stream`, `stream-panel`, `purge`, `gatekeeper`, `permissions`, `isolation`, `scaffold` specs; `client/http.ts`, `client/in-memory.ts` (read paths), `client/context.ts`, `server/permissions.ts`, `server/session.ts`, `server/stream.ts`, `server/functions/{read,write}.ts`, `server/store/index.ts` (purge/watermarks/connection) and `scripts/check-app-styles.mjs`. Commands run: `git log/show` and greps only; no gate run (Lead owns it). Targeted greps: `markRead`, `stream-error`, `focus-within`, `68ch|850px|780px|max-width`, `shadow-`, `field-focus-edge`, `aria-live|role="alert"`, `<main`, `errorComponent`, `data-session-permissions`, `board-rail__count`.

## Ranked findings

| # | Severity | Where | Finding |
| --- | --- | --- | --- |
| F1 | Critical | `StreamPanel.tsx:235` | The UI says entries stay in "durable history"; the store is in-memory and a restart clears it. |
| F2 | Critical | `PurgeDialog.tsx:213` | After a purge the dialog says "Your own work is untouched" — false exactly when the overlap it just counted is non-zero. |
| F3 | Critical | `server/functions/read.ts:97`, `store/index.ts:896` | `seen` is never advanced on the shipped HTTP path: `markRead` is called only by the in-memory client, so unread badges never clear. |
| F4 | High | `client/http.ts:453`, `-conversation-queries.ts:139` | `stream-error` is emitted on transport failure and consumed by nobody; the indicator keeps saying "Live". |
| F5 | High | `-keyboard.ts:81`, `keyboard.spec.ts:296` | Escape closes the rail drawer even when a modal dialog is open, and the test that claims the dialog case never opens a dialog. |
| F6 | High | `Conversation.tsx:281`, `parity.spec.ts:1274` | "Thread details … closes on Escape" is false (`<details>` ignores Escape), and the parity test whose name asserts it never presses Escape. |
| F7 | Medium | `boards.$boardId.tsx:190`, `SessionNote.tsx:58,71-73` | A failed grant read is collapsed to "you hold no permission", stated to the reader as fact, and disables every create and act control with a reason that may be untrue. |
| F8 | Medium | `styles.css` (absent), `Conversation.css` | `DESIGN.md` §195's 68ch measure and §207's 850px/780px caps are not implemented anywhere; the reading column is unbounded. |
| F9 | Medium | `Gatekeeper.css:12`, `ParticipantPanel.css:12` | The documented shadow vocabulary is entirely unused; two panels invent a green-tinted shadow off-token, and the dialogs get none. |
| F10 | Medium | `styles.css:86`, `DESIGN.md:50` | `DESIGN.md`'s `field-focus-edge` token is absent from the token block and §263/§264's focus-within edge shift is unimplemented. |
| F11 | Medium | `helpers/parity.ts:186,499` | Three of the 57 "covered" lines are covered by tests that assert something adjacent (17, 57) or only half the claim (50). |
| F12 | Medium | `routes/index.tsx:69-80`, `read.ts:76-79` | The empty workspace is a bare page with no rail and no way to create a board, and its copy promises a dialog that screen cannot reach; a board-less non-superadmin never sees it and falls through to the framework error page. |
| F13 | Medium | `e2e/**` (absent) | Three specified states have no route-seam assertion: board-not-found (story 7), restore-after-purge (story 164), and the badge clearing on read (story 146) — the last of which is also broken (F3). |
| F14 | Low | `Conversation.css:125`, `:181` | The agent chip and resource chip do not match `DESIGN.md` §251–252 (fills, ink, radius, size). |
| F15 | Low | `PurgeDialog.tsx:55-67` | Its Escape handler is registered once on mount, when the dialog is closed, so it never runs; the passing test credits native `<dialog>` behaviour to dead code. |
| F16 | Low | `WorkspaceFrame.tsx:124,150` | Dead scaffold-era placeholder copy ships in the frame. |

## F1 — The interface claims "durable history" over an in-memory store (Critical)

```tsx
// src/components/StreamPanel.tsx:233-241
	<p className="stream-panel__detail">
		{state.connected
			? "New events are delivered as they commit. Every entry stays in durable history."
			: pending === 0
				? "Nothing is waiting to replay. New posts are still committed to history."
```

The store is a single in-process object and says so: `PRODUCT.md:79` — "Not built, and deliberately: … **durable storage** (the store is in-memory and says so)"; `PRODUCT.md:101` principle 5 — "Never overclaim the mechanism." `spec L525` — "The store is in-memory and volatile … It does not survive a server restart." The same component's sibling surfaces say the true thing (`StoreLifetimeNote.tsx:18-21` "A restart clears it"; `PurgeDialog.tsx:169-172` "not a durability promise"), so the panel contradicts the frame around it.

Why it matters: "durable" is the product's own reserved word for the guarantee that was explicitly *not* built (`spec L29`: "Durability and replay are the contract"). A reader who believes this sentence will treat the workspace as storage. It is the one class of defect the product rules single out, and `e2e/stream-panel.spec.ts:342-360` asserts only the *simulation* note, not this one.

## F2 — "Your own work is untouched" is false in the case the purge is designed for (Critical)

```tsx
// src/components/PurgeDialog.tsx:210-215
{done === null ? null : (
	<div className="purge-done" data-purge-done>
		<p className="purge-done__line">
			Purged {done.boards} boards and {done.entries} entries. Your own
			work is untouched.
```

`Purged {done.entries} entries` is `ownEntriesOnDemoBoards`-inclusive: `store/index.ts:761-783` counts **every** entry on a demo board, and the same dialog's overlap line (`PurgeDialog.tsx:161-165`) warns that "N of your entries are in demo boards and will be removed with them". So when the reader has posted into demo content — the exact scenario `DESIGN.md` §291-297 and `spec L492` exist for — the completion sentence denies the removal it just performed, one click after warning about it.

Why it matters: `spec L492` requires the interaction to be "stated, not silently resolved". The confirmation states it; the receipt contradicts it. A reader who reads only the last screen is told their work survived a purge that deleted it.

## F3 — `seen` never advances on the shipped transport, so the unread model does not work (Critical)

The only caller of `markRead` in `src/**` is the **in-memory** client:

```ts
// src/client/in-memory.ts:206-212
readThread: async (threadId): Promise<ThreadContents> => {
	...
	// Reading is an act: it advances this principal's `seen` watermark and nothing
	// else, which is what makes the unread badge mean something.
	store.markRead(actingAs, threadId);
```

The HTTP read does not:

```ts
// src/server/functions/read.ts:97-106
export const readThread = createServerFn({ method: "GET" })
	.validator(threadInput)
	.handler(({ data }) => {
		const thread = store().readThread(data.threadId);
		...
		authorizeAs("readThread", { boardId: thread.boardId });
		return { thread, entries: store().readEntries(data.threadId) };
	});
```

`store.readThread` is `threadOf` (`store/index.ts:681-682, 847`) and `readEntries` is `entriesOf` (`:676-677, 848`) — neither touches a watermark. Grep confirms two occurrences of `markRead` in `src`: its declaration (`store/index.ts:318`), its body (`:896`), and that one in-memory call. `readMessages` deliberately does not mark read, which is correct; nothing else does either.

Consequences: opening a thread never moves `seen`, so `unreadOf` (`-thread-queries.ts:55-68`), `unreadInThread` (`-unread.ts:20-26`) and the rail badge (`BoardRail.tsx:83-88`) never fall. It contradicts `spec L502` ("`seen` … advanced only when that principal has actually read the thread"), story 3, story 146, ticket 03's decision recorded in `-conversation-queries.ts:19-35`, and the two component comments that describe the behaviour as live (`Conversation.tsx:47-53`, `-conversation-queries.ts:28-31`).

Why it matters and why the suite misses it: the parity line 38 test runs as `alex` and asserts *seeded* badge numbers (`parity.spec.ts:939-980`), never a badge falling after a read; `isolation.spec.ts:25-38` says "Read a thread, which advances this reader's `seen` watermark" and then only compares counts **across a reset**, which is equal either way. The claim is genuinely asserted only against the in-memory client (`tests/contract/operations.conformance.ts:772-792` run from `tests/client.test.ts:30-39`), and `tests/http-client.test.ts:24-31` states plainly that the HTTP client never runs that conformance suite. So the one behaviour the read model exists for is proven on the transport the product does not ship.

## F4 — A disconnected stream renders as "Live" (High)

```ts
// src/client/http.ts:441-456
source.addEventListener("error", () => {
	...
	handlers.onEvent({
		type: "stream-error",
		message: "The stream could not be reached",
	});
});
```

No surface consumes it. `-conversation-queries.ts:139-144` routes it to the default branch: "what this function must not do is pretend, so it does nothing and says so". `StreamPanel.tsx:151-190` handles only `connection-changed` and entry events, leaving `state.connected` untouched, so the indicator keeps rendering `"Live"` (`:225`) after the transport fails.

Against: `spec L518` — "a transport failure [must be reported] as a stream error, so the interface can show 'disconnected' rather than an empty thread"; story 50 — "told plainly when the stream is disconnected rather than shown a stale 'Live', so the indicator never lies"; parity line 11 — "it never reads 'Live' while disconnected" (marked `covered` at `helpers/parity.ts:137-143`, with no test that disconnects anything). `PRODUCT.md:89` makes the same promise: "Status language is honest by rule".

Why it matters: this is the failure the whole stream design is built against, and the emitted event exists precisely so a surface can report it. The type is there, the emitter is there, the consumer is not.

## F5 — Escape closes two layers, and the test claiming otherwise opens one (High)

```ts
// src/components/-keyboard.ts:81-89
if (event.key === "Escape" && options.railOpen()) {
	// **One layer per press.** A dialog is handled by the dialog itself; the drawer is the next
	// layer out, and this only acts when one is actually open.
	event.preventDefault();
	options.setRailOpen(false);
	options.railToggle()?.focus();
}
```

The guard the file documents at `:64-70` for `/` (`!dialogOpen()`) is **absent** from the Escape branch. With the drawer open and a create/purge dialog modal over it, one keypress reaches this handler as well as the dialog's own cancel path: the drawer closes and either the dialog's default close is suppressed by `preventDefault()` or the focus call is aimed at a control outside a modal (which browsers refuse), leaving the reader on the wrong layer.

The test named for this contract never creates the situation:

```ts
// e2e/keyboard.spec.ts:296-320
test("Escape closes the drawer with one press, and leaves nothing else closed", async ({ page }) => {
	// With the drawer open and a dialog on top, one press
	// closes the dialog and leaves the drawer; the next closes the drawer.
	await page.setViewportSize({ width: 980, height: 900 });
	await page.goto("/boards/platform?view=threads");
	await page.locator("[data-rail-toggle]").click();
	...
	await page.keyboard.press("Escape");
	await expect(page.locator(".workspace-frame__rail")).toHaveAttribute("data-open", "false");
```

No dialog is ever opened. The comment describes the intended case; the body asserts the trivial one. Ticket 13b:14 ("closes exactly one layer per press") is therefore asserted only for a single layer.

## F6 — Thread details do not close on Escape, and parity line 56's test says they do (High)

```tsx
// src/components/Conversation.tsx:280-303
{facts ? (
	<details className="conversation__details">
		<summary>Thread details</summary>
```

A native `<details>` has no Escape behaviour: once opened it stays open until the summary is activated. Parity line 56 claims otherwise — "the thread-details panel … closes on Escape. **Ticket:** 05:19, 13b:14" (`parity-checklist.md` line 56) — and the covering test's title asserts it while its body does not:

```ts
// e2e/parity.spec.ts:1274-1286
test("parity 56: thread details state the count and last position, and close on Escape", async ({ page }) => {
	...
	await summary.click();
	const facts = page.locator(".conversation__facts");
	await expect(facts).toBeVisible();
	await expect(facts).toContainText(/Entries/);
```

There is no `Escape`, no `keyboard.press`, and no closed assertion anywhere in those 13 lines — the title is the only place the claim appears, and `helpers/parity.ts:491-497` marks the line `covered` on the strength of that title. `ticket 05:19` went further and claimed "`<details>`, so 'dismissable from the keyboard' is the element's behaviour rather than a handler written to imitate it" — true of activation, not of Escape.

Why it matters: it is a test that would pass with the closing half deleted, which is the class of weakness this review was asked to hunt; and 13b:14's contract is therefore only two-thirds asserted.

## F7 — A failed permission read is presented as "you hold no permission" (Medium)

```tsx
// src/routes/boards.$boardId.tsx:189-190
const heldGrant = useQuery(heldGrantQuery(actingClient, board.id));
const heldPermissions = heldGrant.data ?? { onBoard: [], workspace: [] };
```

```tsx
// src/components/SessionNote.tsx:58,71-73
const onBoard: readonly PermissionName[] = grant.data?.onBoard ?? [];
...
{onBoard.length === 0
	? "You hold no permission on this board, so you can read it only as far as your session allows."
	: `On this board you may: ${onBoard.join(", ")}.`}
```

`primePane` deliberately swallows a refusal (`-thread-queries.ts:170-174`, `await ensureQueryData(...).catch(() => undefined)`), so an errored read is indistinguishable from an empty grant: `data` stays `undefined` and the note tells the reader, as fact, that they hold nothing. The same fallback disables every create and act control with "needs the `create:thread` permission" (`BoardPane.tsx:96-116`, `Conversation.tsx:371-379`).

Against `spec L639` and story 149: "the interface must [not] show an empty thread as if it were complete … so that a failure is never rendered as an absence." The participant panel does this correctly (`ParticipantPanel.tsx:82-103` branches on `.family` and states the refusal); the session note and the create row do not.

Reachability, stated honestly: `readHeldPermissions` is the one operation whose requirement is `none` (`client/index.ts:577-579`), and its handler never throws for a missing board (`read.ts:198-210` reads `grantsFor` and answers) — so this needs a transport failure or a thrown handler rather than a permission denial. It is latent rather than routinely hit, but the failure mode is the exact inversion the honesty rule forbids, and the same `?? []` fallback appears three times (`boards.$boardId.tsx:190`, `SessionNote.tsx:58`, `BoardPane.tsx:190`), so any future failure lands on all three at once.

## F8 — The reading measure has no cap, contrary to DESIGN.md §195/§207 (Medium)

`DESIGN.md:195`: "**Body** (400, 13px, 1.75, **max 68ch**) … 68ch is the cap; the measure is the reading experience." `DESIGN.md:207`: "The entry list maxes at **850px** and centres; the composer maxes at **780px**." `DESIGN.md:192` also asks for `text-wrap: balance` on Display.

None of the four exists. Greps over `src` for `68ch`, `850px`, `780px`, `max-width` and `text-wrap|balance` return **zero** matches. `.conversation__list` (`Conversation.css:48-55`) and `.conversation__composer` (`:235-245`) are full-bleed flex children of a column that is `minmax(0, 1fr)`: at 1440px the conversation column is ~864px wide, already past the 850px cap, and on any wider display the 13px body runs the full width with no measure control.

Why it matters: `DESIGN.md` is normative (`spec L629`, `AGENTS.md`), and the type scale is the system's stated legibility argument. Nothing in `check:styles` or the e2e suite measures a maximum width, so this cannot fail the gate.

## F9 — The shadow vocabulary is unused, and a component invents one (Medium)

`styles.css:128-132` declares all five documented shadows (`--shadow-float/popover/drawer/toast/rest`). Grep finds **no consumer** — the tokens are dead. Meanwhile:

```css
/* src/components/Gatekeeper.css:12 — and identically ParticipantPanel.css:12 */
box-shadow: -8px 0 24px var(--color-surface-tint);
```

`DESIGN.md:220` defines the drawer shadow as `-16px 0 45px rgba(12, 24, 20, 0.1)` and `DESIGN.md:225` (Neutral Shadow Rule) requires "every shadow is neutral black-green with an offset and a real blur". `#f5f8f5` is a near-white green-grey surface tint, not the neutral; the offset/blur pair is a third value nothing documents. The one surface `DESIGN.md:215` says shadows exist for — "layers that genuinely float above the page and can be dismissed" — is also the one that gets none: `.create-dialog` (`CreateDialog.css:5-13`) and `.purge-dialog` (`PurgeDialog.css:26-33`) set a border and no elevation at all, so the purge dialog ("the one surface allowed to be heavier", `DESIGN.md:291-292`) is visually flat.

Why the linter misses it: `scripts/check-app-styles.mjs:37-38` only rejects colour *literals*; a token used as a shadow is invisible to it, which is exactly "what it cannot see" that this check was asked to cover. It also violates the styling boundary rule `spec L271`: "It may not re-implement a token value."

## F10 — A DESIGN.md token is missing and the field-focus rule is unimplemented (Medium)

`DESIGN.md:50-54` declares a token and its purpose: "**`field-focus-edge`: #7fb79c** — the 1px edge that shifts under [the ring] (§237, §238). Declared here because two sidecar snippets carried the literal and DESIGN.md named nothing, which made it a colour outside the token block the app forbids."

`styles.css:86-88` declares only `--color-focus` and `--color-focus-on-rail`. Grep for `field-focus-edge` over `src` returns **zero**. Grep for `:focus-within` returns **zero**, so neither `DESIGN.md:263` ("Focus: the edge shifts to Focus Ring … and a 2px outline") nor `DESIGN.md:264` ("Composer: … focus-within changes only the edge color") is implemented: fields get the global outline (`styles.css:162-165`) and no edge shift.

Against `spec L264`: "the token names preserved verbatim … Keeping the names means a diff between `DESIGN.md` and the stylesheet is readable." A token the document names and the stylesheet lacks is the drift the token block exists to prevent, and `check:styles` cannot detect a *missing* token.

## F11 — "57 of 64 covered" is optimistic (Medium)

`helpers/parity.ts` reports 57 `covered`, 3 `covered-elsewhere`, 2 `not-carried`, 2 `blocked-by-the-app`. Three of the 57 assert something other than the line:

- **Line 17** — the line is "Escape closes the **stream panel** and focus returns to the control that opened it" (`parity-checklist.md` line 17 → `helpers/parity.ts:186-193`). The covering test opens the **participant** panel (`parity.spec.ts:426-438`) and the file states in the test body that the stream panel "is not a panel — 11b built it into the conversation column". The substitution is honest in prose and dishonest in the status field: the line as written is not met.
- **Line 57** — "activating **an entry's author** opens that principal's panel, showing the fingerprint this workspace derived" (`helpers/parity.ts:499-505`). The test asserts the People view opens a panel and that `[data-participant-derived]` is `"none"` and no fingerprint element exists (`parity.spec.ts:1288-1319`). That is the *inverse* of the line's second half, and the author is a `<span>`, not an activation (`Conversation.tsx:746`). Again documented in prose, mislabelled in data.
- **Line 50** — "at every width, the stream panel opens fully inside the viewport"; the test asserts the horizontal box only (`parity.spec.ts:1157-1176`) and its own name says "horizontally". The vertical half is covered by the `blocked-by-the-app` note on line 51, not by line 50.
- **Line 17's focus half** — `await expect(opener).toBeFocused()` (`parity.spec.ts:438`) cannot fail: the test focuses the opener at `:429`, the opener never loses focus (the participant panel is not modal and takes none), and `PeopleView`'s Escape handler only calls `setOpenId(null)` (`BoardPane.tsx:354-361`) with **no focus restoration** anywhere. So the assertion proves the browser left focus where it was, not that closing returned it.

Why it matters: 15a:13 exists so a reviewer can count coverage instead of judging it. Counting is only honest if the status means what the file's own legend says (`helpers/parity.ts:15`: "`covered` — a test in this suite asserts it"). For these three, it does not.

## F12 — The empty workspace is a dead end, and its copy names an unreachable control (Medium)

```tsx
// src/routes/index.tsx:69-80
function EmptyWorkspace() {
	return (
		<main className="grid min-h-dvh place-items-center px-xxl py-xxl">
			<div className="flex max-w-[46ch] flex-col items-center gap-lg text-center">
				<h1 className="m-0 text-display text-ink-strong">No boards yet</h1>
				<p className="m-0 text-body text-ink-muted">
					This workspace has no boards. Creating one arrives with the board
					dialog.
				</p>
			</div>
		</main>
	);
}
```

Two defects in one state.

**It is a dead end.** `EmptyWorkspace` renders a bare `<main>` — no `WorkspaceFrame`, therefore no rail, no pane, and no `CreateAction` (the only board-creating control, rendered by `BoardPane.tsx:110-115` inside the frame). Its copy names a control the reader cannot reach from this screen: "Creating one arrives with the board dialog" is true of the app and false of the page it is printed on. Compare `DESIGN.md:248` (Stated Reason Rule) and `spec L544`'s requirement that a hand-edited or stale location must not "produce a broken screen": this is a screen with no action on it.

**Who reaches it at all is uneven.** A superadmin (`nadia`, workspace `read:board`) reaches the route and gets `[]` — `read.ts:72-79` filters by board and, for the workspace grant, `listBoards` returns the empty filtered list, so `EmptyWorkspace` renders. A principal with no `read:board` anywhere hits the explicit refusal at `read.ts:76-79` (`if (visible.length === 0) authorizeAs("listBoards")`) *before* the route can decide there are no boards, and there is no `errorComponent` anywhere in `src` (grep: one hit, `notFoundComponent` at `boards.$boardId.tsx:162`), so that reader lands on the framework's default error page rather than a stated refusal. `spec L546` requires a not-found state "inside the app frame, not … a framework error page"; there is no equivalent for a refused workspace.

## F13 — Three specified states have no route-seam assertion (Medium)

- **Board not found** (story 7, `spec L546`): `BoardNotFound` is implemented (`boards.$boardId.tsx:390-407`) and renders "This workspace has no board with that address … It may have been removed" — but `grep 'Board not found'` over `e2e` returns **zero**. Line 5 of the parity checklist covers the prototype's storage key, not this.
- **Restore after a purge** (story 164, `ticket 14:16`): `PurgeDialog.tsx:216-223` renders "Restore demo content", reachable only in the same view as the purge (the `done` state is component-local, `:37`), so a reload loses the affordance. No e2e presses `[data-purge-restore]` (grep: zero); the behaviour is asserted only at the store seam (`tests/purge.test.ts:147-160`).
- **The badge clearing on read** (story 146): no e2e asserts a count falling after opening a thread — which is how F3 stayed green.

## F14 — Agent and resource chips drift from DESIGN.md §251–252 (Low)

`DESIGN.md:251`: agent chip "`#ebf5ee` fill, `#2c6b4e` text, 11px, **4px radius**, uppercase". `Conversation.css:125-134`: `background: var(--color-surface-tint)` (`#f5f8f5`), `color: var(--color-ink-muted)`, `border-radius: var(--radius-sm)` (7px). The frontmatter agrees with the prose (`DESIGN.md:129-133` `agent-chip` = `#ebf5ee`/`#2c6b4e`/xs).
`DESIGN.md:252`: resource chip "`#f5f8f5` fill with a `#e6ece6` edge, **12px**, `#3f6b54` text" with a leading file glyph and a trailing external-link glyph. `Conversation.css:181-190`: fill ok, edge `--color-line`, `font-size: var(--text-label)` (11px), ink-body text, **no glyphs**. `BoardPane.css:136-145` renders the resource type as an 11px chip where §252 asks for 12px.

Bounded, because the chips are still legible and the agent marking still exists — but `DESIGN.md` is normative and `e2e/acts.spec.ts:109-165` only asserts "no accent anywhere", not the documented treatment.

## F15 — The purge dialog's Escape handler can never run, and the test that credits it (Low)

```tsx
// src/components/PurgeDialog.tsx:54-67
// Escape closes and returns focus to the control that opened it (14:22, 13b's standard).
useEffect(() => {
	if (!dialog.current?.open) return;
	const onKey = (event: KeyboardEvent) => {
		if (event.key !== "Escape") return;
		event.preventDefault();
		dialog.current?.close();
		opener.current?.focus();
	};
	window.addEventListener("keydown", onKey);
	return () => window.removeEventListener("keydown", onKey);
}, []);
```

The dependency list is `[]`, so the effect runs once on mount — when the dialog is closed — and the early `if (!dialog.current?.open) return` exits before the listener is ever added. Nothing re-runs it when `showModal()` is called at `:115`. The handler is dead.

`e2e/purge.spec.ts:75-107` still passes, because a native `showModal()` dialog closes on Escape and restores focus to the invoker by itself. So the behaviour is right and the code that claims to produce it does nothing — which is precisely the "comment claims a mechanism, the mechanism is absent" pattern this review was asked to find. It also means the "exactly one layer" intent in the comment is unenforced: if a second Escape listener were ever added (the rail drawer's, `-keyboard.ts:81`), nothing here would suppress it.

## F16 — Dead scaffold-era copy ships in the frame (Low)

```tsx
// src/components/WorkspaceFrame.tsx:124-128
{pane ?? (
	<p className="workspace-frame__placeholder">
		The thread list lands here next.
	</p>
)}
// :149-153
{conversation ?? (
	<p className="workspace-frame__placeholder">
		Select a thread and its entries will appear here.
	</p>
)}
```

Both values are unreachable today (every caller passes `pane`, and `BoardNotFound` does too), so this is latent rather than user-visible — but "lands here next" is the 04a interim's promise, not product copy, and `PRODUCT.md:101`'s rule about not overclaiming applies to shipped strings that could become visible on the next refactor.

## What I checked and found sound

- **Single light world, no dark-mode residue.** No `prefers-color-scheme`, `data-theme`, `ThemeToggle` or theme script anywhere in `src` (grep, 0 hits); `__root.tsx` has no pre-paint theme script and `html` carries no attribute; `styles.css `@theme static`` is the only colour source.
- **Self-hosted type.** `styles.css:6-15` declares one `@font-face` with `font-weight: 100 700`, `font-display: swap` and the latin `unicode-range` `DESIGN.md:185` specifies; the asset exists at `public/fonts/ibm-plex-sans-latin.woff2` (45,712 bytes); `__root.tsx` references no external stylesheet; `parity.spec.ts:1705-1740` asserts the computed family is not a generic fallback and that no non-localhost request is made.
- **Token discipline where it is checkable.** No colour literal outside the `@theme` block in any `.css`/`.ts`/`.tsx` under `src` (the gate is green and the grep agrees); layout uses Tailwind utilities with co-located anatomy sheets in the 15 components that have them, and `WorkspaceFrame.css:13-18` names the two-value grid the split asks for.
- **Responsive geometry and the drawer.** `WorkspaceFrame.css:23-27` narrows 240/336 → 208/304 at 1200; `:29-65` makes the rail a fixed off-canvas drawer at 980 with `visibility: hidden` (so its links leave the tab order) and a scrim; `:166-179` makes the pane and conversation two levels at 680 with `display: none`, and `geometry.spec.ts:206-243` asserts the `display` property rather than visibility (the vacuity the ticket records), plus the back control and the unchanged URL. `geometry.spec.ts:96-147` measures per scroll container **and** the document with the clip lifted.
- **Keyboard shortcuts and the typing guard.** `-keyboard.ts:42-44,64-79` keeps the prototype's `INPUT`/`TEXTAREA` guard for `/`, treats `Ctrl/Cmd+K` as the unguarded escape hatch (matching `app.js` L222), and guards both on `dialog[open]`; `keyboard.spec.ts:17-62` asserts both directions and the dialog case with real focus.
- **Dialog focus contract.** `CreateDialog.tsx:36-41,176-189` uses a native `showModal()` `<dialog>` with `noValidate` so the app's validator (not Chrome's) refuses; `keyboard.spec.ts:263-294` asserts focus enters, is trapped across eight Tabs, and returns to the opener on Escape. `PurgeDialog.tsx:55-67` does the same explicitly and `purge.spec.ts:75-107` asserts it.
- **Owner-versus-declared separation.** `ParticipantPanel.tsx:153-189` renders "Derived" and "Declared" under separate headings with captions ("Computed by this workspace…" / "What this participant says about itself. Not verified."), no accent and no checkmark; `Gatekeeper.tsx:267-280` labels the knock block "Declared" and states "Nothing about this agent has been verified yet". `gatekeeper.spec.ts:205-252` measures the declared label's computed background against `--color-accent-chip-bg`.
- **Authorship-is-not-authority copy.** `ParticipantPanel.tsx:231-239` states it; `Conversation.tsx:564-571,804-815` renders "acknowledged up to #n" with no approving verb; `types.ts:254-269` carries no verdict field. `acts.spec.ts:109-165` asserts the absence of accent in an acknowledgement.
- **Empty versus zero-result versus caught-up.** `-thread-list.ts:108-128` distinguishes all three with distinct copy, and `parity.spec.ts:910-923` asserts the zero-result state is *not* the empty board's words. `conversationEmptyState` (`-conversation.ts:113-134`) distinguishes "no match" from "no messages yet"; `parity.spec.ts:1325-1348` exercises both branches.
- **Withheld-not-lost while paused.** `-conversation-queries.ts:177-190` applies the store's `readView` rule (`store/index.ts:863-868`) and `StreamPanel.tsx:194-211` derives the pending count from the server rather than counting locally; `stream-panel.spec.ts:77-153` and `parity.spec.ts:385-413` assert the entry is in history and absent from a paused view, then appears on resume.
- **Purge confirmation order and tone.** `PurgeDialog.tsx:136-172` states remove → keep → overlap in that order, uses only the paused amber pair for a non-zero overlap (`PurgeDialog.css:75-82`), never red, and names the action on the confirm button.
- **Reduced motion and focus rings.** `styles.css:176-185` suppresses transitions/animations under `prefers-reduced-motion`; `styles.css:162-165` gives one 2px/1px-offset outline and `BoardRail.css:72-75` overrides it for the dark rail with `--color-focus-on-rail`; `keyboard.spec.ts:188-259` asserts the computed outline geometry and that the rail's colour is not the page's.
- **No starter chrome.** `scaffold.spec.ts:12-69` asserts the title, the absence of a document-level header/footer, and that `/about` and `/demo/tanstack-query` render no starter content. Verified in `__root.tsx`: no header, footer, devtools or about link.

## Not checked

- The rendered result in a real browser: I did not run `e2e`, `npm test` or the build (the Lead owns the gate), so every claim above is from source and the specs' own text, not from a run.
- Contrast and computed type floors: asserted by `parity.spec.ts:1590-1663` and `geometry.spec.ts:268-350`; I read those assertions but did not re-measure.
- Whether the shipped `ibm-plex-sans-latin.woff2` is byte-identical to the prototype's copy (the spec's claim at L258).
- Real screen-reader behaviour (the suite's own honesty note at `parity.spec.ts:44-50` covers this); I verified only the markup affordances.
- Locale/timezone drift in rendering: `EntryItem` formats with `toLocaleTimeString([], …)` (`Conversation.tsx:749-753`) and the intro with `toLocaleDateString([], …)` (`:269-277`), which resolves against the server's locale during SSR and the reader's after hydration. I could not measure whether this produces a hydration mismatch without a browser; it is a risk, not a confirmed defect, and is not counted in the table.
- `src/server/admissions.ts`, `grants.ts`, `credential.ts`, the store's write half beyond purge/watermarks/connection, and the admission state machine — the security reviewer's domain.
- The 30 tickets' acceptance criteria other than 05, 13a, 13b and 15a; and `.scratch/relayboard-app/reviews/{lead-dev,pm}-review.md`, which I did not read in full.
- `.impeccable/design.json` (the sidecar) — not read, so I did not cross-check the tokens against it beyond what `DESIGN.md` states in prose.