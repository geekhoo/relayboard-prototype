import type { PermissionName, Principal } from "#/domain";
import { errorMessages } from "#/domain";
import { mayGrantAt, permissionNames } from "#/domain/grants";

/**
 * The two rules that keep the gate human and the grant unlaunderable.
 *
 * ## Why they live here rather than in the boundary
 *
 * 07a put the *enforcement* of an operation at the boundary. These two are different: they are the
 * rules about **writing a grant**, and a grant can be written by any path that reaches the store —
 * the store's own `grant` operation today, admission's path tomorrow (08a), and whatever a later
 * surface adds. A rule that lived at one call site would be a rule the next call site forgets, so
 * both are checked in the store's `grant`, once, and the module says so.
 *
 * ## The one place `kind` is load-bearing
 *
 * AGENTS.md: `kind` is a label, not a capability, **load-bearing in exactly one place** —
 * `admit:agent` and `revoke:agent` may only be granted to a human. This file is that place, and
 * {@link gateRule} is the branch. Everything else in the enforcement path asks about grants; only
 * this asks about kind, and only because the spec says admission is a human's decision (stories
 * 77-80, spec L590).
 *
 * A second comparison against `kind` in this repository is a bug, and `tests/permissions.test.ts`
 * enumerates every one so it cannot appear quietly.
 *
 * ## Where these rules are asserted, and where they will be re-asserted
 *
 * 07b:21 asks for every rule here to be asserted at the store seam **today** and re-asserted at the
 * admission seam by 08a, "written once and re-used rather than restated". So:
 *
 * - `tests/grant-rules.test.ts` owns every rule below, driven through `store.grant`. That file is
 *   the single statement of what the rules are.
 * - 08a calls **`checkGrant`** through admission rather than restating the rules, and asserts the
 *   end-to-end path — a request arriving at the admission endpoint and being refused. The assertions
 *   there are about the *seam*, not about the rules; a duplicated rule test in 08a would be a second
 *   place they can drift.
 */

/** The two permissions that may only be granted to a human. */
export const GATE_PERMISSIONS: readonly PermissionName[] = [
	"admit:agent",
	"revoke:agent",
];

/**
 * The gate rule: may this permission be granted **to** this principal?
 *
 * Read at the moment of granting rather than at admission, because a grant can be written by any
 * path and the check has to be where the write happens. A principal whose `kind` is `agent` may not
 * hold either gate permission; everybody else may be considered, and the bounds below decide whether
 * the granter could give it at all.
 */
export const gateRuleAllows = (
	permission: PermissionName,
	recipient: Principal,
): boolean => {
	if (!GATE_PERMISSIONS.includes(permission)) return true;
	return recipient.kind === "human";
};

/** What a refusal from these rules is about, so a caller can tell them apart. */
export type GrantRefusalReason =
	/** The gate rule: a gate permission aimed at an agent. */
	| "gate-is-human-only"
	/** The granter does not hold the permission itself. */
	| "granter-lacks-permission"
	/** The granter holds it more narrowly than it is being granted. */
	| "scope-too-broad";

/** One grant, as the rules see it. */
export interface GrantAttempt {
	readonly granterId: string;
	readonly recipientId: string;
	readonly permissions: readonly PermissionName[];
	readonly scope: "workspace" | "board";
	readonly boardId?: string;
}

/** What the store can tell these rules about a principal and what it may do. */
export interface GrantWorld {
	readPrincipal(principalId: string): Principal | undefined;
	/**
	 * What a principal holds **at workspace scope**.
	 *
	 * Separate from the board holdings below because the two answer different questions: a workspace
	 * grant may be handed out at either scope, and a board grant only at its own board.
	 */
	workspacePermissions(principalId: string): readonly PermissionName[];
	/**
	 * Everything a principal holds on **any** board, as one list.
	 *
	 * Deliberately not "on this board": the bounds rule needs to know that a principal holds a
	 * permission *somewhere* in order to tell "you do not hold this" from "you hold it too narrowly".
	 * Computing "somewhere" inside the rule keeps the decision in the rule; a store that filtered to
	 * the board being granted would make the rule unable to distinguish the two, and the distinction
	 * would silently become "it depends how the caller wired it".
	 */
	anyBoardPermissions(principalId: string): readonly PermissionName[];
}

