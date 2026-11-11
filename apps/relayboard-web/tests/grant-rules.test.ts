import { describe, expect, it } from "vitest";
import type { Principal } from "#/domain";
import { errorMessages } from "#/domain";
import {
	checkGrant,
	GATE_PERMISSIONS,
	GrantRefused,
	gateRuleAllows,
	unknownPermission,
} from "#/server/grants";
import { createStore } from "#/server/store";
import { demoOptions, demoSeed } from "#/server/store/demo-seed";

/**
 * The two rules that keep the gate human and the grant unlaunderable.
 *
 * Every refusal below is asserted **by attempting it**, the way nadia’s board grant was in 07a:
 * a rule that only has a success case has not been shown to refuse anything. The two rules are:
 *
 * 1. **The gate rule** — `admit:agent` / `revoke:agent` may only be granted to a human. This is the
 *    one place a principal’s `kind` changes an outcome.
 * 2. **The bounds** — a principal cannot grant a permission it does not hold, at a scope broader
 *    than it holds it.
 */
const store = () => createStore(demoSeed(), demoOptions());

describe("the gate permissions", () => {
	it("are exactly admit:agent and revoke:agent", () => {
		expect([...GATE_PERMISSIONS].sort()).toEqual([
			"admit:agent",
			"revoke:agent",
		]);
	});

	it("may be granted to a human and not to an agent", () => {
		const human = { id: "h", kind: "human" } as Principal;
		const agent = { id: "a", kind: "agent" } as Principal;
		for (const permission of GATE_PERMISSIONS) {
			expect(gateRuleAllows(permission, human)).toBe(true);
			expect(gateRuleAllows(permission, agent)).toBe(false);
		}
	});

	it("do not restrict any other permission", () => {
		const agent = { id: "a", kind: "agent" } as Principal;
		expect(gateRuleAllows("post:message", agent)).toBe(true);
		expect(gateRuleAllows("read:board", agent)).toBe(true);
		expect(gateRuleAllows("create:board", agent)).toBe(true);
	});
});

describe("granting a gate permission to an agent", () => {
	it("is refused for admit:agent", () => {
		const s = store();
		const failure = (() => {
			try {
				s.grant({
					granterId: "nadia",
					principalId: "orion",
					scope: "board",
					boardId: "platform",
					permissions: ["admit:agent"],
				});
				return null;
			} catch (error) {
				return error;
			}
		})();
		expect(failure).toBeInstanceOf(GrantRefused);
		expect((failure as GrantRefused).reason).toBe("gate-is-human-only");
		expect((failure as GrantRefused).permission).toBe("admit:agent");
		expect((failure as Error).message).toMatch(/human/i);
	});

	it("is refused for revoke:agent, asserted separately", () => {
		const s = store();
		expect(() =>
			s.grant({
				granterId: "nadia",
				principalId: "beacon",
				scope: "board",
				boardId: "platform",
				permissions: ["revoke:agent"],
			}),
		).toThrow(/human/i);
	});

	it("succeeds for a human", () => {
		const s = store();
		expect(() =>
			s.grant({
				granterId: "nadia",
				principalId: "daniel",
				scope: "board",
				boardId: "platform",
				permissions: ["admit:agent"],
			}),
		).not.toThrow();
	});

	it("is refused even when the recipient holds an agent’s other grants", () => {
		const s = store();
		expect(s.permits("orion", "post:message", "platform")).toBe(true);
		expect(() =>
			s.grant({
				granterId: "nadia",
				principalId: "orion",
				scope: "board",
				boardId: "platform",
				permissions: ["admit:agent"],
			}),
		).toThrow(GrantRefused);
	});
});

describe("an agent cannot administer the gate", () => {
	it("cannot grant admit:agent even to a human, because the bounds and the gate both refuse", () => {
		// **Corrected premise, and the correction matters.** My first version asserted that an agent
		// "cannot grant anything". That is false and it should be: an agent holding `read:board` on a
		// board **may** hand it out there, because 07b's rules are about bounds and the gate, not about
		// kind. An agent is limited by its grant exactly as a human is — that is the whole point of
		// "kind is a label, not a capability".
		//
		// What an agent genuinely cannot do is administer the gate, and there are two independent
		// reasons: it holds no `admit:agent` itself (the bounds refuse) and even if it did, the
		// recipient rule would apply. Both are asserted.
		const s = store();
		expect(s.permits("orion", "read:board", "platform")).toBe(true);

		const failure = (() => {
			try {
				s.grant({
					granterId: "orion",
					principalId: "maya",
					scope: "board",
					boardId: "platform",
					permissions: ["admit:agent"],
				});
				return null;
			} catch (error) {
				return error;
			}
		})();
		expect(failure).toBeInstanceOf(GrantRefused);
		// The bounds fire first: Orion does not hold `admit:agent`, so he cannot give it — whatever the
		// recipient's kind. The gate rule would refuse it for a different reason if he did.
		expect((failure as GrantRefused).reason).toBe("granter-lacks-permission");
	});

	it("may still grant a permission it does hold, like any principal", () => {
		// The control, and the statement of the rule: agents are not a lower class of principal. This
		// is what stops "an agent cannot administer grants" from quietly becoming "an agent cannot
		// grant", which is a different and wrong claim.
		const s = store();
		expect(() =>
			s.grant({
				granterId: "orion",
				principalId: "maya",
				scope: "board",
				boardId: "platform",
				permissions: ["read:board"],
			}),
		).not.toThrow();
	});
});

