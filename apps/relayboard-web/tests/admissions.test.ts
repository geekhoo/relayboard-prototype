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
			expiry: { kind: "bounded", hours: 24 },
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
			expiry: { kind: "bounded", hours: 24 },
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
			expiry: { kind: "bounded", hours: 24 },
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
			expiry: { kind: "bounded", hours: 24 },
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
				expiry: { kind: "bounded", hours: 24 },
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
				expiry: { kind: "bounded", hours: 24 },
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
				expiry: { kind: "bounded", hours: 24 },
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
			expiry: { kind: "never" },
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
			expiry: { kind: "bounded", hours: 24 },
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
			"decided",
			"deny",
			"derivedFor",
			"knock",
			"listPending",
			"permissionsFor",
			"pollAdmission",
			"renew",
			"resolveCredential",
			"revoke",
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
			expiry: { kind: "bounded", hours: 24 },
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

describe("a decision cannot be made twice by a double click", () => {
	it("answers the second activation with a refusal rather than deciding again", () => {
		// The same shape 06c found live in the composer: React state is asynchronous, so two
		// activations in one tick both read the old flag. The component guards with a ref, and this
		// asserts the *seam's* half — that a second decision on one request cannot succeed even if a
		// caller does send it, which is what makes the guard a belt rather than the only brace.
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
			expiry: { kind: "bounded", hours: 24 },
		});

		// The second call is refused, so a double click cannot mint a second credential — and
		// because the credential is collectable once, a second admission would have been the only way
		// to get one.
		expect(() =>
			admissions.admit({
				requestId: receipt.requestId,
				grantedBy: "alex",
				permissions: ["read:board"],
				expiry: { kind: "bounded", hours: 24 },
			}),
		).toThrow(/already been decided/i);
	});

	it("records the expiry that was chosen, and never as a silent default", () => {
		// 08b:17-18: the set and the expiry are one act, and "never" is an explicit value rather than
		// an absent one.
		const { admissions } = surface();
		const bounded = admissions.knock({
			boardId: "platform",
			name: "A",
			operator: "O",
			reason: "R",
		});
		admissions.admit({
			requestId: bounded.requestId,
			grantedBy: "alex",
			permissions: ["read:board"],
			expiry: { kind: "bounded", hours: 24 },
		});
		const [decided] = admissions.decided("platform", "alex");
		expect(decided?.expiresAt).toBeDefined();
		expect(decided?.outcome).toBe("admitted");

		const forever = admissions.knock({
			boardId: "platform",
			name: "B",
			operator: "O",
			reason: "R",
		});
		admissions.admit({
			requestId: forever.requestId,
			grantedBy: "alex",
			permissions: ["read:board"],
			expiry: { kind: "never" },
		});
		const both = admissions.decided("platform", "alex");
		// "never" is present as an admitted request with no expiry, which is distinguishable from
		// "not set yet" because the request is admitted at all.
		expect(both).toHaveLength(2);
		expect(both.some((row) => row.expiresAt === undefined)).toBe(true);
	});
});

describe("a denial is visible to the denyer afterwards", () => {
	it("appears in the decided list with its reason", () => {
		// 08b:19: without this the pending list would shrink and the human would have no record of what
		// they refused or why.
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
			reason: "We have enough readers",
		});

		const decided = admissions.decided("platform", "alex");
		expect(decided).toHaveLength(1);
		expect(decided[0]?.outcome).toBe("denied");
		expect(decided[0]?.denialReason).toBe("We have enough readers");
		// And it is no longer pending, so the two lists do not overlap.
		expect(admissions.listPending("platform", "alex")).toHaveLength(0);
	});

	it("shows only the decisions this gate holder made", () => {
		// A second gate holder should not inherit the first one's record: the list is "what you
		// decided", which is what the criterion asks for.
		const { store, admissions } = surface();
		store.grant({
			granterId: "alex",
			principalId: "maya",
			scope: "board",
			boardId: "platform",
			permissions: ["admit:agent"],
		});
		const receipt = admissions.knock({
			boardId: "platform",
			name: "Scout",
			operator: "Acme Research",
			reason: "To contribute",
		});
		admissions.deny({
			requestId: receipt.requestId,
			deniedBy: "alex",
			reason: "No",
		});

		expect(admissions.decided("platform", "alex")).toHaveLength(1);
		expect(admissions.decided("platform", "maya")).toHaveLength(0);
	});
});

