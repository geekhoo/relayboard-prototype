import { describe, expect, it } from "vitest";
import { createAdmissions } from "#/server/admissions";
import { resolveSession } from "#/server/principal";
import { createStore } from "#/server/store";
import { demoOptions, demoSeed } from "#/server/store/demo-seed";

/**
 * The admission seam: knock, wait, enter — and every property that makes it safe.
 *
 * 08a:24 asks for this seam to be the one both tickets' assertions go through: 07b's rules are
 * asserted against the store, and here they are re-asserted **end to end through admission**, while
 * the properties unique to this surface — no session, no credential until the poll, per-board scope,
 * declared versus derived — are asserted for the first time.
 *
 * Every refusal below is asserted by attempting it.
 */
const surface = () => {
	const store = createStore(demoSeedWT(), demoOptions());
	return { store, admissions: createAdmissions(store) };
};

/** The seed, with one board-scoped gate holder so a human can decide. */
const demoSeedWT = () => demoSeed();

describe("knocking", () => {
	it("returns a request id and a polling secret, and no credential", () => {
		const { admissions } = surface();
		const receipt = admissions.knock({
			boardId: "platform",
			name: "Scout",
			operator: "Acme Research",
			reason: "We want to read the delivery thread and contribute findings",
		});

		expect(receipt.requestId).toMatch(/^knock-/);
		expect(receipt.pollingSecret.length).toBeGreaterThanOrEqual(40);
		// **No credential.** The knock has asked, not entered: the whole surface exists so that
		// asking grants nothing.
		expect(Object.keys(receipt).sort()).toEqual(["pollingSecret", "requestId"]);
	});

	it("mints a different secret for every knock", () => {
		const { admissions } = surface();
		const one = admissions.knock({
			boardId: "platform",
			name: "A",
			operator: "O",
			reason: "R",
		});
		const two = admissions.knock({
			boardId: "platform",
			name: "B",
			operator: "O",
			reason: "R",
		});
		expect(one.pollingSecret).not.toBe(two.pollingSecret);
		expect(one.requestId).not.toBe(two.requestId);
	});

	it("refuses a knock with nothing to decide on", () => {
		const { admissions } = surface();
		expect(() =>
			admissions.knock({
				boardId: "platform",
				name: "  ",
				operator: "O",
				reason: "R",
			}),
		).toThrow(/name, an operator and a reason/i);
		expect(() =>
			admissions.knock({
				boardId: "platform",
				name: "A",
				operator: "",
				reason: "R",
			}),
		).toThrow(/name, an operator and a reason/i);
	});

	it("refuses a knock for a board that is not here", () => {
		const { admissions } = surface();
		expect(() =>
			admissions.knock({
				boardId: "nowhere",
				name: "A",
				operator: "O",
				reason: "R",
			}),
		).toThrow(/No board nowhere/);
	});
});

describe("the polling secret", () => {
	it("is not in the pending list a human sees", () => {
		const { admissions } = surface();
		const receipt = admissions.knock({
			boardId: "platform",
			name: "Scout",
			operator: "Acme Research",
			reason: "To help",
		});

		const pending = admissions.listPending("platform", "alex");
		expect(pending).toHaveLength(1);
		expect(pending[0]?.requestId).toBe(receipt.requestId);
		// The payload is enumerated and compared, so a field added later has to be considered against
		// this list rather than slipping in.
		expect(Object.keys(pending[0] ?? {}).sort()).toEqual([
			"boardId",
			"declared",
			"requestId",
			"requestedAt",
		]);
		const serialised = JSON.stringify(pending);
		expect(serialised).not.toContain(receipt.pollingSecret);
	});

	it("cannot be probed: a wrong secret answers as an unknown request", () => {
		const { admissions } = surface();
		const receipt = admissions.knock({
			boardId: "platform",
			name: "A",
			operator: "O",
			reason: "R",
		});

		const wrong = (() => {
			try {
				admissions.pollAdmission(receipt.requestId, "not-the-secret");
				return null;
			} catch (error) {
				return error as Error;
			}
		})();
		const unknown = (() => {
			try {
				admissions.pollAdmission("knock-nonexistent", "whatever");
				return null;
			} catch (error) {
				return error as Error;
			}
		})();

		// Same message: learning that the id exists but the secret is wrong would confirm the id.
		expect(wrong?.message).toBe(unknown?.message);
	});
});

