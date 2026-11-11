/**
 * The documented error strings, in one place.
 *
 * They are user-visible: the interface shows them, the spec's validation contract
 * (spec L509-520) pins their wording and their order, and a retry or a stale link
 * produces one. Keeping them here rather than inside the store is what lets the
 * store, the transport's error mapping and the tests all assert the same literal
 * without any one of them becoming the copy of record.
 *
 * Order matters and is the array's order: an append checks the thread first, then
 * the author's place on the board, then the text. A caller that gets two things
 * wrong learns about the first one only.
 *
 * This object is the domain module's only runtime export, and nothing in it branches
 * on a principal's `kind` — it is a vocabulary, not a rule.
 */
export const errorMessages = {
	/** The thread an append names does not exist in this workspace. */
	threadNotFound: "Thread not found",
	/** The acting principal holds no place on the board the thread belongs to. */
	notABoardMember: "This participant is not a board member",
	/** The text was empty, or held nothing but whitespace. */
	messageEmpty: "Message cannot be empty",
	/** The board a create operation names does not exist in this workspace (spec L516). */
	boardNotFound: "Board not found",
	/**
	 * The acting principal holds no grant for an operation, at the scope it needs.
	 *
	 * Distinct from {@link notABoardMember}, which is the *board* membership refusal the append path
	 * makes and which the prototype's copy fixes. This one is the permission refusal 07a introduces:
	 * it names no permission, because the message is read by a person and the permission name is
	 * carried beside it (see `src/server/permissions.ts`), so the string stays stable while the
	 * detail travels with it.
	 */
	permissionDenied:
		"This participant does not hold the permission that action requires",
	/**
	 * A grant record that cannot mean anything: no scope, a board on a workspace grant, or a name
	 * outside the vocabulary.
	 *
	 * A validation failure rather than a grant that quietly does nothing (07a:14), because a grant
	 * nobody can act on is indistinguishable from one that grants nothing — and the second is what a
	 * caller would assume.
	 */
	grantMalformed:
		"A grant needs a scope it can act on, and permissions that exist",
	/**
	 * A grant naming a participant this workspace does not hold.
	 *
	 * Distinct from `threadNotFound` and `boardNotFound` in the sentence but not in what a caller
	 * does about it: the request named something that is not here, and there is nothing to retry.
	 */
	principalNotFound: "No such participant in this workspace",
	/** An admission naming a principal id that is already taken. */
	principalExists: "That participant id is already taken",
	/**
	 * An artifact naming a resource this workspace does not hold, or one on another board.
	 *
	 * Both are the same refusal from a reader's point of view — there is nothing to point at — and the
	 * second is the one worth saying out loud: a resource is **board-scoped**, so an artifact cannot
	 * reach across boards and the message must not imply it could.
	 */
	resourceNotFound: "No such resource on this board",
	/**
	 * A status move whose `from` is not the thread's current status.
	 *
	 * Optimistic concurrency, and the sentence names the situation rather than the mechanism: another
	 * principal moved it, and the reader's control was reading a state that has since changed.
	 */
	statusChanged: "This thread's status changed since you read it",
	/** A status outside the closed set. */
	statusUnknown: "That is not a status a thread can be in",
	/** A move to the status the thread is already in: not a move, so not an event. */
	statusUnchanged: "This thread is already in that status",
	/** An acknowledgement that would move the principal's watermark backwards. */
	acknowledgementBehind:
		"An acknowledgement cannot go back: this participant already acknowledged further",
	/** An acknowledgement past the thread's last position. */
	acknowledgementAhead:
		"An acknowledgement cannot cover a position this thread has not reached",
} as const;

/**
 * The three strings an append can fail with, in the order an append checks them.
 *
 * Not every documented string: `Board not found` belongs to the create path and is
 * asserted by the operation that raises it, so a caller comparing this list to a
 * series of rejected appends gets exactly the append vocabulary.
 */
export const errorMessageList = [
	errorMessages.threadNotFound,
	errorMessages.notABoardMember,
	errorMessages.messageEmpty,
] as const;

export type ErrorMessages = typeof errorMessages;
