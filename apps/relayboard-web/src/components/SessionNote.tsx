import { useQuery } from "@tanstack/react-query";
import type { HeldPermissions } from "#/client";
import { useActingClient } from "#/client/context";
import { heldGrantQuery } from "#/components/-thread-queries";
import type { PermissionName } from "#/domain";
import "./SessionNote.css";

/**
 * What a session is, in a participant's words — and what this session may do.
 *
 * The app issues a signed cookie naming the principal a browser acts as, and that is **identity, not
 * authentication**: this workspace holds no password, no second factor and no proof of personhood, so a
 * cookie says "this browser was handed this participant", never "this browser is that person". Saying so
 * where a participant reads it is the product's own rule — never claim a guarantee the implementation
 * does not make — and it is story 150's requirement stated at the one control that could otherwise imply
 * more.
 *
 * ## 12:20 is the second half
 *
 * "The reader can see which principal they are acting as, **and what they themselves may do here**." The
 * first half has been here since 06b; the second is this ticket's, and it reads the **same** query the
 * create controls use rather than asking again — one answer to "what may I do here", so a control that
 * is enabled and a sentence that says so cannot disagree.
 *
 * The permissions are the reader's own, so showing them reveals nothing: a caller can always ask what it
 * holds (the read's requirement is `none`, for the reason 09 recorded — a surface must be able to ask
 * what it may offer before offering it).
 */
export function SessionNote({
	principalId,
	boardId,
}: {
	readonly principalId: string;
	/** The board the reader is on, because a grant is per board: "here" needs a here. */
	readonly boardId: string | undefined;
}) {
	const client = useActingClient();
	/**
	 * The reader's own grant, through **the same query the create controls use**.
	 *
	 * One answer to "what may I do here", so a control that is enabled and a sentence that says so cannot
	 * disagree — which is the defect class 09's finding was about (a workspace-scoped permission read as a
	 * board-scoped list). No board means no grant to state, and the sentence is omitted rather than shown
	 * empty.
	 */
	const grant = useQuery<HeldPermissions>({
		...(boardId === undefined
			? {
					queryKey: ["held-grant", "none"] as const,
					queryFn: async (): Promise<HeldPermissions> => ({
						onBoard: [],
						workspace: [],
					}),
				}
			: heldGrantQuery(client, boardId)),
		enabled: boardId !== undefined,
	});
	const onBoard: readonly PermissionName[] = grant.data?.onBoard ?? [];

	return (
		<p className="session-note">
			You are acting as{" "}
			<span className="session-note__principal">{principalId}</span>. A session
			identifies you to this workspace; it does not sign you in, and anyone
			holding this browser&apos;s cookie acts as you.
			{boardId === undefined ? null : (
				<>
					{/* **What "here" means, stated rather than implied**: the permissions are this
					    board's, and a workspace-scoped one is not in this list. */}{" "}
					<span data-session-permissions={boardId}>
						{onBoard.length === 0
							? "You hold no permission on this board, so you can read it only as far as your session allows."
							: `On this board you may: ${onBoard.join(", ")}.`}
					</span>
				</>
			)}
		</p>
	);
}