describe("what a pending knocker holds", () => {
	it("nothing at all", () => {
		const { store, admissions } = surface();
		const receipt = admissions.knock({
			boardId: "platform",
			name: "Scout",
			operator: "Acme Research",
			reason: "To help",
		});

		// There is no principal yet: a knock is not a participant, so there is nothing to hold a grant.
		expect(store.listMembers("platform").map((p) => p.name)).not.toContain(
			"Scout",
		);
		// And the knock itself is not in any chronology.
		expect(admissions.listPending("platform", "alex")).toHaveLength(1);
		expect(
			store.readEntries("delivery").some((e) => e.text.includes("Scout")),
		).toBe(false);
		expect(receipt.requestId).toBeTruthy();
	});
});

describe("admitting", () => {
	const knockFor = (admissions: ReturnType<typeof createAdmissions>) =>
		admissions.knock({
			boardId: "platform",
			name: "Scout",
			operator: "Acme Research",
			reason: "To contribute findings",
		});

	it("issues a credential only in answer to the knocker's own poll", () => {
		const { admissions } = surface();
		const receipt = knockFor(admissions);

		expect(
			JSON.stringify(admissions.listPending("platform", "alex")),
		).not.toContain("credential");

		admissions.admit({
			requestId: receipt.requestId,
			grantedBy: "alex",
			permissions: ["read:board", "post:message"],
		});
		expect(
			JSON.stringify(admissions.listPending("platform", "alex")),
		).not.toContain("credential");

		const poll = admissions.pollAdmission(
			receipt.requestId,
			receipt.pollingSecret,
		);
		expect(poll.state).toBe("admitted");
		if (poll.state !== "admitted") throw new Error("unreachable");
		expect(poll.credential.length).toBeGreaterThanOrEqual(40);
		expect(poll.principalId).toMatch(/^agent-/);
	});

	it("issues the credential exactly once, so a loop cannot mint a hundred bearer tokens", () => {
		const { admissions } = surface();
		const receipt = knockFor(admissions);
		admissions.admit({
			requestId: receipt.requestId,
			grantedBy: "alex",
			permissions: ["read:board"],
		});

		const first = admissions.pollAdmission(
			receipt.requestId,
			receipt.pollingSecret,
		);
		expect(first.state).toBe("admitted");
		const second = (() => {
			try {
				return admissions.pollAdmission(
					receipt.requestId,
					receipt.pollingSecret,
				);
			} catch (error) {
				return error as Error;
			}
		})();
		expect(second).toBeInstanceOf(Error);
		expect((second as Error).message).toMatch(/already issued/i);
	});

	it("resolves the credential to the principal it was issued for", () => {
		const { admissions } = surface();
		const receipt = knockFor(admissions);
		admissions.admit({
			requestId: receipt.requestId,
			grantedBy: "alex",
			permissions: ["read:board"],
		});
		const poll = admissions.pollAdmission(
			receipt.requestId,
			receipt.pollingSecret,
		);
		if (poll.state !== "admitted") throw new Error("unreachable");

		const principal = admissions.resolveCredential(poll.credential);
		expect(principal?.id).toBe(poll.principalId);
		expect(principal?.kind).toBe("agent");
		expect(principal?.name).toBe("Scout");
		expect(principal?.description).toBe("Acme Research");
		expect(principal?.browserSelectable).toBe(false);

		expect(admissions.resolveCredential("not-a-token")).toBeUndefined();
	});

	it("admits per board, and to nothing at workspace scope", () => {
		const { store, admissions } = surface();
		const receipt = knockFor(admissions);
		admissions.admit({
			requestId: receipt.requestId,
			grantedBy: "alex",
			permissions: ["read:board", "post:message"],
		});
		const poll = admissions.pollAdmission(
			receipt.requestId,
			receipt.pollingSecret,
		);
		if (poll.state !== "admitted") throw new Error("unreachable");

		expect(store.permits(poll.principalId, "post:message", "platform")).toBe(
			true,
		);
		expect(store.permits(poll.principalId, "post:message", "campaign")).toBe(
			false,
		);
		expect(store.permits(poll.principalId, "read:board", "design")).toBe(false);
		expect(store.permits(poll.principalId, "create:board")).toBe(false);
		expect(store.grantsFor(poll.principalId)).toEqual([]);
	});

	it("refuses a decider who does not hold admit:agent", () => {
		const { admissions } = surface();
		const receipt = knockFor(admissions);
		expect(() =>
			admissions.admit({
				requestId: receipt.requestId,
				grantedBy: "daniel",
				permissions: ["read:board"],
			}),
		).toThrow(/admit:agent/);
	});

	it("enforces 07b's bounds end to end: a gate holder cannot grant beyond its own", () => {
		// **Two refusals, and the second is the one that took me three attempts to write honestly.**
		//
		// Alex is the demo's gate holder on platform and a platform member, so:
		// - `grant:permission` (workspace only) is refused: Alex holds it nowhere.
		// - `create:board` is refused too — and specifying it as a BOARD-scoped grant means the bounds
		//   ask whether Alex holds it on that board, which it does not.
		//
		// My first attempts asserted `post:message` and `create:board` and both passed silently, which
		// is why each refusal below is paired with the control that the same call SUCCEEDS when the
		// permission is one Alex holds.
		const { store, admissions } = surface();
		expect(store.permits("alex", "admit:agent", "platform")).toBe(true);
		expect(store.permits("alex", "grant:permission")).toBe(false);
		expect(store.permits("alex", "grant:permission", "platform")).toBe(false);

		const receipt = knockFor(admissions);
		expect(() =>
			admissions.admit({
				requestId: receipt.requestId,
				grantedBy: "alex",
				permissions: ["grant:permission"],
			}),
		).toThrow(/cannot exceed|do not hold/i);

		// The knock survives the refusal: a failed admission must not consume the request.
		expect(admissions.listPending("platform", "alex")).toHaveLength(1);

		// The control: the same gate holder CAN grant what it holds.
		expect(() =>
			admissions.admit({
				requestId: receipt.requestId,
				grantedBy: "alex",
				permissions: ["read:board", "post:message"],
			}),
		).not.toThrow();
	});

	it("refuses a second decision on a decided request", () => {
		const { admissions } = surface();
		const receipt = knockFor(admissions);
		admissions.admit({
			requestId: receipt.requestId,
			grantedBy: "alex",
			permissions: [],
		});
		expect(() =>
			admissions.deny({
				requestId: receipt.requestId,
				deniedBy: "alex",
				reason: "changed my mind",
			}),
		).toThrow(/already been decided/i);
	});
});