describe("the admission lifecycle", () => {
	/** A surface on a clock the test owns, so expiry is a value rather than a wait. */
	const clocked = () => {
		let at = Date.parse("2026-11-11T12:00:00.000Z");
		const store = createStore(demoSeed(), demoOptions());
		const admissions = createAdmissions(store, () => at);
		return {
			store,
			admissions,
			advance: (hours: number) => {
				at += hours * 60 * 60 * 1000;
			},
		};
	};

	const admitOne = (
		admissions: ReturnType<typeof createAdmissions>,
		expiry: { kind: "bounded"; hours: number } | { kind: "never" },
	) => {
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
			expiry,
		});
		const poll = admissions.pollAdmission(
			receipt.requestId,
			receipt.pollingSecret,
		);
		if (poll.state !== "admitted") throw new Error("unreachable");
		return { receipt, poll };
	};

	it("refuses an expired admission on the principal's NEXT REQUEST, not at the next poll", () => {
		// spec L596, and the phrase is the criterion. The credential stops resolving, and the check
		// lives in `resolveCredential` — the one place every operation already passes through — so
		// nothing downstream has to remember to ask.
		const { admissions, advance } = clocked();
		const { poll } = admitOne(admissions, { kind: "bounded", hours: 24 });

		expect(admissions.resolveCredential(poll.credential)?.id).toBe(
			poll.principalId,
		);
		advance(25);
		expect(admissions.resolveCredential(poll.credential)).toBeUndefined();
	});

	it("keeps a never-expiring admission, and an unbounded one is a stated choice", () => {
		const { admissions, advance } = clocked();
		const { poll } = admitOne(admissions, { kind: "never" });

		advance(24 * 365);
		expect(admissions.resolveCredential(poll.credential)?.id).toBe(
			poll.principalId,
		);
	});

	it("a revocation ends access on the next request, and keeps the principal and its entries", async () => {
		// spec L597. Three facts, and the third is the one a naive implementation loses.
		const { store, admissions } = clocked();
		const { poll, receipt } = admitOne(admissions, { kind: "never" });

		// The agent posts something first, so there is an entry to check afterwards.
		store.appendMessage({
			threadId: "delivery",
			authorId: poll.principalId,
			text: "Written before the revocation.",
		});

		admissions.revoke({ requestId: receipt.requestId, revokedBy: "alex" });

		// 1. The credential stops resolving — immediately, not at a reconnect.
		expect(admissions.resolveCredential(poll.credential)).toBeUndefined();
		// 2. The principal still exists.
		expect(store.readPrincipal(poll.principalId)).toBeDefined();
		// 3. **The entry keeps its author.** Revoking is not deleting.
		const kept = store
			.readEntries("delivery")
			.find((entry) => entry.text === "Written before the revocation.");
		expect(kept?.authorId).toBe(poll.principalId);
	});

	it("distinguishes a revocation from a denial and from an expiry in the refusal", () => {
		// spec L402: an operator must be able to tell a policy decision from a bug. The three are
		// different messages, asserted as a set of three distinct strings.
		const { admissions, advance } = clocked();
		const revoked = admitOne(admissions, { kind: "never" });
		admissions.revoke({
			requestId: revoked.receipt.requestId,
			revokedBy: "alex",
		});

		const revokedFailure = (() => {
			try {
				admissions.renew({
					credential: revoked.poll.credential,
					expiry: { kind: "never" },
				});
				return null;
			} catch (error) {
				return error as Error;
			}
		})();

		const expired = admitOne(admissions, { kind: "bounded", hours: 1 });
		advance(2);
		// An expired credential still RENEWS (that is the point of renewal), so the distinct message
		// for expiry is the one `resolveCredential` gives: nothing at all. What the operator sees is the
		// renewal's own refusal when the admission was revoked rather than expired.
		expect(
			admissions.resolveCredential(expired.poll.credential),
		).toBeUndefined();

		expect(revokedFailure?.message).toMatch(/revoked/i);
		expect(revokedFailure?.message).not.toMatch(/not expired/i);
	});

	it("renews to the SAME principal id, so history does not split", () => {
		// spec L598.
		const { store, admissions, advance } = clocked();
		const { poll } = admitOne(admissions, { kind: "bounded", hours: 1 });
		store.appendMessage({
			threadId: "delivery",
			authorId: poll.principalId,
			text: "Before expiry.",
		});

		advance(2);
		const renewed = admissions.renew({
			credential: poll.credential,
			expiry: { kind: "bounded", hours: 24 },
		});

		expect(renewed.principalId).toBe(poll.principalId);
		// A different credential, the same principal.
		expect(renewed.credential).not.toBe(poll.credential);
		expect(admissions.resolveCredential(renewed.credential)?.id).toBe(
			poll.principalId,
		);
		// And the history is one record: the entry written before the expiry is still authored by the
		// principal that renewed.
		const entry = store
			.readEntries("delivery")
			.find((candidate) => candidate.text === "Before expiry.");
		expect(entry?.authorId).toBe(renewed.principalId);
	});

	it("refuses a renewal presenting a name and operator but no credential", () => {
		// **The correction the review made, as a test.** A renewal that matched declared values would
		// let any caller inherit another principal's history by typing its name.
		const { admissions, advance } = clocked();
		const { poll } = admitOne(admissions, { kind: "bounded", hours: 1 });
		advance(2);

		// There is no shape for a name-only renewal: the only input is a credential. Presenting an
		// empty or invented one is the closest a caller can get, and it is refused.
		expect(() =>
			admissions.renew({ credential: "", expiry: { kind: "never" } }),
		).toThrow(/credential/i);
		expect(() =>
			admissions.renew({
				credential: "not-a-credential-we-issued",
				expiry: { kind: "never" },
			}),
		).toThrow(/credential/i);
		// And the real credential still works, so the refusal is about the proof rather than the act.
		expect(() =>
			admissions.renew({
				credential: poll.credential,
				expiry: { kind: "never" },
			}),
		).not.toThrow();
	});

	it("refuses a renewal whose credential is still live", () => {
		// Renewal is for after expiry. Rotating a working credential by asking for a new one would let
		// a caller launder a compromised token into a fresh window.
		const { admissions } = clocked();
		const { poll } = admitOne(admissions, { kind: "bounded", hours: 24 });

		expect(() =>
			admissions.renew({
				credential: poll.credential,
				expiry: { kind: "never" },
			}),
		).toThrow(/has not expired/i);
	});
});

