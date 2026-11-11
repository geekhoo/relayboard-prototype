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

/** The principals on a board, as its people view renders them. */
export const peopleQuery = (
	client: RelayboardClientBound,
	boardId: BoardId,
) => ({
	queryKey: ["people", boardId] as const,
	queryFn: () => client.listMembers(boardId),
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
	await Promise.all([
		queryClient.ensureQueryData(threadRowsQuery(client, boardId)),
		queryClient.ensureQueryData(resourcesQuery(client, boardId)),
		queryClient.ensureQueryData(peopleQuery(client, boardId)),
	]);
};
