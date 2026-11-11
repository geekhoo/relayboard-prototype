import type { PrincipalPosition, Thread } from "#/client";

/**
 * How many entries in a thread a participant has not yet read.
 *
 * The unread badge **counts from the `seen` watermark and from nothing else** (spec L502):
 * `seen` is how far a principal has read, so anything past it is unread. A client-side
 * counter beside it would be a second source of truth, and the two would disagree the
 * first time a thread was read in another tab.
 *
 * Two things are deliberately not here:
 *
 * - **A "not my own entries" filter.** The prototype hides `alex`'s own posts from its
 *   unread count (`app.js` L135), which happens to agree with `seen` for the one reader it
 *   hard-coded. Here the watermark is the truth: if a principal read a thread, its own
 *   entries are read too, so a filter would only be able to disagree with the record.
 * - **Reading the thread.** This is arithmetic on two numbers a caller already has, so a
 *   rail can render before any read happens and no render can mutate a watermark.
 */
export const unreadInThread = (
	threadEntryCount: number,
	position: PrincipalPosition | undefined,
): number => {
	const seen = position?.watermarks.seen ?? 0;
	return Math.max(0, threadEntryCount - seen);
};

/** One row of the rail: a board, and the unread count across its threads. */
export interface BoardUnread {
	readonly boardId: string;
	readonly unread: number;
}

/**
 * The unread count for each board, summed over its threads.
 *
 * Takes the thread list and the reader's positions, both keyed by thread id, rather than
 * reaching for either: a rail that fetched its own counts could disagree with the pane's
 * badges, and the prototype's rail is exactly the sum of its thread badges.
 */
export const boardUnreadCounts = (input: {
	readonly boards: readonly { readonly id: string }[];
	readonly threads: readonly Thread[];
	readonly entryCounts: Readonly<Record<string, number>>;
	readonly positionsByThread: Readonly<
		Record<string, readonly PrincipalPosition[]>
	>;
	readonly principalId: string;
}): readonly BoardUnread[] =>
	input.boards.map((board) => ({
		boardId: board.id,
		unread: input.threads
			.filter((thread) => thread.boardId === board.id)
			.reduce(
				(total, thread) =>
					total +
					unreadInThread(
						input.entryCounts[thread.id] ?? 0,
						input.positionsByThread[thread.id]?.find(
							(position) => position.principalId === input.principalId,
						),
					),
				0,
			),
	}));
