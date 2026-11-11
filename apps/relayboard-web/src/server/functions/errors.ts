/**
 * How a refused request is reported, so a client can tell the families apart.
 *
 * The spec requires three distinguishable families (06c: error mapping): a **validation**
 * failure (the request was malformed), a **resolution** failure (there is no principal to act
 * as — the one case a client must not retry silently, spec L517), and an **unknown object**
 * (the request was well-formed and the thing it names is not here). A fourth exists for a
 * capability this build does not have yet, so it fails loudly rather than looking empty.
 *
 * Each is a `ServerError` carrying a stable `code`. The *message* is user-visible where the
 * domain already documented one — `Board not found`, `Thread not found` — because those
 * strings are observable behaviour (spec L520) and the transport must not reword them; the
 * code is what the client branches on, and the message is what a reader sees.
 */

/** The families a caller can act on differently. */
export type ServerErrorCode =
	| "validation" // malformed request; retrying unchanged will fail again
	| "unresolved" // no principal to act as; the client must not retry silently
	| "unknown-object" // well-formed, and the thing it names does not exist
	| "unimplemented"; // this build has no such operation yet, and says so

export class ServerError extends Error {
	readonly code: ServerErrorCode;
	/** The object the refusal is about, when there is one. For a log or a client's message. */
	readonly subject?: string;

	constructor(code: ServerErrorCode, message: string, subject?: string) {
		super(message);
		this.name = "ServerError";
		this.code = code;
		this.subject = subject;
	}
}

/**
 * Malformed input, refused at the boundary.
 *
 * A Zod schema normally throws its own error; the handlers wrap that here so every refusal
 * from this layer carries a `ServerErrorCode` rather than a stringly-typed exception.
 */
export const invalidInput = (detail: string): ServerError =>
	new ServerError("validation", detail);

/** A board id that this workspace does not hold. The message is the domain's documented one. */
export const boardNotFound = (boardId: string): ServerError =>
	new ServerError("unknown-object", "Board not found", boardId);

/**
 * A well-formed request naming something this workspace does not hold.
 *
 * Deliberately separate from {@link boardNotFound}, which carries the domain's documented string:
 * the ones with a documented string keep it (spec L520 forbids the transport rewording them), and
 * anything without one gets a message that names what was asked for rather than a generic refusal.
 */
export const unknownObject = (kind: string, id: string): ServerError =>
	new ServerError("unknown-object", `No ${kind} ${id} in this workspace`, id);

/** A principal that this workspace does not hold. */
export const unknownPrincipal = (principalId: string): ServerError =>
	new ServerError(
		"unresolved",
		`No principal ${principalId} in this workspace`,
	);

/**
 * An operation this build has not reached yet.
 *
 * The rule is 06a's own: an absent capability must fail loudly rather than return
 * `undefined` or an empty result, because an empty result reads as a pass. The message names
 * where it arrives, so a reader lands on the ticket rather than on a mystery.
 */
export const notYetOnTheWire = (
	operation: string,
	ticket = "06c",
): ServerError =>
	new ServerError(
		"unimplemented",
		`${operation} is not served in this build; it arrives with ticket ${ticket}`,
	);
/**
 * The test/dev reset, refused because this process is not one.
 *
 * A separate refusal from {@link notYetOnTheWire} on purpose: "this build does not have it
 * yet" and "this process may not do it" are different facts, and a message that conflated them
 * would send an operator looking for a ticket when the answer is an environment.
 */
export const resetRefused = (): ServerError =>
	new ServerError(
		"unresolved",
		"The store reset is available only in a test or development process, and this one is neither. It is not a participant operation and has no route in a production build.",
	);
