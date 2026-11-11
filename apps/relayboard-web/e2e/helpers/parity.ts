/**
 * The parity checklist, as data.
 *
 * ## Why this is a file rather than a comment in the spec
 *
 * 15a:13 requires that "covers every behaviour" be countable by a reviewer rather than judged, and
 * 15a:15 requires that every scenario in the suite cite `.scratch/relayboard-app/parity-checklist.md`
 * line numbers rather than restating the claim. So the 64 lines live here as data: the suite's test
 * titles name their number, and a test in `parity.spec.ts` checks that these three sets agree — the
 * 64 numbers, the entries marked covered, and the tests that exist. A behaviour the suite skips is
 * therefore a line a reviewer can see, not a shorter list written to fit the suite.
 *
 * ## The four statuses
 *
 * - **covered** — a test in this suite asserts it, and `test` names that test's title verbatim.
 * - **covered-elsewhere** — asserted, but at another seam that already owns it: a `C` (contract) half
 *   of a line whose rendered half is asserted here, or one of 06c's error-family tests. The reason
 *   names the file. 15a:18 forbids this suite reaching into internals, so a line that needs the
 *   client interface driven directly is covered where that is allowed and cited here.
 * - **not-carried** — the checklist says so: lines 5 and 32, with the checklist's own reason.
 * - **blocked-by-the-app** — the line cannot be met as written because a later ticket built the
 *   surface differently in a way the Lead approved. **This is a finding, not an excuse**: each one
 *   names the ticket whose decision made it unmeetable, so a reviewer can disagree with that
 *   decision instead of having to reconstruct it.
 *
 * The checklist file itself is not edited to fit this suite. Where a line cannot be met, this file
 * says so and this suite does not pretend otherwise.
 */

/** How a checklist line is satisfied, or why it is not. */
export type ParityStatus =
	| "covered"
	| "covered-elsewhere"
	| "not-carried"
	| "blocked-by-the-app";

/** One line of `.scratch/relayboard-app/parity-checklist.md`. */
export interface ParityLine {
	/** The checklist's own assertion number, 1-64. "Line N" in the checklist means this. */
	readonly n: number;
	/** The scenario the line belongs to, as the checklist groups them. */
	readonly scenario: string;
	/** The checklist's rewritten claim, shortened to what is asserted. */
	readonly claim: string;
	readonly status: ParityStatus;
	/**
	 * The test title that asserts it, for `covered`. It must match a test in `parity.spec.ts` **exactly**,
	 * because a title that drifts would otherwise let the coverage check pass on a test that no longer
	 * exists — the same class of failure as a harness that skips silently.
	 */
	readonly test?: string;
	/** Why it is not `covered`, for the other three statuses. Never optional. */
	readonly reason?: string;
}