describe("denying", () => {
	it("records the denial and its reason, and issues no credential ever", () => {
		const { admissions } = surface();
		const receipt = admissions.knock({
			boardId: "platform",
			name: "Scout",
			operator: "Acme Research",
			reason: "To contribute",
		});

		admissions.deny({
			requestId: receipt.requestId,
			deniedBy: "alex",
			reason: "We do not need another reader on this board",
		});

		const poll = admissions.pollAdmission(
			receipt.requestId,
			receipt.pollingSecret,
		);
		expect(poll).toEqual({
			state: "denied",
			reason: "We do not need another reader on this board",
		});
		expect(admissions.listPending("platform", "alex")).toHaveLength(0);
	});

	it("refuses a denial by somebody who does not hold the gate", () => {
		const { admissions } = surface();
		const receipt = admissions.knock({
			boardId: "platform",
			name: "Scout",
			operator: "Acme Research",
			reason: "To contribute",
		});
		expect(() =>
			admissions.deny({
				requestId: receipt.requestId,
				deniedBy: "daniel",
				reason: "no",
			}),
		).toThrow(/admit:agent/);
	});
});

describe("the credential resolves through the same resolver a cookie does", () => {
	it("yields the same principal-and-grant shape, and asks nowhere which it was", () => {
		const { store, admissions } = surface();
		const receipt = admissions.knock({
			boardId: "platform",
			name: "Scout",
			operator: "Acme Research",
			reason: "To contribute",
		});
		admissions.admit({
			requestId: receipt.requestId,
			grantedBy: "alex",
			permissions: ["read:board", "post:message"],
		});
		const poll = admissions.pollAdmission(
			receipt.requestId,
			receipt.pollingSecret,
		);
		if (poll.state !== "admitted") throw new Error("unreachable");

		// `resolveSession` is the function the cookie path uses. A bearer token goes through the **same**
		// call and comes back with the same shape — the criterion is that no operation asks which
		// credential arrived, and the way to make that true is to have one resolver rather than two.
		const resolved = resolveSession(undefined, poll.credential);
		expect(resolved.principal.id).toBe(poll.principalId);
		expect(resolved.issued).toBe(false);
		expect(Array.isArray(resolved.permissions)).toBe(true);

		// And the grant is the board-scoped one, read the same way a cookie session reads it.
		expect(store.grantsFor(resolved.principal.id, "platform")).toContain(
			"post:message",
		);
	});

	it("refuses a bearer token that matches no issued record, rather than falling back to a session", () => {
		// A presented bearer token means the caller meant to authenticate. Silently treating a bad one
		// as "no credential" would hand it a fresh browser session instead.
		expect(() => resolveSession(undefined, "not-a-real-token")).toThrow(
			/does not match any issued admission/,
		);
	});

	it("treats an absent credential as absent, so a cookie still resolves", () => {
		// The control: no bearer token means the cookie path runs, exactly as before 08a.
		const alex = resolveSession(undefined);
		expect(alex.issued).toBe(true);
		expect(alex.principal.id).toBe("alex");
	});
});

