/**
 * The pre-participant surface: an agent knocks, a human decides, a credential is issued.
 *
 * ## Why this is its own module and not members of `RelayboardClient`
 *
 * Spec L343-346 is explicit that admission is **not** on the participant interface, and the reason
 * is the shape of the caller: a knocker has no credential at all. Every operation on
 * `RelayboardClient` begins by resolving an acting principal, so putting `knock` there would mean a
 * participant operation every caller may reach without being one — exactly the boundary 07a spent
 * its effort making real.
 *
 * ## The three inversions this surface makes, and why each is correct
 *
 * 1. **No session is the normal case, not an error.** The knocker presents nothing, and the surface
 *    answers it. That is why `knock` and `pollAdmission` never call `actingPrincipal()`: doing so
 *    would *issue a browser session* to an entity that has not been admitted, which would make the
 *    agent a participant by knocking.
 * 2. **A knock is not an entry, and an admitted agent is not a member of anything it was not
 *    granted.** The knock lives in this module's own records, never in a thread's chronology; and
 *    `admit:agent` is the *gate* permission, so holding it confers nothing (AGENTS.md).
 * 3. **Declared is not derived.** The name, operator and reason a knocker submits are **asserted**,
 *    never verified, and they are stored in a field named `declared` rather than merged with the
 *    principal record. 08c derives an issuer and a fingerprint; until it does, those keys are
 *    absent rather than empty strings, so "we have not derived this" cannot be mistaken for "we
 *    derived nothing".
 *
 * ## The credential
 *
 * An opaque bearer token (spec L408 — explicitly not a JWT), high entropy, stored **only as a
 * hash**, compared in constant time, revoked by deleting the record. It is issued **only in answer
 * to the knocker's own poll** with the right secret: never in the pending list a human sees, never
 * in an error, never in a thread. That is the whole security property of the surface, so it is
 * asserted by listing what every other payload contains.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { BoardId, PermissionName, Principal, PrincipalId } from "#/domain";
import { registerAgentCredential } from "#/server/principal";
import type { Store } from "#/server/store";

/** What a knocker submits. All three strings are **declared**: asserted, never verified. */
export interface KnockInput {
	readonly boardId: BoardId;
	/** The display name the agent wants. Declared. */
	readonly name: string;
	/** The operator it names. Declared, and the one field a human weighs when deciding. */
	readonly operator: string;
	/** Why it wants in. Declared. */
	readonly reason: string;
}

/** What a knock answers: an identifier and a secret, and **no credential**. */
export interface KnockReceipt {
	readonly requestId: string;
	/** Returned once, to the knocker, and never again in any other payload. */
	readonly pollingSecret: string;
}

/** A pending request, as a human deciding it sees it. **No polling secret, and no credential.** */
export interface PendingRequest {
	readonly requestId: string;
	readonly boardId: BoardId;
	readonly declared: {
		readonly name: string;
		readonly operator: string;
		readonly reason: string;
	};
	readonly requestedAt: string;
}

/** What a poll answers. */
export type PollResult =
	| { readonly state: "pending" }
	| { readonly state: "denied"; readonly reason: string }
	| {
			readonly state: "admitted";
			/** Issued **only here**, in answer to the knocker's own poll with the right secret. */
			readonly credential: string;
			readonly principalId: PrincipalId;
	  };

/** A refusal the surface makes, distinct from a permission refusal. */
export class AdmissionRefused extends Error {
	readonly reason:
		| "unknown-request"
		| "denied"
		| "not-a-gate-holder"
		| "not-pending"
		| "already-collected";

	constructor(reason: AdmissionRefused["reason"], message: string) {
		super(message);
		this.name = "AdmissionRefused";
		this.reason = reason;
	}
}

/** A request as this module keeps it. The secret and the token are stored as hashes only. */
interface KnockRecord {
	requestId: string;
	boardId: BoardId;
	declared: PendingRequest["declared"];
	requestedAt: string;
	/** hash(pollingSecret). The secret itself is returned once and never stored. */
	pollHash: string;
	state: "pending" | "denied" | "admitted";
	denialReason?: string;
	/** Set on admission. The credential's hash; the token itself is never stored. */
	credentialHash?: string;
	principalId?: PrincipalId;
}

/** How the surface reaches the workspace. */
export interface AdmissionStore {
	readonly store: Store;
}

const hash = (value: string): string =>
	createHash("sha256").update(value).digest("hex");

/** A high-entropy opaque token. 32 bytes of CSPRNG, base64url — 43 characters, ~256 bits. */
const mint = (): string => randomBytes(32).toString("base64url");

/** Constant-time comparison of two hex digests. */
const sameHash = (left: string, right: string): boolean => {
	const a = Buffer.from(left, "hex");
	const b = Buffer.from(right, "hex");
	return a.length === b.length && timingSafeEqual(a, b);
};

