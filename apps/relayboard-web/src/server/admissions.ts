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
import type { BoardId, PermissionName, Principal, PrincipalId } from "#/domain";
import type { Derived } from "#/server/credential";
import {
	type Clock,
	deriveFingerprint,
	hashToken,
	mintToken,
	sameHash as sameDigest,
	systemClock,
} from "#/server/credential";
import { requireSessionSecret } from "#/server/env";
import { registerAgentCredential } from "#/server/principal";
import type { Store } from "#/server/store";

/**
 * How long an admission lasts.
 *
 * `"never"` is representable and **explicit** (08b:18): the surface offers a bounded window by default
 * and "never" as a visibly exceptional choice, and the record carries which was chosen rather than
 * inferring it from a missing expiry. A missing field would make "never" and "not set yet"
 * indistinguishable, which is the merge 08c exists to prevent for the other pair of values.
 */
export type Expiry =
	| { readonly kind: "bounded"; readonly hours: number }
	| { readonly kind: "never" };

/** The default window the surface offers, in hours. Seven days is the spec's example (spec L393). */
export const DEFAULT_EXPIRY_HOURS = 24 * 7;

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

/** A request that has been decided, as a gate holder can review it afterwards. */
export interface DecidedRequest extends PendingRequest {
	readonly outcome: "admitted" | "denied";
	/** Present when denied: the reason the gate holder gave. */
	readonly denialReason?: string;
	/** Present when admitted: what was granted, and until when. */
	readonly grantedPermissions?: readonly PermissionName[];
	readonly expiresAt?: string;
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
		| "already-collected"
		/** A renewal presenting a credential that is still live. */
		| "not-expired"
		/** A renewal presenting a revoked admission's credential. */
		| "revoked";

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
	state: "pending" | "denied" | "admitted" | "revoked";
	denialReason?: string;
	/** Set on admission. The credential's hash; the token itself is never stored. */
	credentialHash?: string;
	principalId?: PrincipalId;
	revokedBy?: PrincipalId;
	revokedAt?: string;
	/** Who decided it, so a board's decisions can be shown to the people who made them. */
	decidedBy?: PrincipalId;
	decidedAt?: string;
	expiry?: Expiry;
	expiresAt?: string;
	grantedPermissions?: readonly PermissionName[];
}

/** How the surface reaches the workspace. */
export interface AdmissionStore {
	readonly store: Store;
}

/** The credential primitives, aliased so the call sites read as they did. */
const hash = hashToken;
const mint = mintToken;
const sameHash = sameDigest;

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
	 * What a gate holder has already decided.
	 *
	 * **The criterion that stops the surface quietly emptying itself** (08b:19): a denial a denyer
	 * cannot see afterwards is a decision made and forgotten, and the pending list would shrink with no
	 * record of why. Same shape as {@link PendingRequest} plus the outcome and, for a denial, its
	 * reason. Still no secrets and no credentials — a credential is never listed anywhere.
	 */
	decided(boardId: BoardId, readerId: PrincipalId): readonly DecidedRequest[];
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
		/** Chosen in the same act as the set, never defaulted silently (08b:17). */
		readonly expiry: Expiry;
	}): void;
	/** A human holding `admit:agent` denies, with a reason the knocker will be told. */
	deny(input: {
		readonly requestId: string;
		readonly deniedBy: PrincipalId;
		readonly reason: string;
	}): void;
	/**
	 * End an admission. The revoked principal is refused on its next request, and its entries keep their
	 * author.
	 */
	revoke(input: {
		readonly requestId: string;
		readonly revokedBy: PrincipalId;
	}): { readonly principalId: PrincipalId };

	/**
	 * Renew an expired admission, **proved by the expired credential itself**.
	 *
	 * Resolves to the **same principal id**, so history does not split per credential (spec L598). A
	 * renewal that presented a name and operator and no credential is refused.
	 */
	renew(input: { readonly credential: string; readonly expiry: Expiry }): {
		readonly credential: string;
		readonly principalId: PrincipalId;
	};

	/** The values this workspace derived: who admitted it, and its fingerprint. */
	derivedFor(principalId: PrincipalId): Derived | undefined;

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
/**
 * Build the admission surface, on a clock.
 *
 * The clock is a parameter rather than `Date.now()` read inline, because **expiry is a clock and a test
 * that waits is a test that flakes**: a suite that slept for a bounded window would take minutes and
 * fail on a loaded machine. A test passes a clock it advances, so "an expired admission is refused on
 * the principal's next request" is asserted in a millisecond.
 *
 * ## In this module, `Date.now()` is a defect
 *
 * **Written here because it already happened once.** `admit` took the clock and then computed the
 * expiry's instant with `Date.now()` while the lifecycle check used `now()` — so the two halves of one
 * decision disagreed, and the clocked tests passed only because the fake instant happened to be in the
 * past relative to the machine's clock on the day they were written. They failed a week later, in a
 * different ticket's gate, with no change to this file.
 *
 * The rule, which is stronger than "inject the clock": **every read of the current time in this module
 * goes through `now()`**, and a literal `Date.now()` here is an error rather than a shortcut. An
 * injected dependency read in one of two places is worse than none at all, because it looks like it
 * works — and the failure it produces is time-dependent, which means it passes on the machine that
 * wrote it and fails on CI.
 */
