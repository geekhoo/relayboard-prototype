import type { PermissionName } from "#/domain";

/**
 * The permission vocabulary, its scopes, and the one matrix everything else reads.
 *
 * ## Why this module exists
 *
 * Spec L416 makes permissions **per object and named for the verb on that object**, and scoped so a
 * workspace-wide "can post" cannot make board-level consent impossible. That gives three separate
 * questions, and 07a's job is to answer all three from data rather than from branches:
 *
 * 1. **Does this name exist?** {@link permissionNames} — the closed fifteen, exactly the four rows of
 *    spec L418-423. A name that is not here is not a permission, and a test asserts the set equals
 *    that literal list so "covers every action" is checkable rather than judged.
 * 2. **What does this name imply?** {@link impliedBy} — the one documented implication (spec L425:
 *    `read:board` on a board yields that board's threads and resources) and nothing else. Everything
 *    not listed there stands alone, and the tests assert four failing pairs so an accidental
 *    "reading implies writing" cannot creep in.
 * 3. **What does this operation require?** {@link requirementFor} — the table from spec L325-341, with
 *    one row per operation on the interface.
 *
 * ## What is deliberately not here
 *
 * **No `kind`.** The one rule that consults it — only a human may hold `admit:agent` and
 * `revoke:agent` — is 07b's, and it is the only place in the codebase allowed to branch on `kind`
 * (AGENTS.md). A check here that read `kind` would be the second occurrence the criterion forbids.
 */

/**
 * The fifteen named capabilities, one per verb on an object.
 *
 * Transcribed from spec L418-423. Four names appear on two rows — `read:board` and
 * `add:resource` — because the same verb can be held at workspace scope and at board scope, and the
 * **scope** is what distinguishes them. That is why a grant carries its scope rather than the name
 * carrying it.
 */
export const permissionNames = [
	// workspace (spec L420)
	"read:board",
	"create:board",
	"admit:agent",
	"revoke:agent",
	"grant:permission",
	// board (spec L421)
	"update:board",
	"create:thread",
	"add:resource",
	"read:member",
	// thread (spec L422)
	"read:thread",
	"post:message",
	"move:status",
	"add:artifact",
	"acknowledge:thread",
	// resource (spec L423)
	"read:resource",
] as const satisfies readonly PermissionName[];

/**
 * Which permissions a held one implies, per spec L425.
 *
 * **One entry, and the emptiness of the rest is the point.** Spec L425 is explicit that
 * `read:board` on a board implies reading that board's threads and resources — "reading a container
 * is not separable from reading what it contains" — and that this is the *only* implication. So
 * `post:message` does not yield `create:thread`, `read:member` does not come with `read:board`, and
 * nothing implies a write.
 *
 * The map is keyed by the permission held; the value is what holding it also grants, **on the same
 * scope**. A board-scoped `read:board` therefore yields board-scoped `read:thread` and
 * `read:resource`, and a workspace-scoped one yields them at workspace scope — which is what lets a
 * superadmin read every thread without a grant per board.
 */
export const impliedBy: Partial<
	Record<PermissionName, readonly PermissionName[]>
> = {
	"read:board": ["read:thread", "read:resource"],
};

/**
 * Whether holding `held` satisfies a requirement of `required`, at the same scope.
 *
 * Deliberately a single function rather than a chain of conditionals at each call site: the whole
 * vocabulary question — does this name satisfy that one — is answered here, once, and the two
 * enforcement paths (the server's boundary and the in-memory client) call it rather than each
 * writing their own subset of the rule.
 *
 * A permission satisfies itself. Otherwise it satisfies a requirement only through
 * {@link impliedBy}, and only in the direction that map states — there is no reverse lookup, so a
 * held `read:thread` never yields `read:board`.
 */
export const satisfies = (
	held: readonly PermissionName[],
	required: PermissionName,
): boolean => {
	if (held.includes(required)) return true;
	for (const name of held) {
		if (impliedBy[name]?.includes(required)) return true;
	}
	return false;
};

/** A grant's scope. Two values, never absent: an unscoped grant is not a third state, it is invalid. */
export type ScopeKind = "workspace" | "board";

/**
 * One grant: a scope, and (for a board) which board.
 *
 * The board id is **optional in the type and required in the value** for a board-scoped grant, and
 * {@link isWellFormedGrant} is the check that says so. Modelling it as a single shape with two
 * invariants, rather than a union, keeps a store lookup keyed on one type — the union would make
 * every read of `grant.boardId` a narrowing, and the narrowing is the check either way.
 */
export interface ScopedGrant {
	readonly scope: ScopeKind;
	/** Present exactly when `scope` is `"board"`; absent for a workspace grant. */
	readonly boardId?: string;
	readonly permissions: readonly PermissionName[];
}

/**
 * Whether holding `held` somewhere is enough to satisfy a requirement at `scope`.
 *
 * The bounds rule needs two questions with different answers, and conflating them is what makes a
 * naive implementation permissive in the wrong direction:
 *
 * - **`permitsAt`** — may this principal exercise the permission *here*? A board-scoped `read:member`
 *   holder may read members on that board and nowhere else, so this is the question the enforcement
 *   path asks (07a).
 * - **`holdsAnywhere`** — may this principal hand the permission out at this scope? A **workspace**
 *   grant requires holding it at workspace scope, and holding it on a board is not enough; a **board**
 *   grant requires holding it at that board, which a workspace grant also satisfies.
 *
 * The second is deliberately narrower than "holds it somewhere": a board-scoped holder may not widen
 * its own permission into a workspace-wide one, which is exactly the permissive mistake 07b:17 names.
 */
export const mayGrantAt = (
	held: {
		readonly workspace: readonly PermissionName[];
		readonly onBoard: readonly PermissionName[];
	},
	permission: PermissionName,
	scope: ScopeKind,
): boolean => {
	if (scope === "workspace") {
		// Only a workspace-scope holder may create a workspace-scope grant. Holding it on a board is
		// not enough, and a board grant cannot be laundered into a workspace one.
		return satisfies(held.workspace, permission);
	}
	// A board grant may be created by someone holding it at workspace scope OR on that board.
	return (
		satisfies(held.workspace, permission) || satisfies(held.onBoard, permission)
	);
};

/**
 * Whether a grant record is valid: a scope it can act on, and permissions that exist.
 *
 * A grant that omits its scope, names a board it is not scoped to, or carries a permission outside
 * the fifteen is a **validation failure** rather than a grant that quietly does nothing (07a:14).
 * One predicate, called from the store's `grant` operation and from the boundary, so there is one
 * answer to "is this grant well formed".
 */
export const isWellFormedGrant = (grant: ScopedGrant): boolean => {
	if (grant.scope !== "workspace" && grant.scope !== "board") return false;
	if (grant.scope === "board" && (grant.boardId ?? "") === "") return false;
	if (grant.scope === "workspace" && grant.boardId !== undefined) return false;
	return grant.permissions.every((name) => permissionNames.includes(name));
};
