import type {
	BoardId,
	PrincipalId,
	PrincipalPosition,
	ThreadId,
} from "#/client";
import type { RelayboardClientBound } from "#/client/context";

/**
 * The participant panel's two reads, and **both are the documented ones**.
 *
 * 12:21 is explicit: the panel reads the participant and its grant through **one board-scoped
 * principal read**, not off a board payload and not through a second undocumented call. So this is
 * `readPrincipal({ principalId, boardId })` and nothing else — which is also what makes a caller
 * without `read:member` unable to obtain a participant by opening a panel.
 *
 * `retry: false` for the reason the people view needed it in 07a: a permission refusal is not
 * transient, so retrying it three times shows a reading state for several seconds before telling the
 * reader something that was already true.
 */
export const participantQuery = (
	client: RelayboardClientBound,
	boardId: BoardId,
	principalId: PrincipalId,
) => ({
	queryKey: ["participant", boardId, principalId] as const,
	queryFn: () => client.readPrincipal({ principalId, boardId }),
	retry: false,
});

/**
 * Every principal's position on **one thread**, which is where the three watermarks come from.
 *
 * **`readPositions`, not a second participant read**, and the ticket says why in one phrase: the
 * position is a fact about a `(principal, thread)` pair, not about a principal. Asking
 * `readPrincipal` for it would mean that read needing a thread, which the interface deliberately does
 * not do — and 12:21 asks for the participant and its grant from one call, not for every field.
 *
 * A thread is therefore required, and the panel takes the open one. With no thread open there is no
 * progress to report, and the panel says so rather than showing zeros.
 */
export const participantProgressQuery = (
	client: RelayboardClientBound,
	threadId: ThreadId,
) => ({
	queryKey: ["participant-progress", threadId] as const,
	queryFn: (): Promise<readonly PrincipalPosition[]> =>
		client.readPositions(threadId),
	retry: false,
});