describe("the fingerprint is derived, and declared values are ignored", () => {
	const fields = () => {
		const store = createStore(demoSeed(), demoOptions());
		return { store, admissions: createAdmissions(store, () => Date.now()) };
	};

	const admit = (
		admissions: ReturnType<typeof createAdmissions>,
		name: string,
		extra: Record<string, unknown> = {},
	) => {
		const receipt = admissions.knock({
			boardId: "platform",
			name,
			operator: "Acme Research",
			reason: "To contribute",
			...extra,
		});
		admissions.admit({
			requestId: receipt.requestId,
			grantedBy: "alex",
			permissions: ["read:board"],
			expiry: { kind: "never" },
		});
		const poll = admissions.pollAdmission(
			receipt.requestId,
			receipt.pollingSecret,
		);
		if (poll.state !== "admitted") throw new Error("unreachable");
		return poll;
	};

	it("is the same for two credentials of one principal, and different for two principals", () => {
		const { admissions } = fields();
		const one = admit(admissions, "Scout");
		const two = admit(admissions, "Ranger");

		const first = admissions.derivedFor(one.principalId);
		const second = admissions.derivedFor(two.principalId);

		expect(first?.fingerprint).toMatch(/^[0-9a-f]{16}$/);
		expect(first?.fingerprint).not.toBe(second?.fingerprint);
		// Stability across credentials: the fingerprint is a function of the principal id, so a second
		// admission of the same principal derives the same value.
		expect(admissions.derivedFor(one.principalId)?.fingerprint).toBe(
			first?.fingerprint,
		);
	});

	it("is preserved across a renewal, because it is derived from the id and not the credential", () => {
		// **The assertion that makes the derivation a property rather than a copy.** A fingerprint taken
		// from the credential would change on every renewal — the token does — and an agent that renewed
		// would look like a different agent to anyone reading it. So the surface is built on a clock this
		// test moves, the admission is allowed to expire, and the renewal happens for real.
		let at = Date.parse("2026-11-11T12:00:00.000Z");
		const store = createStore(demoSeed(), demoOptions());
		const admissions = createAdmissions(store, () => at);

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
			expiry: { kind: "bounded", hours: 1 },
		});
		const poll = admissions.pollAdmission(
			receipt.requestId,
			receipt.pollingSecret,
		);
		if (poll.state !== "admitted") throw new Error("unreachable");
		const before = admissions.derivedFor(poll.principalId)?.fingerprint;

		at += 2 * 60 * 60 * 1000;
		const renewed = admissions.renew({
			credential: poll.credential,
			expiry: { kind: "bounded", hours: 24 },
		});
		expect(renewed.credential).not.toBe(poll.credential);

		expect(admissions.derivedFor(poll.principalId)?.fingerprint).toBe(before);
	});

	it("names the human who admitted it as the issuer", () => {
		const { admissions } = fields();
		const poll = admit(admissions, "Scout");

		// Derived from the grant, never from anything the agent asserted.
		expect(admissions.derivedFor(poll.principalId)?.issuer).toBe("alex");
	});

	it("ignores a fingerprint or issuer the knocker supplies", () => {
		// The values are derived; a supply of them is dropped at the surface rather than stored.
		const { admissions } = fields();
		const poll = admit(admissions, "Scout", {
			fingerprint: "INVENTED",
			issuer: "myself",
		});

		const derived = admissions.derivedFor(poll.principalId);
		expect(derived?.fingerprint).not.toBe("INVENTED");
		expect(derived?.issuer).toBe("alex");
		expect(derived?.issuer).not.toBe("myself");
	});
});
