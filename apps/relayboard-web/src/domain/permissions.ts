/**
 * The permission vocabulary, and the grant that carries it.
 *
 * Declared here rather than in 07a because the client interface has to name what each
 * operation requires, and a name that arrives later is a name every call site has to be
 * revisited for. Spec L326-339 is the authority and this file transcribes it; 07a adds
 * the enforcement, the scope check and the matrix, not the vocabulary.
 *
 * Two rules are encoded in the types rather than described:
 *
 * 1. **A permission is `<verb>:<object>`** — a named capability, never a role.
 * 2. **A grant is always scoped** — to the workspace or to exactly one board. There is
 *    no unscoped grant and no implicitly workspace-wide one, which is what makes
 *    board-level consent possible in the first place.
 *
 * `kind` does not appear here. A human and an agent hold grants the same way; the one
 * rule that consults kind — only a human may hold `admit:agent` / `revoke:agent` —
 * belongs to 07b's enforcement.
 */

/**
 * The fifteen named capabilities, each {@link PermissionName} for the verb on the object.
 *
 * The objects and their verbs, from spec L327-341:
 *
 * | object | permissions |
 * | --- | --- |
 * | workspace | `read:board`, `create:board`, `admit:agent`, `revoke:agent`, `grant:permission` |
 * | board | `read:board`, `update:board`, `create:thread`, `add:resource`, `read:member` |
 * | thread | `read:thread`, `post:message`, `move:status`, `add:artifact`, `acknowledge:thread` |
 * | resource | `read:resource`, `add:resource` |
 *
 * Four names appear on two rows — `read:board`, `add:resource` — because the same verb
 * can be held at workspace scope and at board scope, and the scope is what distinguishes
 * them. That is why a grant carries its scope rather than the name carrying it.
 */
export type PermissionName =
	// workspace
	| "read:board"
	| "create:board"
	| "admit:agent"
	| "revoke:agent"
	| "grant:permission"
	// board
	| "update:board"
	| "create:thread"
	| "add:resource"
	| "read:member"
	// thread
	| "read:thread"
	| "post:message"
	| "move:status"
	| "add:artifact"
	| "acknowledge:thread"
	// resource
	| "read:resource";

/**
 * What a principal may do, and where.
 *
 * A grant is the *only* thing that decides capability — two principals holding the same
 * grant behave identically, whatever their `kind`. It is scoped because a
 * workspace-wide "can post" would make board-level consent impossible (spec L416), and
 * the scope is two-valued rather than absent because "no scope" is not a third state a
 * caller could ever want: a permission with no scope is a workspace-wide permission
 * nobody chose.
 *
 * Which board a board-scoped grant is about comes from the read that produced it — the
 * participant read takes `{ principalId, boardId }`, so the grant it returns is *that
 * board's* grant. That is deliberate: putting a board id on the grant would let a caller
 * compare a grant against a board the read never checked, and the two reads that exist
 * (`listMembers`, `readPrincipal`) are both already board-scoped.
 */
export interface Grant {
	/** The workspace, or one board — never unscoped, and never "all boards". */
	readonly scope: "workspace" | "board";
	/** The named capabilities held at that scope. Never a role, never inherited. */
	readonly permissions: readonly PermissionName[];
}