export const PARITY_LINES: readonly ParityLine[] = [
	{
		n: 1,
		scenario: "S1",
		claim:
			"the seeded thread's URL renders that thread as the open one, and the address names it",
		status: "covered",
		test: "parity 1: the address names the open thread, and the title is that thread's",
	},
	{
		n: 2,
		scenario: "S1",
		claim: "the open thread renders 9 entries, each with its own seq",
		status: "covered",
		test: "parity 2: the open thread renders nine entries, each with its own position",
	},
	{
		n: 3,
		scenario: "S1",
		claim:
			"the rendered entries carry #1 through #9 in order, with no number missing and none repeated",
		status: "covered",
		test: "parity 3: the rendered positions are gapless and in order",
	},
	{
		n: 4,
		scenario: "S1",
		claim:
			"the intro states how many entries the thread holds, and the number matches the entries rendered",
		status: "covered",
		test: "parity 4: the stated entry count matches the entries rendered",
	},
	{
		n: 5,
		scenario: "S1",
		claim: "the state is seeded under relayboard-demo-v3",
		status: "not-carried",
		reason:
			"The app has no localStorage store (spec L505 leaves localStorage holding only a remembered location). Its equivalents are that the workspace opens with the demo seed (02c) and that the store is in-memory for the process (06a:16); asserting a storage key would assert the prototype's mechanism rather than the product's behaviour.",
	},
	{
		n: 6,
		scenario: "S2",
		claim:
			"posting renders exactly one new entry, and the thread's rendered count rises by exactly one",
		status: "covered",
		test: "parity 6: posting renders exactly one new entry and the count rises by one",
	},
	{
		n: 7,
		scenario: "S2",
		claim:
			"the new entry renders the next position after the last, not a re-used or skipped one",
		status: "covered",
		test: "parity 7: the new entry takes the next position",
	},
	{
		n: 8,
		scenario: "S2",
		claim:
			"after a successful send the composer is empty and again shows the disabled Send control",
		status: "covered",
		test: "parity 8: a successful send clears the composer and disables Send",
	},
	{
		n: 9,
		scenario: "S2",
		claim:
			"the Send control is disabled with an empty composer and enabled once it holds non-whitespace text",
		status: "covered",
		test: "parity 9: Send is disabled while the composer is empty or whitespace",
	},
	{
		n: 10,
		scenario: "S2",
		claim:
			"the entry that renders carries exactly the text typed, after the trim",
		status: "covered",
		test: "parity 10: the committed text is the typed text, trimmed",
	},
	{
		n: 11,
		scenario: "S3",
		claim:
			"with the stream connected the indicator reads its connected word and offers the pause affordance",
		status: "covered",
		test: "parity 11: the indicator starts connected and offers the pause affordance",
	},
	{
		n: 12,
		scenario: "S3",
		claim:
			"pausing changes the indicator to its paused word with the pending count, and offers the resume control",
		status: "covered",
		test: "parity 12: pausing flips the indicator and offers the resume control",
	},
	{
		n: 13,
		scenario: "S3",
		claim:
			"after one entry commits while paused, the indicator's count reads 1, derived from the cursor",
		status: "covered",
		test: "parity 13: one entry committed while paused reads as a pending count of one",
	},
	{
		n: 14,
		scenario: "S3",
		claim:
			"the entry is in the thread's history and not in the paused reader's view, and the cursor has not advanced past it",
		status: "covered-elsewhere",
		reason:
			"The store half — that the reader's cursor has not advanced — is asserted in `tests/contract/stream.conformance.ts`, where the client is driven directly and a pause's effect on a watermark is observable. This suite asserts the rendered half: the entry is committed and not rendered. 15a:18 forbids reaching the store from here.",
	},
	{
		n: 15,
		scenario: "S3",
		claim:
			"resuming renders the withheld entry and returns the indicator to its connected state",
		status: "covered",
		test: "parity 15: resuming renders the withheld entry and returns the indicator to connected",
	},
	{
		n: 16,
		scenario: "S3",
		claim:
			"after the replay the reader's cursor equals the thread's latest position, and it got there by replaying",
		status: "covered-elsewhere",
		reason:
			"A cursor value is not a rendered observable. `tests/contract/stream.conformance.ts` asserts the cursor reaches the last seq through a resume; this suite asserts the rendered count that follows from it (line 15).",
	},
	{
		n: 17,
		scenario: "S3",
		claim:
			"Escape closes the stream panel and focus returns to the control that opened it",
		status: "covered",
		test: "parity 17: a panel opened by a control is closed by Escape, and focus returns to that control",
	},
	{
		n: 18,
		scenario: "S4",
		claim:
			"creating a board adds a rail row, opens it, and the board's view renders its empty state",
		status: "covered",
		test: "parity 18: creating a board adds a rail row, opens it and shows its empty state",
	},
	{
		n: 19,
		scenario: "S4",
		claim:
			"a board with no threads renders an empty state that names the next action",
		status: "covered",
		test: "parity 19: an empty board's empty state names the next action",
	},
	{
		n: 20,
		scenario: "S4",
		claim:
			"the new thread appears as one row in that board, and opening it shows it holds no entries",
		status: "covered",
		test: "parity 20: a new thread is one row, and opening it shows it holds no entries",
	},
	{
		n: 21,
		scenario: "S4",
		claim:
			"the first entry in a new thread renders #1, and the thread's stated count becomes one",
		status: "covered",
		test: "parity 21: the first entry in a new thread is position 1 and the stated count is one",
	},
	{
		n: 22,
		scenario: "S4",
		claim:
			"the board, its thread and the entry are all still there after a reload, and the open thread is still open",
		status: "covered",
		test: "parity 22: the board, thread and entry survive a reload with the thread still open",
	},
	{
		n: 23,
		scenario: "S5",
		claim:
			"the resources view lists the board's seeded resources, each with its name and URL",
		status: "covered",
		test: "parity 23: the resources view lists the board's seeded resources with names and URLs",
	},
	{
		n: 24,
		scenario: "S5",
		claim:
			"adding a valid HTTP(S) resource renders one more row holding that URL, and it is still there when re-read",
		status: "covered",
		test: "parity 24: adding a resource renders one more row and it survives a re-read",
	},
	{
		n: 25,
		scenario: "S5",
		claim:
			"a non-HTTP(S) URL is refused with a reason the reader can act on, nothing is added, and the surface stays open",
		status: "covered",
		test: "parity 25: a non-HTTP URL is refused with a reason and nothing is added",
	},
	{
		n: 26,
		scenario: "S5",
		claim:
			"a malformed URL is refused by the app's own validator, with a message the reader can act on, before anything is stored",
		status: "covered",
		test: "parity 26: a malformed URL is refused by the app's own validator",
	},
	{
		n: 27,
		scenario: "S5",
		claim:
			"a resource referenced inside a thread renders as a link that opens in a new context without handing over the session",
		status: "covered",
		test: "parity 27: a resource referenced in a thread renders a safe external link",
	},
	{
		n: 28,
		scenario: "S6",
		claim:
			"a board URL with no view parameter renders the thread list, and the active view is marked as selected",
		status: "covered",
		test: "parity 28: a board URL with no view parameter renders threads, marked selected",
	},
	{
		n: 29,
		scenario: "S6",
		claim:
			"switching to the resources view renders that board's resources and marks that view selected",
		status: "covered",
		test: "parity 29: the resources view renders resources and marks itself selected",
	},
	{
		n: 30,
		scenario: "S6",
		claim:
			"the people view lists the board's participants, and the view selection is marked",
		status: "covered",
		test: "parity 30: the people view lists participants and marks itself selected",
	},
	{
		n: 31,
		scenario: "S6",
		claim:
			"moving between the three views and back renders the same thread list, unchanged",
		status: "covered",
		test: "parity 31: returning to threads renders the same list",
	},
	{
		n: 32,
		scenario: "S6",
		claim: "People rows are full-width with a pointer cursor",
		status: "not-carried",
		reason:
			"This measures the prototype's own stylesheet against a fixed 335px column. Nothing in DESIGN.md requires a People row to be full-width or to keep a pointer cursor, and the app's column widths are not the prototype's. The behavioural parts are on lines 30, 33 and 34, which are asserted.",
	},
	{
		n: 33,
		scenario: "S6",
		claim:
			"activating a person row opens the participant panel for that principal",
		status: "covered",
		test: "parity 33: activating a person row opens that principal's panel",
	},
	{
		n: 34,
		scenario: "S6",
		claim: "the row exposes a single activation that opens the panel",
		status: "covered",
		test: "parity 34: the row exposes a single activation rather than two affordances",
	},
	{
		n: 35,
		scenario: "S7",
		claim:
			"entering a term that appears in a thread's title or latest entry narrows the list to the matching threads",
		status: "covered",
		test: "parity 35: a search term narrows the list to the matching threads",
	},
	{
		n: 36,
		scenario: "S7",
		claim:
			"a term matching nothing renders a zero-result state distinguishable from an empty board",
		status: "covered",
		test: "parity 36: a zero-result state is distinguishable from an empty board",
	},
	{
		n: 37,
		scenario: "S7",
		claim: "clearing the search renders every thread in the board again",
		status: "covered",
		test: "parity 37: clearing the search restores every thread",
	},
	{
		n: 38,
		scenario: "S7",
		claim:
			"the unread filter narrows to threads whose seen watermark trails the latest seq, exposes its pressed state, and clears",
		status: "covered",
		test: "parity 38: the unread filter narrows from the seen watermark and exposes its pressed state",
	},
	{
		n: 39,
		scenario: "S8",
		claim: "pressing / outside a text field moves focus into thread search",
		status: "covered",
		test: "parity 39: / focuses thread search",
	},
	{
		n: 40,
		scenario: "S8",
		claim: "Ctrl+K moves focus into thread search",
		status: "covered",
		test: "parity 40: Ctrl+K focuses thread search",
	},
	{
		n: 41,
		scenario: "S8",
		claim: "the platform's command key with K moves focus into thread search",
		status: "covered",
		test: "parity 41: the command key with K focuses thread search",
	},
	{
		n: 42,
		scenario: "S8",
		claim:
			"a / typed into the composer is entered as text; focus stays and the draft is unchanged",
		status: "covered",
		test: "parity 42: a slash typed in the composer stays text and keeps the draft",
	},
	{
		n: 43,
		scenario: "S8",
		claim: "Ctrl+Enter posts the draft and the entry renders",
		status: "covered",
		test: "parity 43: Ctrl+Enter posts the draft",
	},
	{
		n: 44,
		scenario: "S8",
		claim: "the platform's command key with Enter posts the draft",
		status: "covered",
		test: "parity 44: the command key with Enter posts the draft",
	},
	{
		n: 45,
		scenario: "S9",
		claim:
			"at 1440, each visible scroll container satisfies scrollWidth <= clientWidth + 1",
		status: "covered",
		test: "parity 45: at 1440 no column overflows in the thread view",
	},
	{
		n: 46,
		scenario: "S9",
		claim:
			"the same per-container measurement in People, Resources and the stream dialog, plus the dialog fitting the viewport",
		status: "covered",
		test: "parity 46: at 1440 no column overflows in People, Resources or the stream panel",
	},
	{
		n: 47,
		scenario: "S9",
		claim:
			"at 390, the thread list's own scroll container satisfies scrollWidth <= clientWidth + 1",
		status: "covered",
		test: "parity 47: at 390 the thread list does not overflow",
	},
	{
		n: 48,
		scenario: "S9",
		claim:
			"at 390, the conversation's own scroll container satisfies the same bound",
		status: "covered",
		test: "parity 48: at 390 the conversation does not overflow",
	},
	{
		n: 49,
		scenario: "S9",
		claim:
			"at 390, the board rail as an overlay drawer and the resources view each satisfy the same bound",
		status: "covered",
		test: "parity 49: at 390 the rail as a drawer and the resources view do not overflow",
	},
	{
		n: 50,
		scenario: "S9",
		claim: "at every width, the stream panel opens fully inside the viewport",
		status: "covered",
		test: "parity 50: the stream panel fits inside the viewport at every width, horizontally",
	},
	{
		n: 51,
		scenario: "S12",
		claim: "the panel's rect is inside the viewport at each of the six widths",
		status: "blocked-by-the-app",
		reason:
			"PARTIALLY MET, and 13a's narrowing is the reason. The stream panel is inline content in the conversation column (11b's decision), not an overlay, so it has no viewport-fitting vertical claim to make: it scrolls with its column. 13a's report flagged this and the Lead approved the narrowing. What is asserted is the horizontal fit at every width (line 50) plus, below, the vertical claim that is true — the panel's top edge is below the indicator and it never overlaps the composer.",
	},
	{
		n: 52,
		scenario: "S12",
		claim:
			"the panel is anchored to the right edge with a 25px gap on desktop and 10px at 680px or below",
		status: "blocked-by-the-app",
		reason:
			"The app has no anchored panel, so there is no gap to measure: 11b built the stream state into the conversation column, above the composer, rather than as the prototype's floating dialog. Wrapping it in a fixed-position box to satisfy a geometry assertion would be building the prototype's chrome rather than the product. The behavioural claims in this group (below the indicator, clear of the composer, operable) are asserted on the panel's real geometry.",
	},
	{
		n: 53,
		scenario: "S12",
		claim: "the panel's top edge is below the indicator and does not cover it",
		status: "covered",
		test: "parity 53: the stream panel sits below the connection indicator and does not cover it",
	},
	{
		n: 54,
		scenario: "S12",
		claim:
			"the panel's rect and the composer's rect do not intersect at any width",
		status: "covered",
		test: "parity 54: the stream panel never overlaps the composer at any width",
	},
	{
		n: 55,
		scenario: "S12",
		claim:
			"the panel's controls are operable while it is open, and closing it returns focus to the control that opened it",
		status: "covered",
		test: "parity 55: the stream panel's controls are operable and Escape returns focus",
	},
	{
		n: 56,
		scenario: "S11",
		claim:
			"the thread-details panel states the entry count and the last sequence, and closes on Escape",
		status: "covered",
		test: "parity 56: thread details state the count and last position, and close on Escape",
	},
	{
		n: 57,
		scenario: "S11",
		claim:
			"activating an entry's author opens that principal's panel, showing the fingerprint this workspace derived",
		status: "covered",
		test: "parity 57: a participant's panel states what this workspace derived, and says when it derived nothing",
	},
	{
		n: 58,
		scenario: "S11",
		claim:
			"searching within the open thread narrows its entries, renders a zero-match state, and closing restores the full list",
		status: "covered",
		test: "parity 58: in-thread search narrows, shows zero matches, and restores",
	},
	{
		n: 59,
		scenario: "S11",
		claim:
			"submitting the same draft twice while the first is in flight appends one entry, and retrying a committed post with its original key appends nothing",
		status: "covered-elsewhere",
		reason:
			"The idempotency key is not a rendered observable, so the contract seam owns it (05:26, in `tests/contract/operations.conformance.ts`). This suite asserts what a reader sees: a rapid double activation appends one entry.",
	},
	{
		n: 60,
		scenario: "S11",
		claim: "at 390 the composer is reachable and a post from it renders",
		status: "covered",
		test: "parity 60: sending works from the 390px composer",
	},
	{
		n: 61,
		scenario: "S11",
		claim:
			"in-thread search is reachable at every width, including below 680px",
		status: "covered",
		test: "parity 61: in-thread search is reachable below 680px, closing the prototype's gap",
	},
	{
		n: 62,
		scenario: "S11",
		claim:
			"at 320, each visible scroll container satisfies scrollWidth <= clientWidth + 1, and the composer is usable",
		status: "covered",
		test: "parity 62: at 320 nothing overflows and the composer is usable",
	},
	{
		n: 63,
		scenario: "S10",
		claim:
			"a full run of the parity suite produces no uncaught exception, no page error and no console error",
		status: "covered",
		test: "parity 63: a walk of every scenario route produces no page error and no console error",
	},
	{
		n: 64,
		scenario: "S10",
		claim:
			"no request fails with a 4xx or 5xx, apart from requests a test deliberately provokes and asserts",
		status: "covered",
		test: "parity 64: the walk makes no unprovoked failing request",
	},
];

/** Every line the suite must account for, so a count is checkable rather than claimed. */
export const PARITY_TOTAL = 64;

/** Lines the checklist itself says are not carried across. */
export const NOT_CARRIED = PARITY_LINES.filter(
	(line) => line.status === "not-carried",
);

/** Lines whose owning criterion does not survive contact with what the app turned out to be. */
export const BLOCKED = PARITY_LINES.filter(
	(line) => line.status === "blocked-by-the-app",
);
