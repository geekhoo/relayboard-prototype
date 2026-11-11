import type { Entry, Seq, Thread } from "#/client";
import type { PrincipalId } from "#/domain";

/**
 * The thread pane's arithmetic: what a row shows, in what order, and whether it is shown.
 *
 * Pure and separate from the component for the same reason `-unread` and `-board-search` are: the
 * rules are worth asserting without a DOM, and a component that computed them inline would make
 * the ordering rule invisible in a diff.
 */

/**
 * One row of the thread list.
 *
 * Everything a row renders, resolved once here rather than recomputed per render: the latest
 * entry, who wrote it, how many entries there are, and how many this reader has not read.
 */
export interface ThreadRow {
	readonly thread: Thread;
	/** The most recent entry by `seq`, or `undefined` for a thread nobody has written in yet. */
	readonly latest: Entry | undefined;
	readonly lastAuthorId: PrincipalId | undefined;
	/** The thread's length, which is its latest `seq`. */
	readonly entryCount: Seq;
	readonly unread: number;
}

const latestOf = (entries: readonly Entry[]): Entry | undefined =>
	entries.reduce<Entry | undefined>(
		(latest, entry) =>
			latest === undefined || entry.seq > latest.seq ? entry : latest,
		undefined,
	);

/** The instant a row sorts by: its latest entry's, or the thread's own creation time. */
const recencyOf = (thread: Thread, latest: Entry | undefined): number =>
	new Date(latest?.createdAt ?? thread.createdAt).getTime();

/**
 * Rows for a board's threads, newest activity first.
 *
 * **This is the one place a timestamp orders anything in the product.** A thread has no `seq`
 * of its own, so "most recently active first" has nothing else to sort by. The rule holds only
 * *across* threads: within a thread the canonical order is `seq`, never `createdAt` (AGENTS.md),
 * and this sort says nothing about that. It is stated here, next to the sort, so it is not
 * mistaken for a violation — and it must not be cited as evidence that ordering by timestamp is
 * safe anywhere else.
 *
 * Ties break by thread id, so the list does not reorder itself between two renders that read the
 * same data — a list that reshuffles on every read is a list a reader cannot click.
 */
export const orderThreads = (
	threads: readonly Thread[],
	entriesFor: (threadId: string) => readonly Entry[],
	unreadFor: (threadId: string) => number,
): readonly ThreadRow[] =>
	threads
		.map((thread) => {
			const entries = entriesFor(thread.id);
			const latest = latestOf(entries);
			return {
				thread,
				latest,
				lastAuthorId: latest?.authorId,
				entryCount: latest?.seq ?? 0,
				unread: unreadFor(thread.id),
			};
		})
		.sort((left, right) => {
			const delta =
				recencyOf(right.thread, right.latest) -
				recencyOf(left.thread, left.latest);
			return delta !== 0 ? delta : left.thread.id < right.thread.id ? -1 : 1;
		});

/**
 * The rows a search text and the unread filter leave.
 *
 * The search matches the **title and the latest entry's text**, which is what the prototype
 * matches (`app.js` L142) and what a reader can see in the row: a match on text they cannot see
 * would be a result with no visible reason.
 *
 * The unread filter keeps threads whose reader is behind the latest `seq` — read from the
 * watermark, never from a counter.
 */
export const filterThreads = (
	rows: readonly ThreadRow[],
	filter: { readonly query: string; readonly unreadOnly: boolean },
): readonly ThreadRow[] => {
	const needle = filter.query.trim().toLowerCase();
	return rows.filter((row) => {
		if (filter.unreadOnly && row.unread === 0) return false;
		if (needle === "") return true;
		const haystack =
			`${row.thread.title} ${row.latest?.text ?? ""}`.toLowerCase();
		return haystack.includes(needle);
	});
};

/**
 * Which empty state a filtered list shows, or `null` when it has rows.
 *
 * Three different absences with three different things to say, and the prototype's copy for each
 * (`app.js` L142): no search result is not the same as a caught-up reader, which is not the same as
 * a board nobody has started a conversation in. One generic "nothing here" would tell a reader
 * nothing about which of the three they are looking at.
 */
export const emptyStateFor = (
	rows: readonly ThreadRow[],
	filter: { readonly query: string; readonly unreadOnly: boolean },
): { readonly title: string; readonly detail: string } | null => {
	if (rows.length > 0) return null;
	if (filter.query.trim() !== "") {
		return {
			title: "No matching threads",
			detail: "Try a different search term.",
		};
	}
	if (filter.unreadOnly) {
		return {
			title: "All caught up",
			detail: "You have no unread messages here.",
		};
	}
	return {
		title: "Start a conversation",
		detail: "Create the first thread in this board.",
	};
};
