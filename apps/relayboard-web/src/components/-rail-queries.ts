import type { QueryClient } from "@tanstack/react-query";
import type { RelayboardClientBound } from "#/client/context";
import type { BoardUnread } from "#/components/-unread";
import { boardUnreadCounts } from "#/components/-unread";

/**
 * The rail's two reads, as Query definitions.
 *
 * They live here, outside the component, for one reason: the route's **loader** primes them
 * with `ensureQueryData` so the rail is server-rendered with real boards and real counts.
 * A rail that fetched only in the browser would paint an empty column first and fill it a
 * moment later — a flash of "no boards" on a workspace that has three, which is precisely
 * the kind of temporary lie the product's honesty rule forbids.
 *
 * Both go through `RelayboardClient`, never the store: the rail is a participant-facing
 * component and 04a's Biome rule makes the shortcut a lint failure.
 */

/** Every board the acting principal may see, with the count of people on it. */
export const boardsQuery = (client: RelayboardClientBound) => ({
	queryKey: ["boards"] as const,
	queryFn: () => client.listBoards(),
});

/**
 * One unread count per board, derived from the reader's `seen` watermarks.
 *
 * A single query rather than one per board, because the counts are rendered together and a
 * participant comparing two boards must not see numbers from two different moments.
 *
 * `readMessages` is the read used deliberately: it returns a thread's entries **without
 * marking the thread read**, which is what keeps the badge from disappearing the moment the
 * rail renders. `readThread` would advance `seen` and empty every badge — the one bug this
 * choice exists to avoid.
 */
export const unreadQuery = (client: RelayboardClientBound) => ({
	// Keyed by the reader as well as by the data: two participants on one workspace have two
	// different sets of badges, and a cache keyed only by "unread" would hand one of them the
	// other's counts.
	queryKey: ["unread", client.actingPrincipalId] as const,
	queryFn: async (): Promise<readonly BoardUnread[]> => {
		const boards = await client.listBoards();
		const counts: BoardUnread[] = [];
		for (const board of boards) {
			const threads = await client.listThreads(board.id);
			const entryCounts: Record<string, number> = {};
			const positionsByThread: Record<
				string,
				Awaited<ReturnType<RelayboardClientBound["readPositions"]>>
			> = {};
			for (const thread of threads) {
				const [entries, positions] = await Promise.all([
					client.readMessages(thread.id),
					client.readPositions(thread.id),
				]);
				entryCounts[thread.id] = entries.length;
				positionsByThread[thread.id] = positions;
			}
			const [count] = boardUnreadCounts({
				boards: [{ id: board.id }],
				threads,
				entryCounts,
				positionsByThread,
				principalId: client.actingPrincipalId,
			});
			counts.push(count ?? { boardId: board.id, unread: 0 });
		}
		return counts;
	},
});

/** Primes both reads on the server, so the first paint is the real rail. */
export const primeRail = async (
	queryClient: QueryClient,
	client: RelayboardClientBound,
): Promise<void> => {
	await Promise.all([
		queryClient.ensureQueryData(boardsQuery(client)),
		queryClient.ensureQueryData(unreadQuery(client)),
	]);
};
