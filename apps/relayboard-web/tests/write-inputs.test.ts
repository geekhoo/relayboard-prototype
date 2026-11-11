import { describe, expect, it } from "vitest";
import {
	acknowledgeInput,
	addResourceInput,
	appendMessageInput,
	createBoardInput,
	createThreadInput,
	moveStatusInput,
	setConnectionInput,
	simulateIncomingInput,
} from "#/server/functions/inputs";

/**
 * The write boundary: what a POST may carry, and what it may not.
 *
 * Every schema here is the boundary a mutation crosses, and the one property they all share is the
 * one 06c's criterion is about — **none admits an author**. The tests below assert that from the
 * outside, by parsing bodies that carry a forged one.
 */
describe("the write schemas", () => {
	it("strip an author from every payload that could carry one", () => {
		// Every input that names a thread or a board is a place a hand-written request might put an
		// author. None of these schemas declares one, and all of them are closed objects, so the field
		// is dropped before a handler sees it.
		const forged = {
			authorId: "orion",
			creatorId: "orion",
			principalId: "orion",
		};
		const cases = [
			{ schema: appendMessageInput, body: { threadId: "t", text: "x" } },
			{ schema: createThreadInput, body: { boardId: "b", title: "T" } },
			{
				schema: addResourceInput,
				body: {
					boardId: "b",
					name: "n",
					url: "https://example.com/x",
					description: "d",
				},
			},
			// The closed set since 10a: a status move is validated against the two members, so a fixture using
			// arbitrary strings would be testing a schema this build no longer has.
			{
				schema: moveStatusInput,
				body: { threadId: "t", from: "open", to: "resolved" },
			},
			{ schema: acknowledgeInput, body: { threadId: "t", upTo: 1 } },
			{ schema: simulateIncomingInput, body: { threadId: "t" } },
		] as const;

		for (const { schema, body } of cases) {
			const parsed = schema.parse({ ...body, ...forged });
			expect(Object.keys(parsed)).not.toContain("authorId");
			expect(Object.keys(parsed)).not.toContain("creatorId");
			expect(Object.keys(parsed)).not.toContain("principalId");
		}
	});

	it("refuse a malformed body before anything reaches the store", () => {
		// Each of these is a shape a hand-written request could produce, and each must be refused at
		// the boundary rather than becoming an undefined inside a store call.
		expect(() => appendMessageInput.parse({ text: "no thread" })).toThrow();
		expect(() => appendMessageInput.parse({ threadId: "t" })).toThrow();
		expect(() =>
			appendMessageInput.parse({ threadId: "", text: "x" }),
		).toThrow();
		expect(() =>
			createThreadInput.parse({ boardId: "b", title: "" }),
		).toThrow();
		expect(() => acknowledgeInput.parse({ threadId: "t", upTo: -1 })).toThrow();
		expect(() =>
			acknowledgeInput.parse({ threadId: "t", upTo: 1.5 }),
		).toThrow();
		expect(() => setConnectionInput.parse({ connected: "yes" })).toThrow();
		// The enum is closed: a resource of an invented type is refused rather than carried.
		expect(() =>
			addResourceInput.parse({
				boardId: "b",
				name: "n",
				url: "https://example.com/x",
				type: "Spreadsheet",
				description: "d",
			}),
		).toThrow();
	});

	it("carry the fields the interface's own inputs carry", () => {
		// The complement of the test above: what MUST survive. A schema stricter than the interface
		// would break the client, and the failure would appear as a refused user action rather than as
		// a type error.
		expect(
			appendMessageInput.parse({
				threadId: "t",
				text: "hello",
				references: [{ resourceId: "r" }],
				relation: { type: "In response to", entryId: "e" },
				idempotencyKey: "k",
			}),
		).toEqual({
			threadId: "t",
			text: "hello",
			references: [{ resourceId: "r" }],
			relation: { type: "In response to", entryId: "e" },
			idempotencyKey: "k",
		});
		// An empty message is NOT refused here, deliberately: "Message cannot be empty" is the
		// domain's string and the store trims and refuses. Two places refusing one thing is how they
		// come to disagree.
		expect(appendMessageInput.parse({ threadId: "t", text: "   " }).text).toBe(
			"   ",
		);
	});

	it("allow an optional description a created board does not need", () => {
		expect(createBoardInput.parse({ name: "New board" })).toEqual({
			name: "New board",
		});
		expect(
			createBoardInput.parse({
				name: "New board",
				description: "Why it exists",
			}),
		).toEqual({ name: "New board", description: "Why it exists" });
	});
});