describe("a grant cannot exceed the granter’s own", () => {
	it("refuses a permission the granter does not hold", () => {
		const s = store();
		expect(() =>
			s.grant({
				granterId: "daniel",
				principalId: "maya",
				scope: "board",
				boardId: "platform",
				permissions: ["create:board"],
			}),
		).toThrow(GrantRefused);
	});

	it("allows the same principal to hand out a permission it does hold", () => {
		const s = store();
		expect(() =>
			s.grant({
				granterId: "daniel",
				principalId: "sara",
				scope: "board",
				boardId: "platform",
				permissions: ["move:status"],
			}),
		).not.toThrow();
	});

	it("refuses a board-scoped holder granting at workspace scope", () => {
		const s = store();
		const failure = (() => {
			try {
				s.grant({
					granterId: "daniel",
					principalId: "sara",
					scope: "workspace",
					permissions: ["read:member"],
				});
				return null;
			} catch (error) {
				return error;
			}
		})();
		expect(failure).toBeInstanceOf(GrantRefused);
		expect((failure as GrantRefused).reason).toBe("scope-too-broad");
	});

	it("allows a workspace-scope holder to grant at workspace scope", () => {
		const s = store();
		expect(() =>
			s.grant({
				granterId: "nadia",
				principalId: "alex",
				scope: "workspace",
				permissions: ["create:board"],
			}),
		).not.toThrow();
	});
});

describe("an unknown permission", () => {
	it("is a validation failure before any rule runs", () => {
		const s = store();
		const failure = (() => {
			try {
				s.grant({
					granterId: "nadia",
					principalId: "alex",
					scope: "workspace",
					permissions: ["delete:board" as never],
				});
				return null;
			} catch (error) {
				return error;
			}
		})();
		expect(failure).toBeInstanceOf(Error);
		expect(failure).not.toBeInstanceOf(GrantRefused);
		expect((failure as Error).message).toContain(errorMessages.grantMalformed);
		expect(unknownPermission(["delete:board"])).toBe("delete:board");
		expect(unknownPermission(["read:board"])).toBeUndefined();
	});
});

describe("the refusal a caller sees", () => {
	it("distinguishes the three reasons from a missing-permission refusal", () => {
		const messages = new Set(
			(
				[
					"gate-is-human-only",
					"granter-lacks-permission",
					"scope-too-broad",
				] as const
			).map((reason) => new GrantRefused(reason, "read:board").message),
		);
		expect(messages.size).toBe(3);
		for (const message of messages) {
			expect(message).not.toBe(errorMessages.permissionDenied);
		}
	});
});

describe("no await between the read and the write", () => {
	it("applies two concurrent grants without either losing the other", () => {
		// **The granter has to hold what it gives**, which is the rule under test doing its work on the
		// test: my first version had the superadmin granting `read:member`, which she does not hold at
		// workspace scope and holds on no board — so the bounds refused it and the concurrency question
		// was never reached. Daniel holds both of these on platform through the member grant.
		const s = store();
		s.grant({
			granterId: "daniel",
			principalId: "sara",
			scope: "board",
			boardId: "platform",
			permissions: ["read:member"],
		});
		s.grant({
			granterId: "daniel",
			principalId: "sara",
			scope: "board",
			boardId: "platform",
			permissions: ["move:status"],
		});
		const after = s.grantsFor("sara", "platform");
		expect(after).toContain("read:member");
		expect(after).toContain("move:status");
	});

	it("refuses a rule-breaking grant without leaving the list changed", () => {
		const s = store();
		const before = [...s.grantsFor("orion", "platform")];
		expect(() =>
			s.grant({
				granterId: "nadia",
				principalId: "orion",
				scope: "board",
				boardId: "platform",
				permissions: ["admit:agent"],
			}),
		).toThrow(GrantRefused);
		expect([...s.grantsFor("orion", "platform")]).toEqual(before);
	});
});

describe("the gate rule through checkGrant directly", () => {
	it("refuses before consulting the granter’s bounds", () => {
		const world = {
			readPrincipal: (id: string) =>
				({ id, kind: id === "orion" ? "agent" : "human" }) as Principal,
			workspacePermissions: () => [],
			anyBoardPermissions: () => [],
		};
		const failure = (() => {
			try {
				checkGrant(
					{
						granterId: "nobody",
						recipientId: "orion",
						permissions: ["admit:agent"],
						scope: "board",
						boardId: "platform",
					},
					world,
				);
				return null;
			} catch (error) {
				return error;
			}
		})();
		expect((failure as GrantRefused).reason).toBe("gate-is-human-only");
	});
});