/** The admission surface, over one workspace. */
export interface Admissions {
	/** An unauthenticated call. Returns an id and a secret, and no credential. */
	knock(input: KnockInput): KnockReceipt;
	/**
	 * The knocker's own poll.
	 *
	 * A wrong secret returns the **same** refusal as an unknown request, so the secret cannot be
	 * probed (08a:17): learning that a request id exists but the secret is wrong would confirm the id.
	 */
	pollAdmission(requestId: string, pollingSecret: string): PollResult;
	/**
	 * What a gate holder sees. No secrets, no credentials.
	 *
	 * Takes the reader because this is **the surface's own rule, not the participant table's**:
	 * `listPending` is not an operation on `RelayboardClient`, so it has no row in
	 * `operationPermissions` and routing it through `authorize` would mean inventing one. The gate is
	 * asked of the store directly — the same `admit:agent` lookup `admit` and `deny` use — so all
	 * three agree by construction.
	 */
	listPending(
		boardId: BoardId,
		readerId: PrincipalId,
	): readonly PendingRequest[];
	/** A human holding `admit:agent` admits, choosing the permission set. */
	admit(input: {
		readonly requestId: string;
		readonly grantedBy: PrincipalId;
		readonly permissions: readonly PermissionName[];
	}): void;
	/** A human holding `admit:agent` denies, with a reason the knocker will be told. */
	deny(input: {
		readonly requestId: string;
		readonly deniedBy: PrincipalId;
		readonly reason: string;
	}): void;
	/** Resolve a credential to the principal it was issued for, or `undefined`. */
	resolveCredential(token: string): Principal | undefined;
	/** What a principal holds, for the resolver to answer with. */
	permissionsFor(
		principalId: PrincipalId,
		boardId: BoardId,
	): readonly PermissionName[];
}

/**
 * Per-workspace admission state.
 *
 * **Keyed by the store, not by the process**, and that is a correction to my first version. I had it
 * on `globalThis` beside the store, reasoning about dev reloads — but a knock is addressed to a
 * workspace, and the store is the workspace. A knock whose board was reseeded would outlive the
 * boards it names, so an agent could poll and be admitted into a workspace that had forgotten the
 * request; and two stores, which 02b proves share nothing, would share their knocks.
 *
 * A `WeakMap` keyed on the store gives the right lifetime for free: the state lives exactly as long
 * as the workspace it belongs to, and the singleton store survives a dev reload, so this does too.
 */
const states = new WeakMap<Store, AdmissionsState>();

interface AdmissionsState {
	readonly knocks: Map<string, KnockRecord>;
	/** hash(credential) → principal id. The credential itself is never stored. */
	readonly issued: Map<string, PrincipalId>;
}

const stateFor = (store: Store): AdmissionsState => {
	const existing = states.get(store);
	if (existing) return existing;
	const created: AdmissionsState = {
		knocks: new Map<string, KnockRecord>(),
		issued: new Map<string, PrincipalId>(),
	};
	states.set(store, created);
	return created;
};

/**
 * Build the admission surface over a store.
 *
 * The knock records live **beside** the store rather than inside it, and that is deliberate: they are
 * not workspace content. A knock is not an entry, is not a thread, is not a resource, and must never
 * appear in any chronology (08a:22). Keeping them in the store would put them one enumeration away
 * from a list a reader sees; keeping them here means the only way out is the pending list, which is
 * written down and carries no secrets.
 *
 * They are process state, on `globalThis`, for the same reason the store is: the dev server reloads
 * modules, and a knock that vanished on a reload would be a knock a human could never decide.
 */
