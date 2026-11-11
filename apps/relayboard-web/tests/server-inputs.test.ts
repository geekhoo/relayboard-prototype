import { describe, expect, it } from "vitest";
import {
	boardInput,
	readMessagesInput,
	readPrincipalInput,
	threadInput,
} from "#/server/functions/inputs";

/**
 * The read operations' boundary, asserted where it can be asserted.
 *
 * \`createServerFn\` needs a request-scoped Start context, so a handler cannot be called from a
 * Node test — see \`tests/store-instance.test.ts\` for why fabricating one would prove nothing.
 * What the schemas are is the part that *is* testable, and it is the part 06a's criterion is
 * actually about: **malformed input is refused at the boundary, before the store is touched**.
 * If a schema accepts something it should not, no handler can save it.
 *
 * The store-touch half is asserted by construction: the validator runs inside the server
 * function before the handler body, so a schema that rejects guarantees the handler never
 * ran. That ordering is the framework's, not this file's, and the served probe in the
 * ticket's evidence shows both a refused call and an accepted one against a real build.
 */

describe("the read operations' input schemas", () => {
	it("require the id each read is about, and refuse its absence", () => {
		expect(boardInput.safeParse({ boardId: "platform" }).success).toBe(true);
		expect(boardInput.safeParse({}).success).toBe(false);
		expect(boardInput.safeParse({ boardId: "" }).success).toBe(false);
		expect(threadInput.safeParse({ threadId: "delivery" }).success).toBe(true);
		expect(threadInput.safeParse({}).success).toBe(false);
	});

	it("strip unknown keys, so nothing can be smuggled past the validator", () => {
		// The protection is Zod's default object behaviour: a key the schema does not name is
		// dropped rather than passed to the handler. Asserted rather than assumed, because a
		// `.passthrough()` would silently undo it.
		const parsed = boardInput.parse({ boardId: "platform", authorId: "maya" });
		expect(parsed).toEqual({ boardId: "platform" });
		expect(Object.keys(parsed)).toEqual(["boardId"]);
	});

	it("refuse a position that is not a whole, non-negative number", () => {
		expect(readMessagesInput.safeParse({ threadId: "delivery" }).success).toBe(
			true,
		);
		expect(
			readMessagesInput.safeParse({ threadId: "delivery", after: 3 }).success,
		).toBe(true);
		for (const after of [-1, 1.5, Number.NaN, "3", null]) {
			expect(
				readMessagesInput.safeParse({ threadId: "delivery", after }).success,
			).toBe(false);
		}
	});

	it("require BOTH ids for the participant read, because a grant is per board", () => {
		// A read taking only a principal could not answer "what may this participant do here",
		// so the schema is where that mistake is impossible rather than merely discouraged.
		expect(
			readPrincipalInput.safeParse({ principalId: "alex", boardId: "platform" })
				.success,
		).toBe(true);
		expect(readPrincipalInput.safeParse({ principalId: "alex" }).success).toBe(
			false,
		);
		expect(readPrincipalInput.safeParse({ boardId: "platform" }).success).toBe(
			false,
		);
	});

	it("refuse a non-object payload rather than throwing", () => {
		for (const payload of [null, undefined, "platform", 42, [], true]) {
			expect(boardInput.safeParse(payload).success).toBe(false);
		}
	});
});