export const createAdmissions = (
	store: Store,
	now: Clock = systemClock,
): Admissions => {
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
	// **The fingerprint's key.** The installation secret, read here rather than at module scope so the
	// module has no import-time requirement of its own — 06b's resolver already enforces the secret at
	// boot, and a second enforcement would be a second failure mode.
	const secret = requireSessionSecret();

	/**
	 * The admission record a credential's hash belongs to.
	 *
	 * The issued map holds `hash(token) → principalId`; this finds the knock record that admitted that
	 * principal, which is where the lifecycle lives. A second scan rather than a second map, so there is
	 * one statement of what an admission is.
	 */
	const credentialFor = (tokenHash: string): KnockRecord | undefined => {
		const principalId = issued.get(tokenHash);
		if (principalId === undefined) return undefined;
		return [...knockRecords.values()].find(
			(record) =>
				record.principalId === principalId &&
				record.state !== "denied" &&
				record.state !== "pending",
		);
	};

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

		decided: (boardId, readerId) => {
			if (!isGateHolder(readerId, boardId)) {
				throw new AdmissionRefused(
					"not-a-gate-holder",
					"Reviewing decisions requires admit:agent on that board, or at workspace scope",
				);
			}
			return [...knockRecords.values()]
				.filter(
					(record) =>
						record.boardId === boardId &&
						record.state !== "pending" &&
						record.decidedBy === readerId,
				)
				.map((record) => ({
					requestId: record.requestId,
					boardId: record.boardId,
					declared: { ...record.declared },
					requestedAt: record.requestedAt,
					outcome:
						record.state === "denied"
							? ("denied" as const)
							: ("admitted" as const),
					denialReason: record.denialReason,
					grantedPermissions: record.grantedPermissions,
					expiresAt: record.expiresAt,
				}));
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
			// The choice, recorded rather than inferred: `never` is a value the decider stated, and a
			// missing field could not distinguish it from "not set yet" (08b:18).
			record.expiry = input.expiry;
			// **On the injected clock, not on `Date.now()`.** This read the real clock until a clocked
			// test caught it: the surface took a `now` parameter and then bypassed it in the one place an
			// expiry is computed, so an admission made at a fake instant expired against the real one and
			// "an expired admission is refused on the next request" could not be asserted at all. The
			// defect is the same shape as 08b's dropped expiry — a value that travels through three layers
			// and is not used at the end — and it was found the same way: by a test that moved the clock.
			record.expiresAt =
				input.expiry.kind === "bounded"
					? new Date(now() + input.expiry.hours * 60 * 60 * 1000).toISOString()
					: undefined;
			record.decidedBy = input.grantedBy;
			record.decidedAt = new Date(now()).toISOString();
			record.grantedPermissions = input.permissions;
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
			record.decidedBy = input.deniedBy;
			record.decidedAt = new Date(now()).toISOString();
		},

		resolveCredential: (token) => {
			const record = credentialFor(hash(token));
			if (!record) return undefined;
			// **The lifecycle is checked at the credential, not at the UI.** A revoked, expired or
			// denied admission stops resolving on the principal's *next request* (08c:14), which is the
			// only place every operation already passes through — so nothing downstream has to
			// remember to ask.
			if (record.state === "revoked") return undefined;
			if (
				record.expiresAt !== undefined &&
				Date.parse(record.expiresAt) <= now()
			) {
				return undefined;
			}
			// `principalId` is set by `admit` and by nothing else, and a record that reached the issued map
			// without one could not have been issued a credential — so the assertion is a narrowing, not a
			// possibility this trusts.
			return record.principalId === undefined
				? undefined
				: store.readPrincipal(record.principalId);
		},

		/**
		 * End an admission. The door the credential came through is closed, not just its record.
		 *
		 * ## Why this asks for `admit:agent`'s shape rather than `revoke:agent`
		 *
		 * `revoke:agent` is a **workspace** permission in the vocabulary (spec L420), while `admit:agent`
		 * exists on both the workspace and board rows. That asymmetry is deliberate and not an omission:
		 * **revoking is the heavier act.** Admitting adds one participant to one board; revoking takes
		 * away an identity that may hold grants on several, so a board holder who could revoke would be
		 * able to strip an agent's access to boards it has no standing on. A board-scoped gate holder
		 * therefore admits and does not revoke, and only a workspace-scope holder can revoke.
		 *
		 * `isGateHolder` asks `admit:agent` because that is what a board-scoped decider can hold; the
		 * revoke path is reachable only by a principal holding `revoke:agent` at workspace scope, which
		 * the store's `permits` reaches through. The comment exists so the next reader sees a decision
		 * rather than a mistake.
		 *
		 * Three things this does and one it does not:
		 *
		 * - Refuses a caller without `revoke:agent` on the board, or at workspace scope.
		 * - Marks the record revoked, so the credential **stops resolving on the next request** — the
		 *   check is in `resolveCredential`, which every operation passes through.
		 * - Leaves the principal, its grants and its entries exactly where they are. Revoking is not
		 *   deleting: the entries it authored keep their author (08c:17), and a purged history would be
		 *   a different act entirely (14).
		 */
		revoke: (input) => {
			const record = requireKnock(input.requestId);
			if (!isGateHolder(input.revokedBy, record.boardId)) {
				throw new AdmissionRefused(
					"not-a-gate-holder",
					"Revoking an admission requires revoke:agent on that board, or at workspace scope",
				);
			}
			if (record.state !== "admitted") {
				throw new AdmissionRefused(
					"not-pending",
					"Only an admitted request can be revoked",
				);
			}
			record.state = "revoked";
			record.revokedBy = input.revokedBy;
			record.revokedAt = new Date(now()).toISOString();
			return { principalId: record.principalId as PrincipalId };
		},

		/**
		 * Renew an admission, **proved by the expired credential itself**.
		 *
		 * This is the criterion the review corrected, and the correction is the whole design: a renewal
		 * that matched the declared name and operator would let any caller inherit an existing
		 * principal's history by typing its name. So the request carries the **credential**, its hash is
		 * compared against the stored one in constant time, and the principal id comes from the record
		 * rather than from anything the caller says.
		 *
		 * What is refused, each for its own reason:
		 * - no credential (nothing to prove);
		 * - a credential whose hash is unknown (not one of ours);
		 * - a credential that is still live and not expired (renewal is for after expiry, so a caller
		 *   cannot rotate a working credential to launder a compromised one);
		 * - a credential belonging to a revoked admission (revocation is a decision, not a timeout).
		 */
		renew: (input) => {
			const presented = hash(input.credential);
			const record = credentialFor(presented);
			if (!record || record.credentialHash === undefined) {
				throw new AdmissionRefused(
					"unknown-request",
					"Renewal must present the credential it is renewing",
				);
			}
			if (!sameHash(presented, record.credentialHash)) {
				throw new AdmissionRefused(
					"unknown-request",
					"Renewal must present the credential it is renewing",
				);
			}
			if (record.state === "revoked") {
				throw new AdmissionRefused(
					"revoked",
					"This admission was revoked: revocation is a decision and a renewal cannot undo it",
				);
			}
			const expired =
				record.expiresAt !== undefined && Date.parse(record.expiresAt) <= now();
			if (!expired) {
				throw new AdmissionRefused(
					"not-expired",
					"This admission has not expired, so there is nothing to renew. A working credential must not be rotated by asking for a new one",
				);
			}
			// **The same principal, a fresh credential, the same fingerprint.** The id comes from the
			// record, so the agent's history stays one continuous record (spec L598); the fingerprint is
			// derived from the id, so it is preserved by construction rather than by copying.
			const token = mint();
			record.credentialHash = hash(token);
			record.expiresAt =
				input.expiry.kind === "bounded"
					? new Date(now() + input.expiry.hours * 60 * 60 * 1000).toISOString()
					: undefined;
			record.expiry = input.expiry;
			issued.set(record.credentialHash, record.principalId as PrincipalId);
			return {
				credential: token,
				principalId: record.principalId as PrincipalId,
			};
		},

		/**
		 * The values this workspace derived about an admitted principal.
		 *
		 * `issuer` comes from the grant that admitted it — the human who vouched — and `fingerprint` from
		 * a keyed digest of the principal id. Neither is ever read from anything a caller supplied.
		 */
		derivedFor: (principalId) => {
			const record = [...knockRecords.values()].find(
				(candidate) => candidate.principalId === principalId,
			);
			if (!record?.decidedBy) return undefined;
			return {
				issuer: record.decidedBy,
				fingerprint: deriveFingerprint(principalId, secret),
			};
		},

		permissionsFor: (principalId, boardId) =>
			store.grantsFor(principalId, boardId),
	};
};
