import { describe, expect, it } from "vitest";
import {
	failureFamily,
	failureMessage,
	RelayboardRequestError,
} from "#/client/http";

/**
 * The client's reading of a refusal's family — and the test that fails if two of them collapse.
 *
 * 06c:19 and 06b:22 both ask for a permission refusal to be distinguishable from an unauthenticated
 * result. An earlier version of the classifier mapped **both** to `unresolved`, which meant a caller
 * could not tell "you may not" from "we do not know who you are" — two different instructions to a
 * reader, and two different things to do about them.
 *
 * The assertions below are against the strings the domain actually raises, not invented ones, so a
 * reworded domain message fails here rather than silently reclassifying a refusal.
 */
describe("the client's failure families", () => {
	it("reads a permission refusal as denied", () => {
		expect(
			failureFamily(
				new Error(
					"This participant does not hold the permission that action requires",
				),
			),
		).toBe("denied");
		expect(
			failureFamily(new Error("This participant is not a board member")),
		).toBe("denied");
		// 07b's bounds refusals are refusals of a known caller, not an absence of one.
		expect(
			failureFamily(
				new Error(
					"Cannot grant read:member: you do not hold it yourself, and a grant cannot exceed the granter's own permissions",
				),
			),
		).toBe("denied");
		expect(
			failureFamily(
				new Error(
					"admit:agent may only be granted to a human participant: admission and revocation are a person's decision",
				),
			),
		).toBe("denied");
	});

	it("reads an absent principal as unauthenticated, separately from denied", () => {
		expect(
			failureFamily(new Error("No principal alex in this workspace")),
		).toBe("unauthenticated");
		expect(
			failureFamily(
				new Error(
					"The bearer credential presented does not match any issued admission",
				),
			),
		).toBe("unauthenticated");
	});

	it("**does not collapse denied and unauthenticated together**", () => {
		// The regression this file exists for. Both errors go through the same mapping, and the two
		// answers must differ — an equality assertion would pass for the bug this replaces, so the
		// assertion is that they are NOT equal, plus each one's exact value above.
		const denied = failureFamily(
			new Error(
				"This participant does not hold the permission that action requires",
			),
		);
		const unauthenticated = failureFamily(
			new Error("No principal alex in this workspace"),
		);

		expect(denied).not.toBe(unauthenticated);
		expect(new Set([denied, unauthenticated]).size).toBe(2);
	});

	it("reads a missing object as unknown-object", () => {
		expect(failureFamily(new Error("Thread not found"))).toBe("unknown-object");
		expect(failureFamily(new Error("Board not found"))).toBe("unknown-object");
		expect(
			failureFamily(new Error("No such participant in this workspace")),
		).toBe("unknown-object");
	});

	it("reads a not-yet-served operation as unimplemented", () => {
		expect(
			failureFamily(
				new Error(
					"attachResource is not served in this build; it arrives with ticket 10a",
				),
			),
		).toBe("unimplemented");
	});

	it("defaults to validation, whose advice is safe to give about anything", () => {
		expect(failureFamily(new Error("Expected string, received number"))).toBe(
			"validation",
		);
		expect(failureFamily("a thrown string")).toBe("validation");
	});

	it("carries the family on the error it throws, so a caller can branch", () => {
		const error = new RelayboardRequestError("denied", "a message");

		expect(error).toBeInstanceOf(Error);
		expect(error.family).toBe("denied");
		expect(error.message).toBe("a message");
		expect(error.name).toBe("RelayboardRequestError");
	});

	it("has a message for every family, and they are all different", () => {
		// So a surface that speaks in its own voice has one sentence per family rather than inventing
		// one per call site.
		const families = [
			"denied",
			"unauthenticated",
			"validation",
			"unknown-object",
			"unimplemented",
		] as const;
		const messages = families.map((family) => failureMessage[family]);
		expect(messages.every((message) => message.length > 0)).toBe(true);
		expect(new Set(messages).size).toBe(families.length);
	});
});

describe("the classifier is on the path, not beside it", () => {
	it("attaches a family to what the HTTP client throws", async () => {
		// **The second half of the defect this file covers.** An earlier version exported
		// `failureFamily` and wrapped nothing, so the classification existed and was unreachable: every
		// operation threw the raw error. A call that cannot reach a server is the reachable case — its
		// failure must arrive as a `RelayboardRequestError`, not as a bare `Error`.
		const { createHttpClient } = await import("#/client/http");
		const client = createHttpClient();

		const failure = await client.listBoards().then(
			() => null,
			(error: unknown) => error,
		);

		expect(failure).toBeInstanceOf(Error);
		// Under `vitest run` the transport has no RPC to perform (06c: the plugin's transform belongs to
		// the build), so this is a transport failure rather than a server answer — which is exactly what
		// makes it the usable case here: it proves the wrapper is installed on the path.
		expect(
			(failure as { family?: string }).family,
			"the HTTP client threw without a family, so the classifier is not on the path",
		).toBeDefined();
	});
});