/** A refusal, carrying which rule refused and which permission it refused. */
export class GrantRefused extends Error {
	readonly reason: GrantRefusalReason;
	readonly permission: PermissionName;

	constructor(reason: GrantRefusalReason, permission: PermissionName) {
		super(messageFor(reason, permission));
		this.name = "GrantRefused";
		this.reason = reason;
		this.permission = permission;
	}
}

/**
 * The message a caller sees, per reason.
 *
 * Three sentences rather than one, because 07b:20 asks for a caller to be able to tell "you cannot
 * do this" from "you cannot give this" — and an operator reading a refusal needs to know which of the
 * three rules fired, not merely that something did.
 */
const messageFor = (
	reason: GrantRefusalReason,
	permission: PermissionName,
): string => {
	switch (reason) {
		case "gate-is-human-only":
			return `${permission} may only be granted to a human participant: admission and revocation are a person's decision`;
		case "granter-lacks-permission":
			return `Cannot grant ${permission}: you do not hold it yourself, and a grant cannot exceed the granter's own permissions`;
		case "scope-too-broad":
			return `Cannot grant ${permission} at workspace scope: you hold it only on a board, and a grant cannot be broader than the granter's`;
	}
};

/**
 * Apply both rules to one attempted grant, and throw if either refuses.
 *
 * ## The order, and why it matters
 *
 * **Gate rule first**, then the granter's own permission, then the scope. Each is a different
 * statement and a caller can act on each differently, so the first refusal a caller meets is the one
 * that describes its attempt most specifically: an agent aimed at a gate permission is refused for
 * being an agent, not for the granter's bounds — that is true of every principal, and it is the fact
 * worth telling.
 *
 * A permission outside the vocabulary never reaches this function: 07b:18 makes it a validation
 * failure that runs before any of these rules, and {@link isWellFormedGrant} is where it is caught.
 *
 * ## No `await` between the reads and the write
 *
 * 07b:19: the check and the write must not yield, or two concurrent grants could both read the old
 * state and both write. This function is synchronous and the store applies it and appends in one
 * step — the same rule `seq` assignment follows. There is no lock because there is nothing to lock:
 * JavaScript runs this to completion.
 */
export const checkGrant = (attempt: GrantAttempt, world: GrantWorld): void => {
	const recipient = world.readPrincipal(attempt.recipientId);
	if (!recipient) {
		throw new Error(errorMessages.principalNotFound);
	}

	for (const permission of attempt.permissions) {
		// The gate rule: the one place `kind` decides anything.
		if (!gateRuleAllows(permission, recipient)) {
			throw new GrantRefused("gate-is-human-only", permission);
		}

		// The bounds: the granter must be able to give this permission at this scope.
		const workspace = world.workspacePermissions(attempt.granterId);
		const onBoard = world.anyBoardPermissions(attempt.granterId);
		if (mayGrantAt({ workspace, onBoard }, permission, attempt.scope)) continue;

		// Distinguish the two failures, because an operator fixes different things: "you do not hold
		// this" is a permission problem and "you hold it too narrowly" is a scope problem. A board
		// holder attempting a workspace grant is the second, which is the permissive mistake 07b:17
		// names and the reason they are separate reasons rather than one.
		const holdsItOnABoard = onBoard.includes(permission);
		throw new GrantRefused(
			attempt.scope === "workspace" && holdsItOnABoard
				? "scope-too-broad"
				: "granter-lacks-permission",
			permission,
		);
	}
};

/**
 * Whether a permission's grant is well formed before any rule above runs.
 *
 * 07b:18: an unknown permission is a **validation** failure, which is a different family from a
 * bounds refusal — so it is checked before, and the caller learns "that is not a permission" rather
 * than "you may not give it".
 */
export const unknownPermission = (
	permissions: readonly string[],
): string | undefined =>
	permissions.find((name) => !permissionNames.includes(name as PermissionName));
