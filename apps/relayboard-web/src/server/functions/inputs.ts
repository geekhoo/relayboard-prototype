import { z } from "zod";
import { THREAD_STATUSES } from "#/domain";
import { httpUrl, RESOURCE_TYPES } from "#/domain/forms";

/**
 * The input schemas for the read operations, in one place.
 *
 * Kept separate from the handlers for one reason that matters: they are the **boundary**, and
 * the boundary is the only part of a server function that can be asserted in a Node test. A
 * handler needs a request-scoped Start context; a schema does not, so `tests/server-inputs.test.ts`
 * can prove that malformed input is refused before any handler runs, which is the claim
 * 06a makes.
 *
 * Every schema is `z.object` with no `passthrough`, so Zod strips unknown keys: a caller
 * cannot smuggle a field past the validator into a handler. The ids are non-empty strings
 * rather than branded types, because an id from a URL is a string and a brand would only move
 * a cast to the caller.
 */

/** A board id. */
export const boardInput = z.object({ boardId: z.string().min(1) });

/** A thread id. */
export const threadInput = z.object({ threadId: z.string().min(1) });

/** A thread id and an optional position to read after. */
export const readMessagesInput = z.object({
	threadId: z.string().min(1),
	after: z.number().int().nonnegative().optional(),
});

/**
 * The participant read: **both** ids, because a grant is per board.
 *
 * A read that took only a principal could not answer "what may this participant do here", so
 * the schema requires the board too and the handler answers for that board alone.
 */
export const readPrincipalInput = z.object({
	principalId: z.string().min(1),
	boardId: z.string().min(1),
});

/**
 * The write schemas.
 *
 * Every one of them is `z.object` without `passthrough`, which is what makes "no operation accepts
 * an author from the caller" a property of the boundary rather than a promise in a comment: a body
 * carrying `authorId` has the key **stripped** before the handler sees it, so a forged author is not
 * refused — it is unnoticed, and the handler's own resolution is the only author there is. The tests
 * assert exactly that: the forged value is dropped, not rejected, so a caller cannot even learn
 * whether it would have worked.
 */
export const appendMessageInput = z.object({
	threadId: z.string().min(1),
	/**
	 * Not validated for emptiness here, deliberately: "Message cannot be empty" is the domain's
	 * string and the store trims and refuses. Two places refusing one thing is how they come to
	 * disagree, so the boundary checks the shape and the store owns the rule.
	 */
	text: z.string(),
	references: z.array(z.object({ resourceId: z.string().min(1) })).optional(),
	relation: z
		.object({ type: z.string().min(1), entryId: z.string().min(1) })
		.optional(),
	idempotencyKey: z.string().min(1).optional(),
});

/** A thread: a board and a title, and **no description** — see `createThreadForm` in the domain. */
export const createThreadInput = z.object({
	boardId: z.string().min(1),
	title: z.string().min(1),
});

export const createBoardInput = z.object({
	name: z.string().min(1),
	description: z.string().optional(),
});

/**
 * A resource: the URL and the type are the two things 09 closes.
 *
 * **`httpUrl` refuses before the store is touched**, so a `javascript:` or `data:` URL cannot be
 * stored and then followed by a reader. And the type is an **enum with a default rather than an
 * optional string**: the seed's three values plus `Link`, which is the prototype's own default on
 * `addResource` (app.js L117). The earlier version accepted `type` as `.optional()` and defaulted in
 * the handler, so a caller could pass any string and have it stored — the "field nothing can filter on
 * later" the criterion forbids.
 */
export const addResourceInput = z.object({
	boardId: z.string().min(1),
	name: z.string().min(1),
	url: httpUrl,
	type: z.enum(RESOURCE_TYPES).default("Link"),
	description: z.string(),
});

export const attachResourceInput = z.object({
	threadId: z.string().min(1),
	resourceId: z.string().min(1),
});

/**
 * A status move, over the **closed set** rather than over strings.
 *
 * The store's guard is the authority, but it should never be reached with a value that is not a status:
 * a wire payload is JSON and arrives untyped, so the boundary is where a fifth status would otherwise
 * enter. Both ends are checked because `from` is the caller's belief about the thread, and a belief
 * outside the set is a caller bug rather than a stale read.
 */
export const moveStatusInput = z.object({
	threadId: z.string().min(1),
	from: z.enum(THREAD_STATUSES),
	to: z.enum(THREAD_STATUSES),
});

export const acknowledgeInput = z.object({
	threadId: z.string().min(1),
	upTo: z.number().int().nonnegative(),
});

/**
 * A purge carries its own confirmation, and nothing else.
 *
 * **The confirmation is a boolean on the wire rather than a server-side prompt**, because the surface
 * that names the consequence has to show it *before* the act (14:14) — so the reader confirms what they
 * were shown, and the server records that they did. A server that prompted would be a second
 * confirmation nobody could see.
 */
export const purgeInput = z.object({ confirmed: z.literal(true) });

export const simulateIncomingInput = z.object({ threadId: z.string().min(1) });

export const setConnectionInput = z.object({
	connected: z.boolean(),
});

export type AppendMessageInputSchema = z.infer<typeof appendMessageInput>;
export type CreateThreadInputSchema = z.infer<typeof createThreadInput>;
export type CreateBoardInputSchema = z.infer<typeof createBoardInput>;
export type AddResourceInputSchema = z.infer<typeof addResourceInput>;
export type AttachResourceInputSchema = z.infer<typeof attachResourceInput>;
export type MoveStatusInputSchema = z.infer<typeof moveStatusInput>;
export type AcknowledgeInputSchema = z.infer<typeof acknowledgeInput>;
export type SimulateIncomingInputSchema = z.infer<typeof simulateIncomingInput>;
export type SetConnectionInputSchema = z.infer<typeof setConnectionInput>;

export type BoardInput = z.infer<typeof boardInput>;
export type ThreadInput = z.infer<typeof threadInput>;
export type ReadMessagesInput = z.infer<typeof readMessagesInput>;
export type ReadPrincipalInput = z.infer<typeof readPrincipalInput>;
