import type { QueryClient } from "@tanstack/react-query";
import type {
	BoardId,
	Entry,
	PrincipalSummary,
	StreamEvent,
	Thread,
	ThreadId,
} from "#/client";
import type { RelayboardClientBound } from "#/client/context";
import { unreadQuery } from "#/components/-rail-queries";
import { peopleQuery } from "#/components/-thread-queries";

/**
 * The conversation's reads.
 *
 * ## `readThread` is deliberate, and so is what it does to the badge
 *
 * Reading a thread is the only act that advances the reader's `seen` watermark (03's decision, and
 * the thing that makes an unread badge mean anything). So opening a thread **is** the moment its
 * unread count should go to zero — and that means the rail's count is a consequence of the
 * conversation rendering, not an independent fact.
 *
 * Two behaviours are possible and this file picks one **on purpose**:
 *
 * - The rail's query is invalidated after `readThread` resolves, so its counts update within the
 *   same view. The alternative — leaving it stale until the next navigation — would show a reader
 *   "5 unread" over a thread they are actively reading, which is a number the interface knows to be
 *   wrong.
 * - The invalidation runs **after** the read resolves, never during it, so the pane does not
 *   re-render mid-read.
 *
 * The choice is visible here rather than emerging from whichever query happened to be invalidated:
 * `primeConversation` primes, `useConversation` reads, and `markThreadRead` is the one place that
 * says what a read costs.
 */
export const conversationQuery = (
	client: RelayboardClientBound,
	threadId: ThreadId,
) => ({
	queryKey: ["conversation", threadId, client.actingPrincipalId] as const,
	queryFn: () => client.readThread(threadId),
});

/**
 * The board's rosters, needed for two things the entries do not carry.
 *
 * An entry names its author by id; the author's **name** and **kind** live on the principal. So the
 * conversation needs the board's members to say who spoke and to mark agent-authored entries —
 * which is why this is a dependency of the conversation rather than something the message component
 * fetches for itself.
 */
/**
 * The thread's positions: where every principal has got on the three-rung ladder.
 *
 * Needed since 10b, because the acknowledge control has to know **both ends** of the range it would
 * cover — "up to #7" only means something against where the reader already is — and because the
 * acknowledgement's own entry states a range rather than a single position.
 *
 * Primed by the conversation loader with the rest of the thread, for the reason every column here is:
 * a watermark that arrived after hydration would put a wrong number under the control for a moment,
 * and 06a and 06b each paid for that defect once.
 */
export const conversationPositionsQuery = (
	client: RelayboardClientBound,
	threadId: ThreadId,
) => ({
	queryKey: [
		"conversation-positions",
		threadId,
		client.actingPrincipalId,
	] as const,
	queryFn: () => client.readPositions(threadId),
});

/**
 * Apply one stream event to the Query cache — the **only** thing the stream may do to the UI.
 *
 * 11a:23: "The stream adds no second data layer to the UI: it updates the Query cache rather than
 * bypassing it." So an arriving event does not render itself: it invalidates the specific query whose
 * answer changed, and the reader sees the same shape it would have seen by navigating. That is the
 * difference between a live entry and an entry only the stream knows about — and it is why the entry's
 * `seq` is enough: the cache refetches from the chronology, which is the one source of truth.
 *
 * What each kind invalidates is a decision rather than a blanket refetch, for the reason 09 recorded
 * when creating a board left the rail stale: a blanket refetch would hide the mistake of invalidating
 * the wrong thing.
 */
export const applyStreamEvent = (
	queryClient: QueryClient,
	client: RelayboardClientBound,
	event: StreamEvent,
): void => {
	switch (event.type) {
		case "message-committed":
		case "artifact-attached":
		case "status-moved":
		case "acknowledged":
			// An entry landed: the chronology changed, and so did this thread's row and its counts.
			void queryClient.invalidateQueries({
				queryKey: conversationQuery(client, event.threadId).queryKey,
			});
			void queryClient.invalidateQueries({
				queryKey: conversationPositionsQuery(client, event.threadId).queryKey,
			});
			void queryClient.invalidateQueries({
				queryKey: unreadQuery(client).queryKey,
			});
			return;
		case "connection-changed":
			// A reconnect replayed entries the cache does not have, so the counts are stale. Named
			// rather than refetching everything, for the same reason.
			void queryClient.invalidateQueries({
				queryKey: unreadQuery(client).queryKey,
			});
			return;
		default:
			// `thread-created`, `board-created`, `resource-created` and `stream-error` change things
			// outside the conversation a reader is in. They are emitted and typed, and the surfaces that
			// consume them are 11b's and 11c's; what this function must not do is pretend, so it does
			// nothing and says so.
			return;
	}
};

export const conversationRosterQuery = (
	client: RelayboardClientBound,
	boardId: BoardId,
) => peopleQuery(client, boardId);

/** Everything the conversation reads at first paint, for the loader to prime. */
export const primeConversation = async (
	queryClient: {
		ensureQueryData: <T>(options: {
			queryKey: readonly unknown[];
			queryFn: () => Promise<T>;
		}) => Promise<T>;
	},
	client: RelayboardClientBound,
	boardId: BoardId,
	threadId: ThreadId,
): Promise<{ thread: Thread; entries: readonly Entry[] }> => {
	const [contents] = await Promise.all([
		queryClient.ensureQueryData(conversationQuery(client, threadId)),
		// **The roster can be refused, and a refusal must not fail the navigation.** It is gated by
		// `read:member`, which a principal with workspace grants but no board grant does not hold —
		// and such a principal can still read the thread. Measured: with the seeded superadmin's
		// session the whole page rendered "Something went wrong" because this prime escaped the
		// loader. A settled refusal is a state the conversation renders (names fall back to ids), not
		// a page-level error.
		queryClient
			.ensureQueryData(conversationRosterQuery(client, boardId))
			.catch(() => undefined),
	]);
	return contents;
};

/** The roster the conversation renders names and kinds from. */
export type ConversationRoster = readonly PrincipalSummary[];