export const createAdmissions = (store: Store): Admissions => {
	const state = stateFor(store);
	// **The one registration that makes a credential resolvable.** The session resolver asks this
	// module rather than importing it, because the import would be a cycle; registering here means a
	// bearer token resolves from the moment the admission surface exists and to nobody before it —
	// which is the honest answer for a build with no admissions.
	registerAgentCredential({
		resolve: (token) => {
			const principalId = state.issued.get(hash(token));
			return principalId === undefined
				? undefined
				: store.readPrincipal(principalId);
		},
	});
	const knockRecords = state.knocks;
	const issued = state.issued;

	/** Whether a principal may decide an admission on a board — the gate rule's read half. */
	const isGateHolder = (principalId: PrincipalId, boardId: BoardId): boolean =>
		store.permits(principalId, "admit:agent", boardId) ||
		store.permits(principalId, "admit:agent");

	/** The record a request id names, and the refusal if it names none. */
	const requireKnock = (requestId: string): KnockRecord => {
		const record = knockRecords.get(requestId);
		if (!record) {
			throw new AdmissionRefused(
				"unknown-request",
				"No admission request matches those credentials",
			);
		}
		return record;
	};

	return {
		knock: (input) => {
			if (!store.readBoard(input.boardId)) {
				throw new AdmissionRefused(
					"unknown-request",
					`No board ${input.boardId} in this workspace`,
				);
			}
			const name = input.name.trim();
			const operator = input.operator.trim();
			const reason = input.reason.trim();
			if (name === "" || operator === "" || reason === "") {
				// A knock with no operator or no reason is not decidable: those three strings are what a gate
				// holder decides on, so an empty one would be a decision made on nothing.
				throw new AdmissionRefused(
					"unknown-request",
					"A knock needs a name, an operator and a reason: those three are what a gate holder decides on",
				);
			}
			const requestId = `knock-${mint()}`;
			const pollingSecret = mint();
			knockRecords.set(requestId, {
				requestId,
				boardId: input.boardId,
				declared: { name, operator, reason },
				requestedAt: new Date().toISOString(),
				pollHash: hash(pollingSecret),
				state: "pending",
			});
			// The secret is returned exactly once, and stored only as a hash.
			return { requestId, pollingSecret };
		},

		pollAdmission: (requestId, pollingSecret) => {
			const record = knockRecords.get(requestId);
			// **A wrong secret and an unknown request answer identically.** A different refusal would
			// confirm that the id exists, which is the one thing the secret is for (08a:17).
			if (!record || !sameHash(hash(pollingSecret), record.pollHash)) {
				throw new AdmissionRefused(
					"unknown-request",
					"No admission request matches those credentials",
				);
			}
			if (record.state === "denied") {
				return {
					state: "denied",
					reason: record.denialReason ?? "No reason was given",
				};
			}
			if (record.state === "admitted" && record.principalId) {
				// **The credential is collectable exactly once.** Minted here, returned here, stored as a
				// hash — and a second poll is refused rather than minting a second bearer token. Without
				// that, a knocker could poll in a loop and hold unlimited credentials, which is a bearer
				// token by the hundred; and because only the hash is kept, the first one cannot be shown
				// again, so the honest answer to a second poll is that it was already collected.
				if (record.credentialHash !== undefined) {
					throw new AdmissionRefused(
						"already-collected",
						"This admission's credential was already issued to its one poll. Knocking again is how a new request is made",
					);
				}
				const token = mint();
				record.credentialHash = hash(token);
				issued.set(record.credentialHash, record.principalId);
				return {
					state: "admitted",
					credential: token,
					principalId: record.principalId,
				};
			}
			return { state: "pending" };
		},

		listPending: (boardId, readerId) => {
			if (!isGateHolder(readerId, boardId)) {
				throw new AdmissionRefused(
					"not-a-gate-holder",
					"Listing pending requests requires admit:agent on that board, or at workspace scope",
				);
			}
			return [...knockRecords.values()]
				.filter(
					(record) => record.boardId === boardId && record.state === "pending",
				)
				.map((record) => ({
					requestId: record.requestId,
					boardId: record.boardId,
					declared: { ...record.declared },
					requestedAt: record.requestedAt,
				}));
		},

		admit: (input) => {
			const record = requireKnock(input.requestId);
			if (!isGateHolder(input.grantedBy, record.boardId)) {
				throw new AdmissionRefused(
					"not-a-gate-holder",
					"Deciding an admission requires admit:agent on that board, or at workspace scope",
				);
			}
			if (record.state !== "pending") {
				throw new AdmissionRefused(
					"not-pending",
					"This request has already been decided",
				);
			}
			// The principal is created through the store's own operations, and the grant goes through
			// **07b's `store.grant`**, so the bounds are enforced by the rule rather than by this module.
			// That is the seam 07b's comment predicted: admission does not restate the rules, it calls them.
			const principalId = `agent-${mint().slice(0, 12)}`;
			store.admitPrincipal({
				principalId,
				name: record.declared.name,
				description: record.declared.operator,
			});
			store.grant({
				granterId: input.grantedBy,
				principalId,
				scope: "board",
				boardId: record.boardId,
				permissions: input.permissions,
			});
			record.state = "admitted";
			record.principalId = principalId;
		},

		deny: (input) => {
			const record = requireKnock(input.requestId);
			if (!isGateHolder(input.deniedBy, record.boardId)) {
				throw new AdmissionRefused(
					"not-a-gate-holder",
					"Deciding an admission requires admit:agent on that board, or at workspace scope",
				);
			}
			if (record.state !== "pending") {
				throw new AdmissionRefused(
					"not-pending",
					"This request has already been decided",
				);
			}
			// **Recorded, not dropped.** A denial a knocker cannot learn is a knocker polling forever.
			record.state = "denied";
			record.denialReason = input.reason;
		},

		resolveCredential: (token) => {
			const principalId = issued.get(hash(token));
			return principalId === undefined
				? undefined
				: store.readPrincipal(principalId);
		},

		permissionsFor: (principalId, boardId) =>
			store.grantsFor(principalId, boardId),
	};
};
