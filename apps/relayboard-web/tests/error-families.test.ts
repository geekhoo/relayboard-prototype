import { describe, expect, it } from "vitest";
import { failureFamily, RelayboardRequestError } from "#/client/http";

/**
 * The client's reading of a refusal's family.
 *
 * 06c:19 was half-satisfied: the server has carried stable codes since 06c and the client cast every
 * response without looking. 07a's refusals are what make the distinction worth making, so the mapping
 * is asserted here against the strings the domain actually raises — not against invented ones, so a
 * reworded domain message fails this test rather than silently reclassifying a refusal.
 */
describe("the client's failure families", () => {
	it("reads a permission refusal as unresolved", () => {
		// The string the domain owns (src/domain/errors.ts), raised by PermissionDenied.
		expect(
			failureFamily(
				new Error(
					"This participant does not hold the permission that action requires",
				),
			),
		).toBe("unresolved");
		// And the older board-membership refusal, which is the same family for a caller.
		expect(
			failureFamily(new Error("This participant is not a board member")),
		).toBe("unresolved");
	});

	it("reads a missing object as unknown-object", () => {
		expect(failureFamily(new Error("Thread not found"))).toBe("unknown-object");
		expect(failureFamily(new Error("Board not found"))).toBe("unknown-object");
		expect(
			failureFamily(new Error("No entry seed-delivery-5 in this workspace")),
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
		// "Retrying unchanged will fail again" is true of anything nobody anticipated, which is why it
		// is the default rather than a guess at something more specific.
		expect(failureFamily(new Error("Expected string, received number"))).toBe(
			"validation",
		);
		expect(failureFamily("a thrown string")).toBe("validation");
	});

	it("carries the family on the error it throws, so a caller can branch", () => {
		const error = new RelayboardRequestError("unresolved", "a message");

		expect(error).toBeInstanceOf(Error);
		expect(error.family).toBe("unresolved");
		expect(error.message).toBe("a message");
		expect(error.name).toBe("RelayboardRequestError");
	});
});