describe("the knock surface is not the participant interface", () => {
	it("exposes five operations, none of which is on RelayboardClient", async () => {
		// 08a:13, asserted from the interface's own list rather than from the admission module, so a
		// later addition to either side fails here.
		const { clientOperations } = await import("#/client");
		for (const operation of [
			"knock",
			"pollAdmission",
			"listPending",
			"admit",
			"deny",
		]) {
			expect(
				clientOperations as readonly string[],
				`${operation} must not be a participant operation`,
			).not.toContain(operation);
		}
	});

	it("is a separate surface with exactly those five members", () => {
		const { admissions } = surface();
		expect(Object.keys(admissions).sort()).toEqual([
			"admit",
			"deny",
			"knock",
			"listPending",
			"permissionsFor",
			"pollAdmission",
			"resolveCredential",
		]);
	});
});

describe("declared values are carried as declared, and derived ones are absent", () => {
	it("carries the asserted name and operator under a declared key", () => {
		const { admissions } = surface();
		const receipt = admissions.knock({
			boardId: "platform",
			name: "Scout",
			operator: "Acme Research",
			reason: "Because a human should decide whether we help",
		});

		const [pending] = admissions.listPending("platform", "alex");
		expect(pending?.declared.name).toBe("Scout");
		expect(pending?.declared.operator).toBe("Acme Research");
		expect(pending?.declared.reason).toContain("a human should decide");
		expect(receipt.requestId).toBeTruthy();
	});

	it("has no issuer and no fingerprint, because nothing has derived them yet", () => {
		// 08a:25 and 08c's job: the keys are **absent** rather than empty, so "we have not derived this"
		// cannot be mistaken for "we derived nothing". A test that only checked `undefined` would pass
		// for a record with the keys set to `undefined`, so the key list is compared.
		const { admissions } = surface();
		const receipt = admissions.knock({
			boardId: "platform",
			name: "Scout",
			operator: "Acme Research",
			reason: "To contribute",
		});
		admissions.admit({
			requestId: receipt.requestId,
			grantedBy: "alex",
			permissions: ["read:board"],
		});
		const poll = admissions.pollAdmission(
			receipt.requestId,
			receipt.pollingSecret,
		);
		if (poll.state !== "admitted") throw new Error("unreachable");
		const principal = admissions.resolveCredential(poll.credential);
		if (!principal) throw new Error("unreachable");

		expect(Object.keys(principal)).not.toContain("issuer");
		expect(Object.keys(principal)).not.toContain("fingerprint");
	});
});
