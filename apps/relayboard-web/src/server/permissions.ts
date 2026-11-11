import type { ClientOperation, PermissionRequirement } from "#/client";
import { operationPermissions } from "#/client";
import type { BoardId, PermissionName, Principal } from "#/domain";
import { errorMessages } from "#/domain";
import { ServerError } from "#/server/functions/errors";
import { getStore } from "#/server/store/instance";

/**
 * The one permission check, and the only place a refusal is constructed.
 *
 * ## Why this reads the declared table rather than taking a permission argument
 *
 * 07a's central criterion is that **every participant operation declares the one permission it
 * requires, as a single value on the operation's definition rather than a branch inside its
 * handler**. The table for that is `operationPermissions` in `src/client`, which is exhaustive by
 * type over `ClientOperation` — an operation added without a row does not compile.
 *
 * So a handler writes:
 *
 * ```
 * const actor = authorize("appendMessage", { boardId });
 * ```
 *
 * and nothing else. It does not name a permission, because naming one would be a second declaration
 * that could disagree with the table; and it cannot forget to check, because `authorize` returns the
 * actor every subsequent line needs. If this module ever grows an `if (operation === ...)`, the table
 * has stopped being the mechanism and something has gone wrong.
 *
 * ## The three shapes, handled once each
 *
 * `PermissionRequirement` has three forms — a name, `{ atLeastOneBoard }`, and `{ none: reason }` —
 * and each is resolved here, in one place, so no handler reasons about which it has.
 *
 * ## What this is not
 *
 * **It is not a `kind` check.** AGENTS.md makes `kind` load-bearing in exactly one place — only a
 * human may hold `admit:agent` / `revoke:agent` — and that rule is 07b's. Nothing here reads `kind`,
 * and a second occurrence anywhere in the enforcement path is a bug.
 */

/** A refusal: the missing permission, at the scope it was needed. */
export class PermissionDenied extends ServerError {
	readonly permission: PermissionName;
	readonly boardId: BoardId | undefined;

	constructor(permission: PermissionName, boardId: BoardId | undefined) {
		super("unresolved", errorMessages.permissionDenied, permission);
		this.name = "PermissionDenied";
		this.permission = permission;
		this.boardId = boardId;
	}
}

/** Where a requirement is being checked: the board it is about, when there is one. */
export interface AuthorizeScope {
	/** The board the operation concerns, when the operation names one. */
	readonly boardId?: BoardId;
}

const store = () => getStore();

/**
 * Resolve a requirement to an answer, for one principal at one scope.
 *
 * Exported so the matrix can be asserted directly — a test that only went through the handlers could
 * not tell a requirement satisfied by implication from one satisfied directly.
 */
export const permitsRequirement = (
	principalId: string,
	requirement: PermissionRequirement,
	scope: AuthorizeScope,
): boolean => {
	const s = store();
	if (typeof requirement === "string") {
		return scope.boardId !== undefined
			? s.permits(principalId, requirement, scope.boardId)
			: s.permits(principalId, requirement);
	}
	if ("none" in requirement) {
		// Nothing required, and the reason is in the table rather than inferred here.
		return true;
	}
	// `atLeastOneBoard`: the permission held on *any* board (spec L339). Read through the same store
	// lookup, one board at a time, so this cannot become a second notion of holding something.
	return s
		.listBoards()
		.some((board) =>
			s.permits(principalId, requirement.atLeastOneBoard, board.id),
		);
};

/**
 * Check one operation against the acting principal, and return the principal.
 *
 * The shape is deliberate: a handler that needs the actor gets it **from this call**, so an
 * operation cannot be written that forgets the check and then resolves the principal somewhere else.
 */
export const authorize = (
	operation: ClientOperation,
	actor: Principal,
	scope: AuthorizeScope = {},
): Principal => {
	const requirement = operationPermissions[operation];
	if (!permitsRequirement(actor.id, requirement, scope)) {
		// The refusal names the permission it needed. The `none` shape cannot reach here — nothing is
		// required, so `permitsRequirement` returned true — which is why the last branch resolves to
		// the reason string rather than to a permission: it is unreachable, and a type that admits it
		// is honest about that.
		const named =
			typeof requirement === "string"
				? requirement
				: "atLeastOneBoard" in requirement
					? requirement.atLeastOneBoard
					: requirement.none;
		throw new PermissionDenied(named as PermissionName, scope.boardId);
	}
	return actor;
};
