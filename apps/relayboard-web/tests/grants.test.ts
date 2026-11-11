import { describe, expect, it } from "vitest";
import type { PermissionName } from "#/domain";
import { errorMessages } from "#/domain";
import {
	impliedBy,
	isWellFormedGrant,
	permissionNames,
	satisfies,
} from "#/domain/grants";

/**
 * The permission vocabulary, its scopes, and the two rules that keep it from becoming a
 * pile of conditionals.
 *
 * Spec L418-423 is the authority for the names and L425 for the one implication; both are asserted
 * as literal lists so "covers every action" and "nothing else is implied" are checkable rather than
 * judged.
 */

describe("the vocabulary", () => {
	it("equals the four rows of spec L418-423 exactly", () => {
		// The literal list, transcribed from the table. A name added here without a row in the spec —
		// or a row without a name — fails this comparison rather than slipping into a later ticket.
		expect([...permissionNames].sort()).toEqual(
			[
				// workspace
				"read:board",
				"create:board",
				"admit:agent",
				"revoke:agent",
				"grant:permission",
				// board
				"update:board",
				"create:thread",
				"add:resource",
				"read:member",
				// thread
				"read:thread",
				"post:message",
				"move:status",
				"add:artifact",
				"acknowledge:thread",
				// resource
				"read:resource",
			].sort(),
		);
		// Fifteen names, five distinct objects' worth, with four appearing on two rows — which is why
		// the count is fifteen and not seventeen.
		expect(permissionNames).toHaveLength(15);
		expect(new Set(permissionNames).size).toBe(15);
	});

	it("has no unnamed permission and no name outside the syntax", () => {
		for (const name of permissionNames) {
			expect(name).toMatch(/^[a-z]+:[a-z]+$/);
		}
	});
});

describe("the one implication", () => {
	it("is read:board yielding read:thread and read:resource, and nothing else", () => {
		// Spec L425: reading a container is not separable from reading what it contains, and that is
		// the ONLY implication. The map having one key is the assertion.
		expect(Object.keys(impliedBy)).toEqual(["read:board"]);
		expect([...(impliedBy["read:board"] ?? [])].sort()).toEqual([
			"read:resource",
			"read:thread",
		]);
	});

	it("satisfies itself", () => {
		for (const name of permissionNames) {
			expect(satisfies([name], name)).toBe(true);
		}
	});

	it("does not imply a write from a read, in any direction", () => {
		// The four pairs 07a:15 names, asserted independently against the same held permission list so
		// a failure names which pair broke.
		expect(satisfies(["read:board"], "post:message")).toBe(false);
		expect(satisfies(["read:board"], "create:thread")).toBe(false);
		expect(satisfies(["read:board"], "read:member")).toBe(false);
		expect(satisfies(["read:resource"], "add:resource")).toBe(false);
		expect(satisfies(["read:thread"], "post:message")).toBe(false);
		expect(satisfies(["acknowledge:thread"], "move:status")).toBe(false);
	});

	it("never implies in reverse: a held read:thread does not yield read:board", () => {
		// The map is directional. A reverse lookup would make every thread reader a board reader,
		// which is the inference spec L425 spends a sentence forbidding.
		expect(satisfies(["read:thread"], "read:board")).toBe(false);
		expect(satisfies(["read:resource"], "read:board")).toBe(false);
	});

	it("yields through the implication when the held permission is the container's", () => {
		expect(satisfies(["read:board"], "read:thread")).toBe(true);
		expect(satisfies(["read:board"], "read:resource")).toBe(true);
	});

	it("is satisfied by any member of a list, not only the first", () => {
		expect(satisfies(["post:message", "read:board"], "read:resource")).toBe(
			true,
		);
		expect(satisfies(["post:message", "read:board"], "move:status")).toBe(
			false,
		);
	});
});

describe("scopes", () => {
	it("refuses a grant with no scope it can act on", () => {
		// "No scope" is not a third state: an unscoped grant is a validation failure (07a:14).
		expect(
			isWellFormedGrant({
				scope: "all" as unknown as "board",
				permissions: ["read:board"],
			}),
		).toBe(false);
	});

	it("refuses a board grant that names no board", () => {
		expect(
			isWellFormedGrant({ scope: "board", permissions: ["read:board"] }),
		).toBe(false);
		expect(
			isWellFormedGrant({
				scope: "board",
				boardId: "",
				permissions: ["read:board"],
			}),
		).toBe(false);
	});

	it("refuses a workspace grant that names a board", () => {
		// The two scopes are exclusive: a grant that claimed both would answer two questions with one
		// record, and a caller could not tell which it had been given.
		expect(
			isWellFormedGrant({
				scope: "workspace",
				boardId: "platform",
				permissions: ["read:board"],
			}),
		).toBe(false);
	});

	it("refuses a permission outside the fifteen", () => {
		expect(
			isWellFormedGrant({
				scope: "board",
				boardId: "platform",
				permissions: ["delete:board" as PermissionName],
			}),
		).toBe(false);
	});

	it("accepts the two well-formed shapes", () => {
		expect(
			isWellFormedGrant({ scope: "workspace", permissions: ["create:board"] }),
		).toBe(true);
		expect(
			isWellFormedGrant({
				scope: "board",
				boardId: "platform",
				permissions: ["read:board", "post:message"],
			}),
		).toBe(true);
		// An empty permission list is well formed: it is a grant that grants nothing, which is a
		// legitimate state (a principal admitted but given no capability yet).
		expect(
			isWellFormedGrant({
				scope: "board",
				boardId: "platform",
				permissions: [],
			}),
		).toBe(true);
	});
});

describe("the refusal string", () => {
	it("is distinct from the three the store already documents", () => {
		// 07a:18: a permission refusal must be distinguishable from a validation failure and from an
		// unauthenticated result. Asserted as string inequality rather than by reading the code.
		const refusal = errorMessages.permissionDenied;
		expect(refusal).not.toBe(errorMessages.messageEmpty);
		expect(refusal).not.toBe(errorMessages.threadNotFound);
		expect(refusal).not.toBe(errorMessages.notABoardMember);
		expect(refusal).not.toBe(errorMessages.boardNotFound);
		expect(refusal).not.toBe(errorMessages.grantMalformed);
		// And it names what is missing without naming which permission: the permission travels beside
		// it, so the string stays stable.
		expect(refusal).toMatch(/permission/);
	});
});
