import type { QueryClient } from "@tanstack/react-query";
import type { BoardId, Entry, PrincipalPosition } from "#/client";
import type { RelayboardClientBound } from "#/client/context";
import { orderThreads, type ThreadRow } from "#/routes/-thread-list";

/**
 * The thread pane's read: the rows the list renders, resolved in one query.
 *
 * One query rather than one per thread because the rows are ordered against each other: a list
 * assembled from separate queries could sort threads whose latest entries came from two different
 * moments, which is a list that is never quite right.
 *
 * `readMessages` is used deliberately: it returns a thread's entries **without** marking the
 * thread read. `readThread` would advance `seen` and empty every unread marker the pane is about
 * to draw — the same trap the rail's counts avoided in 04a.
 */
export const threadRowsQuery = (
	client: RelayboardClientBound,
	boardId: BoardId,
) => ({
	queryKey: ["thread-rows", boardId, client.actingPrincipalId] as const,
	queryFn: async (): Promise<readonly ThreadRow[]> => {
		const threads = await client.listThreads(boardId);
		const entriesByThread: Record<string, readonly Entry[]> = {};
		const positionsByThread: Record<string, readonly PrincipalPosition[]> = {};
		for (const thread of threads) {
			const [entries, positions] = await Promise.all([
				client.readMessages(thread.id),
				client.readPositions(thread.id),
			]);
			entriesByThread[thread.id] = entries;
			positionsByThread[thread.id] = positions;
		}
		return orderThreads(
			threads,
			(threadId) => entriesByThread[threadId] ?? [],
			(threadId) =>
				unreadOf(
					entriesByThread[threadId] ?? [],
					positionsByThread[threadId] ?? [],
					client.actingPrincipalId,
				),
		);
	},
});

/**
 * How many entries in a thread this principal has not read.
 *
 * From the `seen` watermark and nothing else (spec L502), clamped at zero: a thread can shrink
 * when demo content is purged, and a count that went negative would render as a badge reading
 * "-2". The latest position is the thread's own last `seq`, taken from the entries rather than
 * from a length, so a gap-free sequence is not assumed twice.
 */
const unreadOf = (
	entries: readonly Entry[],
	positions: readonly PrincipalPosition[],
	principalId: string,
): number => {
	const latestSeq = entries.reduce(
		(last, entry) => Math.max(last, entry.seq),
		0,
	);
	const seen =
		positions.find((position) => position.principalId === principalId)
			?.watermarks.seen ?? 0;
	return Math.max(0, latestSeq - seen);
};

/** The resources a board holds, as its resources view renders them. */
export const resourcesQuery = (
	client: RelayboardClientBound,
	boardId: BoardId,
) => ({
	queryKey: ["resources", boardId] as const,
	queryFn: () => client.listResources(boardId),
});

/**
 * The principals on a board, as its people view renders them.
 *
 * **`retry: false`, and that is a product decision rather than a test convenience.** Since 07a this
 * read can be refused — a principal without `read:member` on the board is not entitled to the list —
 * and a refusal is not a transient failure: retrying it three times with exponential backoff would
 * show a reader a loading state for several seconds before finally telling them something that was
 * already true. Measured: without this, the view sat on "Reading the participants" for the whole
 * backoff window.
 *
 * The refusal is still rendered as a stated state (the view handles it), so nothing is swallowed;
 * what changes is that the answer arrives immediately rather than after three attempts.
 */
export const peopleQuery = (
	client: RelayboardClientBound,
	boardId: BoardId,
) => ({
	queryKey: ["people", boardId] as const,
	queryFn: () => client.listMembers(boardId),
	retry: false,
});

/**
 * Everything the pane reads at first paint, in one call for the loader to prime.
 *
 * All three views, not only the one the URL names. The tabs are links, so switching to Resources
 * is a client-side navigation with no loader run of its own unless the route revalidates — and a
 * view that rendered empty and then filled would be the third appearance of the defect 06a and 06b
 * already paid for.
 */
export const primePane = async (
	queryClient: QueryClient,
	client: RelayboardClientBound,
	boardId: BoardId,
): Promise<void> => {
	// **A refused view must not take the page with it.** Since 07a the people view can be refused for
	// a principal without `read:member` on the board, and that refusal is a *stated state in one
	// column* (04b built the branch for it) — not a page-level error. Priming all three views
	// opportunistically is what makes the other two arrive at first paint; a refusal settles that
	// query into its error state, which is exactly what the view renders.
	//
	// Found by measuring: with `nadia`'s session the whole page rendered "Something went wrong",
	// because the refusal escaped the loader. A view whose absence is designed for must not be able
	// to fail the navigation that shows it.
	await Promise.all([
		queryClient.ensureQueryData(threadRowsQuery(client, boardId)),
		queryClient.ensureQueryData(resourcesQuery(client, boardId)),
		queryClient
			.ensureQueryData(peopleQuery(client, boardId))
			.catch(() => undefined),
	]);
};
