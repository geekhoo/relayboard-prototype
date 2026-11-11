import { z } from "zod";

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

export type BoardInput = z.infer<typeof boardInput>;
export type ThreadInput = z.infer<typeof threadInput>;
export type ReadMessagesInput = z.infer<typeof readMessagesInput>;
export type ReadPrincipalInput = z.infer<typeof readPrincipalInput>;
