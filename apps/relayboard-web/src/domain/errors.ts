/**
 * The documented error strings, in one place.
 *
 * They are user-visible: the interface shows them, the spec's validation contract
 * (spec L507-518) pins their wording and their order, and a retry or a stale link
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
} as const;

/** The three strings above, as a list in the documented order. */
export const errorMessageList = [
	errorMessages.threadNotFound,
	errorMessages.notABoardMember,
	errorMessages.messageEmpty,
] as const;

export type ErrorMessages = typeof errorMessages;
