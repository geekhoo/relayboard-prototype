import type {
	Board,
	BoardId,
	Entry,
	EntryReference,
	EntryRelation,
	PermissionName,
	Principal,
	PrincipalId,
	Resource,
	ResourceId,
	Seq,
	Thread,
	ThreadId,
	ThreadStatus,
	Watermarks,
} from "#/domain";
import {
	BOARD_MEMBER_PERMISSIONS,
	errorMessages,
	isThreadStatus,
} from "#/domain";
import { isWellFormedGrant, satisfies } from "#/domain/grants";
import { checkGrant, unknownPermission } from "#/server/grants";

/**
 * Why a principal's access ended.
 *
 * Two causes because the reader is told different things: a revocation is a decision a person made, an
 * expiry is a window that closed. Both end the stream; only one of them is somebody's choice, and 11c
 * requires the refusal to distinguish them so an operator can tell a policy decision from a bug.
 */
export type AccessEndCause = "revoked" | "expired";

/**
 * What a purge would remove.
 *
 * The second number is the one 14:14 is about: **the reader's own entries on demo boards**. They are the
 * overlap — records the reader made in content the workspace seeded — and they go with the board they
 * belong to. Naming them before the act is what makes the confirmation honest rather than a surprise,
 * and it is also why the count is reported even when it is zero.
 */
export interface PurgeImpact {
	readonly boards: number;
	readonly threads: number;
	readonly entries: number;
	readonly resources: number;
	/** Entries authored by the reader that sit on demo boards, and will go with them. */
	readonly ownEntriesOnDemoBoards: number;
}

/** What an ending announces to whoever is watching a connection. */
export type AccessEndListener = (event: {
	readonly principalId: PrincipalId;
	readonly cause: AccessEndCause;
}) => void;

/**
 * The store: the workspace's state, and the operations over it.
 *
 * A factory that takes its seed as an argument, so a test can start from an empty
 * workspace or from a two-thread fixture rather than from the demo content. The
 * demo seed arrives as a plain seed (02c); nothing here knows it exists.
 *
 * ## The one rule this module enforces
 *
 * `seq` is per thread, starts at 1, is gapless, and is immutable once assigned.
 * Assigning it and appending the entry are **one synchronous step, with no `await`
 * between computing a thread's next `seq` and appending the entry**. The store is
 * synchronous, so nothing can interleave and no lock is needed or held; the rule is
 * written down because it is the invariant a later move to an asynchronous store
 * must preserve, and because it is the thing a rejection must not disturb: a
 * refused append leaves the store unchanged and consumes no `seq`.
 *
 * ## What a caller can observe
 *
 * Everything handed out is frozen, so a caller holding an entry cannot rewrite the
 * position it was given. A rejection throws one of the domain's documented error
 * strings rather than a bespoke one.
 */

/** A thread's entries, as the seed supplies them: one list per thread, in any order. */
export type SeedEntries = Readonly<Record<ThreadId, readonly Entry[]>>;

/**
 * Everything a store starts with, and nothing else: five collections.
 *
 * `entries` is keyed by thread because `seq` is per thread — the grouping is what
 * makes "this thread's next number" answerable without a second lookup. There is no
 * member list and no watermark map here: membership is 07a's grant, and the seeded
 * watermarks are 02c's seeding path.
 */
export interface StoreSeed {
	readonly principals: readonly Principal[];
	readonly boards: readonly Board[];
	readonly threads: readonly Thread[];
	readonly entries: SeedEntries;
	readonly resources: readonly Resource[];
}

/**
 * One principal's watermarks in one thread, as the seed supplies them.
 *
 * The prototype keeps a single `seen` map and a single stream `cursors` map
 * (`app.js` L83) because it hard-coded one reader. The port keeps the same two
 * numbers *per principal*, so the demo seed reproduces both browser-selectable
 * principals' badges and a test can tell them apart (02c).
 */
export interface SeedWatermarks {
	/** How far delivery had reached this principal. Absent means "the whole seeded thread". */
	readonly cursor?: number;
	/** How far this principal had read. Absent means "nothing read". */
	readonly seen?: number;
	/** How far this principal reports it has taken the thread into account (10a). Absent means "not yet". */
	readonly acknowledged?: number;
}

/**
 * What the store needs besides the seed, supplied by whoever builds it.
 *
 * Separate from `StoreSeed` on purpose: the seed is the workspace's content — five
 * collections and nothing else — while this is the store's seeding path, which is
 * where the stand-ins live until the real things arrive. The one today is
 * membership.
 */
export type StoreWatermarks = Readonly<
	Record<PrincipalId, Readonly<Record<ThreadId, SeedWatermarks>>>
>;

export interface StoreOptions {
	/**
	 * The seed's watermarks, keyed by principal and then by thread.
	 *
	 * This is the seeding path's second input, beside the grants: the demo seed's
	 * `seen` map and stream `cursors` (`app.js` L83) become entries here, and a
	 * principal with no entry starts at the baseline — everything seeded is delivered,
	 * nothing is read.
	 */
	readonly watermarks?: StoreWatermarks;

	/**
	 * The grants the workspace starts with.
	 *
	 * **This replaces 02c's provisional membership predicate**, which is exactly what 07a was for.
	 * A principal is on a board because it holds a grant there, and the predicate that stood in for
	 * that — one function, named as the debt — is gone: the store now asks a lookup over real grant
	 * records, so "on the board" and "may do this there" are the same mechanism rather than two that
	 * can disagree.
	 */
	readonly grants?: readonly SeededGrant[];
}

/**
 * One grant, as a seed states it.
 *
 * A board-scoped grant names its board; a workspace-scoped one does not. Kept as a flat record
 * rather than the nested `principal → board → permissions` shape a lookup wants, because the seed is
 * written by hand and a flat list is what a person can read and check against `app.js`'s
 * `board.members` arrays.
 */
export interface SeededGrant {
	/**
	 * Who is writing this grant.
	 *
	 * Required since 07b, and required *in the record* rather than passed beside it: a grant without a
	 * granter cannot be checked against the granter's own permissions, and an optional field would let
	 * a caller omit it and skip both rules by omission.
	 *
	 * The seed's grants carry the installation itself as granter — `"system"`, which holds nothing and
	 * is therefore permitted nothing. That is honest: seeded grants are provisioning, not a
	 * participant's act, and 07b's rules are about what a *participant* may hand out.
	 */
	readonly granterId: PrincipalId;
	readonly principalId: PrincipalId;
	readonly scope: "workspace" | "board";
	/** Present exactly when `scope` is `"board"`. */
	readonly boardId?: BoardId;
	readonly permissions: readonly PermissionName[];
}

/**
 * What a caller supplies to create a board.
 *
 * The mark and the hue are derived here rather than asked for, because `createBoard`
 * in the prototype does exactly that (`app.js` L116: `short: name[0].toUpperCase()`,
 * `theme: 'blue'`) — a board made through the app must render in the rail like a
 * seeded one.
 */
export interface CreateBoardInput {
	readonly name: string;
	readonly description?: string;
	/**
	 * Who is making it, **required**: the creator holds the board's member grant, so a create that named
	 * no creator would produce a board nobody can speak in — the defect 09 shipped and 14's test found.
	 *
	 * Required rather than optional-with-a-default because a default would have to invent a principal,
	 * and inventing one is how the board got a silent owner in the first place.
	 */
	readonly creatorId: PrincipalId;
}

/** What a caller supplies to create a thread in a board. */
export interface CreateThreadInput {
	readonly boardId: BoardId;
	readonly title: string;
	/** The acting principal, which the thread intro names (05). Resolved by the transport, never by the caller. */
	readonly creatorId: PrincipalId;
	// No description: `Thread` has no such attribute and no surface renders one. The prototype
	// collected one (app.js L165) and stored it (L115) with no render path reading it, so the port
	// carried a value that went nowhere. Removed rather than documented a second time.
}

/** What a caller supplies to add a canonical resource to a board. */
export interface AddResourceInput {
	readonly boardId: BoardId;
	readonly name: string;
	readonly url: string;
	/** Ticket 09 closes this to `Document | Repository | Design | Link`; until then it is a string. */
	readonly type: string;
	readonly description: string;
}

/** What a caller supplies to append prose. The author is the acting principal, resolved below the client. */
export interface AppendMessageInput {
	readonly threadId: ThreadId;
	readonly authorId: PrincipalId;
	readonly text: string;
	readonly references?: readonly EntryReference[];
	readonly relation?: EntryRelation;
	/** A retry key: replaying one returns the entry already stored under it. */
	readonly idempotencyKey?: string;
}

/**
 * Where one principal has got to in one thread.
 *
 * The three watermarks are kept per `(principal, thread)` and are independent of each
 * other: a paused subscriber's `cursor` holds still, reading advances `seen` alone,
 * and `acknowledged` moves only when a principal deliberately says so (10a).
 */
export interface PrincipalPosition {
	readonly principalId: PrincipalId;
	readonly watermarks: Watermarks;
}

/** One principal's three watermarks in one thread, mutable inside the store only. */
interface Marks {
	cursor: number;
	seen: number;
	acknowledged: number;
}

/** A commit, as it is announced to whoever is listening. */
export interface Commit {
	readonly threadId: ThreadId;
	readonly entry: Entry;
	/** Whether delivery reached every connected subscriber. False means it is awaiting replay. */
	readonly delivered: boolean;
}

export type CommitListener = (commit: Commit) => void;

export type Unsubscribe = () => void;

/** The operations a caller has. Reads hand out frozen records; writes are synchronous. */
export interface Store {
	listBoards(): readonly Board[];
	readBoard(boardId: BoardId): Board | undefined;
	listThreads(boardId: BoardId): readonly Thread[];
	readThread(threadId: ThreadId): Thread | undefined;
	/** A thread's chronology, in canonical order: by `seq`, never by `createdAt`. */
	readEntries(threadId: ThreadId): readonly Entry[];
	/** A board's canonical resources. Never copies of one: an entry points at a resource by id. */
	listResources(boardId: BoardId): readonly Resource[];
	readPrincipal(principalId: PrincipalId): Principal | undefined;

	/**
	 * The principals on one board today, in the seed's order.
	 *
	 * Read through the provisional membership predicate, so it is the same stand-in the
	 * append's refusal uses: one answer to "is this principal on this board", asked two
	 * ways. 07a replaces the predicate with a grant lookup and both follow.
	 */
	listMembers(boardId: BoardId): readonly Principal[];

	/**
	 * A thread's entries as one principal may see them.
	 *
	 * Visibility is "everything at or below my `cursor`, plus my own entries" — so a
	 * paused principal is withheld other principals' entries while they stay in
	 * `readEntries`. A pause withholds a view; it never removes history.
	 */
	readView(threadId: ThreadId, principalId: PrincipalId): readonly Entry[];

	/** How far every principal has got in this thread, each on its own three watermarks. */
	readPositions(threadId: ThreadId): readonly PrincipalPosition[];

	/**
	 * Pause or resume one principal's delivery.
	 *
	 * Pausing advances neither watermark. Resuming replays from that principal's own
	 * `cursor`, which is the only record of what it has missed — there is no queue, so
	 * delivering the replay is the cursor catching up to the thread's last position.
	 */
	setConnection(principalId: PrincipalId, connected: boolean): void;

	/**
	 * Whether this principal is paused, which is what a **per-principal stream** must ask.
	 *
	 * The commit listener's `delivered` flag is workspace-wide: it is false when *any* principal is
	 * paused, because the store is announcing one commit to every listener. A stream serving one
	 * reader needs that reader's answer, and asking it here is the only way to get one — the
	 * alternative would be a listener per principal, which is a queue by another name.
	 */
	isPaused(principalId: PrincipalId): boolean;

	/** The principal read the thread: `seen` catches up to the last position. `cursor` does not move. */
	markRead(principalId: PrincipalId, threadId: ThreadId): void;

	/**
	 * Called after every commit, with the entry and the thread it landed in.
	 *
	 * The store keeps **no queue** for anyone: a subscriber that is paused is withheld
	 * the event and resumes from its own `cursor` (spec L360). This is the notification
	 * that a stream is built on, not a backlog — 11a's route and 11b's panel are its
	 * consumers, and 03 proves the in-memory stream can be driven by it.
	 */
	/**
	 * **How a principal's access ended**, or `undefined` while it still holds one.
	 *
	 * Revocation is an event and expiry is a clock, so the two arrive by different routes: `endAccess` is
	 * called by whoever ends it (08c's `revoke`), and the registered checker is asked on each call for a
	 * cause nothing announces. Both answers land here, because a long-lived connection needs **one
	 * question** rather than two mechanisms — the stream asks this and closes on the answer.
	 */
	endAccess(principalId: PrincipalId, cause: AccessEndCause): void;

	/** Whether this principal's access has ended, and why. `undefined` means it has not. */
	accessEndedFor(principalId: PrincipalId): AccessEndCause | undefined;

	/**
	 * **What a purge would remove**, without removing it.
	 *
	 * 14:14 requires the confirmation to report *how many of the reader's own entries sit on demo
	 * boards and will be removed with them* — so the overlap is computed before anything runs, from the
	 * same predicate the purge uses. Two functions computing it would be two answers to one question.
	 */
	purgeImpact(): PurgeImpact;

	/**
	 * Remove every **demo-origin** record, and nothing else.
	 *
	 * 14:11 and 14:12: boards, threads, entries and resources carrying `origin: "demo"` go; the reader's
	 * own survive, as do every principal, every grant and every session. **Origin is a provenance label,
	 * never a permission input** — the permission is checked at the boundary, and this function does not
	 * consult `origin` for anything but removal.
	 */
	purgeDemoContent(): PurgeImpact;

	/**
	 * Put the demo content back, **without duplicating what survived**.
	 *
	 * 14:16. Restore re-seeds the demo records by id: one that survived a purge under the same id is left
	 * alone, so a second restore cannot produce two copies of the same demo board.
	 */
	restoreDemoContent(): { readonly restored: number };

	/**
	 * What this workspace **derived** about a principal, or `undefined` if it did not admit it.
	 *
	 * Registered by the admission surface for the same reason the expiry check is: the store is the
	 * workspace and the admission module is the authority on what it issued, so the direction of the
	 * dependency is admissions → store and never the reverse. 12 reads it from here — through the one
	 * board-scoped principal read — rather than importing the admission surface into a route.
	 */
	derivedIdentityFor(
		principalId: PrincipalId,
	): { readonly issuer: string; readonly fingerprint: string } | undefined;

	/** Register the derivation, so the store can answer for a principal it admitted. */
	registerDerivedIdentity(
		derive: (
			principalId: PrincipalId,
		) => { readonly issuer: string; readonly fingerprint: string } | undefined,
	): void;

	/**
	 * Register the check that answers "has this principal's access ended" for a cause nothing announces.
	 *
	 * Expiry is a clock: no commit, no grant, no event. So the admission surface registers a predicate
	 * here rather than the stream knowing about admissions — the store stays the workspace's state and
	 * the module that owns expiry stays the authority on it.
	 */
	registerAccessCheck(
		check: (principalId: PrincipalId) => AccessEndCause | undefined,
	): void;

	/**
	 * Be told when any principal's access ends.
	 *
	 * A second listener set rather than reusing `onCommit`: a commit and an ending are different facts
	 * with different payloads, and one set carrying both would make every listener branch on a shape.
	 */
	onAccessEnded(listener: AccessEndListener): Unsubscribe;

	/**
	 * Tell every open connection that the workspace's content changed wholesale.
	 *
	 * 14:17: "principals holding a subscription are told that a purge happened, rather than inferring a
	 * failure from silence". A purge removes records a subscriber's cursor and cached chronology describe,
	 * so each open stream must re-read — and reusing the **connection** event rather than inventing a
	 * ninth wire name is 11c's decision applied again, because what changed *is* what the connection can
	 * still deliver.
	 */
	announceWorkspaceChange(): void;

	/** Be told when the workspace's content changed wholesale, so a connection can re-read. */
	onWorkspaceChange(listener: () => void): Unsubscribe;

	onCommit(listener: CommitListener): Unsubscribe;

	/** Press `seq` numbering without writing an entry, so a subscriber does not renumber. Never reuses a value. */
	lastSeq(threadId: ThreadId): number;

	appendMessage(input: AppendMessageInput): Entry;

	/**
	 * Attach a resource to a thread: an artifact entry, holding the resource **id and nothing else**.
	 *
	 * A refused attachment (no permission, no such resource, a resource on another board) throws before
	 * a `seq` is taken, so the thread is unchanged and the numbering has no gap.
	 */
	attachResource(input: {
		readonly threadId: ThreadId;
		readonly resourceId: ResourceId;
		readonly authorId: PrincipalId;
	}): Entry;

	/**
	 * Move a thread's status: a status-move entry, and the thread's own status written from it.
	 *
	 * `from` is checked against the thread, so a stale control cannot move a thread twice.
	 */
	moveStatus(input: {
		readonly threadId: ThreadId;
		readonly from: ThreadStatus;
		readonly to: ThreadStatus;
		readonly authorId: PrincipalId;
	}): Entry;

	/**
	 * A principal reporting how far it has got. Advances **only** its own `acknowledged` watermark.
	 *
	 * The entry carries the range (`fromUpTo` → `upTo`) and no verdict of any kind: an acknowledgement
	 * is a report about the acknowledger, never agreement with what it acknowledged.
	 */
	acknowledge(input: {
		readonly threadId: ThreadId;
		readonly upTo: Seq;
		readonly authorId: PrincipalId;
	}): Entry;

	/** A new board in the workspace. Its mark is derived from the name and its hue defaulted. */
	createBoard(input: CreateBoardInput): Board;

	/** A new thread in an existing board: empty, and ready to post into. */
	createThread(input: CreateThreadInput): Thread;

	/** A new canonical resource on a board. Its url is validated at the boundary (06c, 09), never here. */
	addResource(input: AddResourceInput): Resource;

	/**
	 * What one principal holds at one scope.
	 *
	 * The read every enforcement point uses: a server function asks it before its handler body, and
	 * the in-memory client asks it to answer `readPrincipal`. One lookup, so no two callers can
	 * disagree about what a grant means.
	 */
	grantsFor(
		principalId: PrincipalId,
		boardId?: BoardId,
	): readonly PermissionName[];

	/** Whether a principal holds one permission at one scope. The question, rather than the list. */
	permits(
		principalId: PrincipalId,
		permission: PermissionName,
		boardId?: BoardId,
	): boolean;

	/**
	 * Add a principal this workspace has admitted.
	 *
	 * **The one write that creates a participant**, and it is append-only by design (08a's write scope
	 * says "append-only additions to the store for principals and grants"). It takes an id rather than
	 * minting one, because the caller that admits is the one that must name the id it issues a
	 * credential for — minting here would mean returning the id through a second channel.
	 *
	 * The principal starts with **no grants at all**: admit:agent is the gate permission and confers
	 * nothing (AGENTS.md), so admission is followed by an explicit grant or it is followed by nothing.
	 */
	admitPrincipal(input: {
		readonly principalId: PrincipalId;
		readonly name: string;
		/** The operator it declared — **declared**, never verified, and stored as such. */
		readonly description: string;
	}): Principal;

	/**
	 * Record a grant.
	 *
	 * **Permissive by design in this ticket, and 07b is what constrains it.** 07a's criteria stop at
	 * "the store has a `grant` operation"; the rules about who may grant what, to whom, and within
	 * which bounds are 07b's, and writing them here would put them in the wrong ticket and in the
	 * wrong layer.
	 *
	 * What it does enforce is that the record is **well formed**: a scope it can act on, a board when
	 * it is board-scoped, and permissions that exist. A grant that omitted its scope is a validation
	 * failure rather than a grant that quietly grants nothing (07a:14).
	 */
	grant(input: SeededGrant): readonly SeededGrant[];
}

const EMPTY_ENTRIES: readonly Entry[] = Object.freeze([]);

const EMPTY_SEED: StoreSeed = {
	principals: [],
	boards: [],
	threads: [],
	entries: {},
	resources: [],
};

/** Nobody holds anything, which is the honest state of a workspace with no grants. */
const NO_GRANTS: StoreOptions = { grants: [] };

/** Deep-freezes an entry, so a `seq` handed to a caller cannot be reassigned by one. */
const frozen = (entry: Entry): Entry => {
	// Only a message carries `references`, and the guard is on the kind rather than a cast: a new entry
	// kind with an array of its own must add its own freeze here rather than silently share one.
	if (entry.kind === "message") Object.freeze(entry.references);
	if (entry.relation) Object.freeze(entry.relation);
	return Object.freeze(entry);
};

/**
 * A copy of one of the seed's collections, frozen.
 *
 * The seed's arrays belong to the caller. A store that handed one back would let a
 * caller — or a second store built from the same seed object — reach into this one's
 * state through it, so every collection is copied and frozen on the way in.
 */
const collection = <T extends object>(items: readonly T[]): readonly T[] =>
	Object.freeze([...items]);

const lastSeq = (entries: readonly Entry[]): number =>
	entries.reduce((last, entry) => Math.max(last, entry.seq), 0);

/** A thread and its entries, in canonical order. */
const ordered = (entries: readonly Entry[]): readonly Entry[] =>
	Object.freeze(
		[...entries].sort((left, right) => left.seq - right.seq).map(frozen),
	);

/**
 * A store over its seed.
 *
 * Called with no seed it is an empty workspace; called with two different seeds it is
 * two workspaces that share nothing, because every collection is copied into the
 * store's own state rather than closed over.
 */
export const createStore = (
	seed: StoreSeed = EMPTY_SEED,
	options: StoreOptions = NO_GRANTS,
): Store => {
	/**
	 * The seed this workspace was built from, kept so a restore can re-apply it (14:16).
	 *
	 * A copy rather than the argument: the store freezes its own collections, and re-reading the caller's
	 * object would let a caller mutate what a restore produces.
	 */
	const seedSnapshot = seed;

	let principals = collection(seed.principals);

	/**
	 * Every grant this workspace holds, in the order they were seeded and then granted.
	 *
	 * One list rather than a map per principal, because the questions asked of it are all
	 * "does this principal hold X at Y" and the list is short; and because the `grant` operation
	 * below is 07b's to constrain, so it appends rather than replaces.
	 */
	let grants = Object.freeze([
		...(options.grants ?? []),
	]) as readonly SeededGrant[];

	/**
	 * The permissions one principal holds **on one board**, from board-scoped grants only.
	 *
	 * Board-scoped only, deliberately: this is what `grantsFor(principal, board)` returns, and the
	 * caller labels it `scope: "board"` — so folding a workspace grant in here would return
	 * workspace permissions under a board label, which is a grant claiming a scope it was not given.
	 * The workspace fallback belongs to {@link holds}, which is answering a yes/no question rather
	 * than handing a record over.
	 */
	const grantOn = (
		principalId: PrincipalId,
		boardId: BoardId,
	): readonly PermissionName[] =>
		grants
			.filter(
				(grant) =>
					grant.principalId === principalId &&
					grant.scope === "board" &&
					grant.boardId === boardId,
			)
			.flatMap((grant) => grant.permissions);

	/** The permissions one principal holds workspace-wide, which no board scopes. */
	const grantOnWorkspace = (
		principalId: PrincipalId,
	): readonly PermissionName[] =>
		grants
			.filter(
				(grant) =>
					grant.principalId === principalId && grant.scope === "workspace",
			)
			.flatMap((grant) => grant.permissions);

	/**
	 * Whether a principal may do something at one scope.
	 *
	 * The single question every enforcement point asks, and it is asked of the **same** function:
	 * 07a's criterion is that the check is data-driven rather than branched, so a server function and
	 * the in-memory client that both call this cannot disagree about what a grant means.
	 *
	 * A workspace grant satisfies a board-scoped question — the superadmin may read every board's
	 * threads on `read:board` alone — and that is the one direction the implication runs.
	 */
	const holds = (
		principalId: PrincipalId,
		permission: PermissionName,
		boardId?: BoardId,
	): boolean => {
		if (boardId !== undefined) {
			if (satisfies(grantOn(principalId, boardId), permission)) return true;
			// A workspace `read:board` reaches into every board (impliedBy: container → contents).
			if (satisfies(grantOnWorkspace(principalId), "read:board")) {
				return satisfies(["read:board"], permission);
			}
			return false;
		}
		return satisfies(grantOnWorkspace(principalId), permission);
	};
	// Boards, threads and resources grow through the create operations, so these are the
	// store's own mutable lists, copied from the seed's rather than aliasing them.
	let boards: readonly Board[] = collection(seed.boards);
	let threads: readonly Thread[] = collection(seed.threads);
	let resources: readonly Resource[] = collection(seed.resources);
	let sequence = 0;
	/** Ids for records a caller created. The prefix matches the prototype's `uid('thread')` reading. */
	const nextId = (prefix: string): string => {
		sequence += 1;
		return `${prefix}-${sequence}`;
	};
	// Copied, ordered and frozen at seed time: the seed's own arrays are the caller's,
	// and a store that kept one would let two stores share the same list.
	const entriesByThread = new Map<ThreadId, readonly Entry[]>();
	for (const thread of threads) {
		entriesByThread.set(
			thread.id,
			ordered(seed.entries[thread.id] ?? EMPTY_ENTRIES),
		);
	}

	const entriesOf = (threadId: ThreadId): readonly Entry[] =>
		entriesByThread.get(threadId) ?? EMPTY_ENTRIES;
	/** A thread's last position: the number a replay or a read catches up to. */
	const lastSeqOf = (threadId: ThreadId): number =>
		lastSeq(entriesOf(threadId));
	const threadOf = (threadId: ThreadId): Thread | undefined =>
		threads.find((thread) => thread.id === threadId);

	/** Keys to the entry they already committed, so a replay finds the record rather than the text. */
	const committed = new Map<string, Entry>();

	// The watermarks, per `(principal, thread)`, in three rungs that stay apart. The
	// seed's own maps win; a principal it says nothing about gets the baseline, which is
	// that seeded history counts as delivered and nothing is credited as read.
	const watermarks = new Map<string, Marks>();
	const keyOf = (principalId: PrincipalId, threadId: ThreadId) =>
		`${principalId}\u0000${threadId}`;
	for (const principal of principals) {
		for (const thread of threads) {
			const seeded = options.watermarks?.[principal.id]?.[thread.id];
			watermarks.set(keyOf(principal.id, thread.id), {
				cursor: seeded?.cursor ?? lastSeq(entriesOf(thread.id)),
				seen: seeded?.seen ?? 0,
				acknowledged: seeded?.acknowledged ?? 0,
			});
		}
	}
	const marksOf = (principalId: PrincipalId, threadId: ThreadId): Marks => {
		const key = keyOf(principalId, threadId);
		const marks = watermarks.get(key);
		if (marks) return marks;
		// Both watermarks exist for every principal from the start: a principal that has
		// received nothing is at 0, not absent.
		const fresh: Marks = { cursor: 0, seen: 0, acknowledged: 0 };
		watermarks.set(key, fresh);
		return fresh;
	};

	// Delivery state per principal, not per store: pausing one subscriber says nothing
	// about another. Everyone starts connected, as the prototype did.
	const paused = new Set<PrincipalId>();

	/** Principals whose access has ended, and why. A map rather than a set because the cause matters. */
	const ended = new Map<PrincipalId, AccessEndCause>();
	/** The predicate for a cause nothing announces — expiry, which is a clock. */
	let accessCheck:
		| ((principalId: PrincipalId) => AccessEndCause | undefined)
		| undefined;
	/** Whoever asked to be told that the workspace's content changed wholesale. */
	const workspaceListeners = new Set<() => void>();
	/** Whoever asked to be told about an ending. Separate from commits: they are different facts. */
	const accessListeners = new Set<AccessEndListener>();
	/**
	 * The derivation the admission surface registers.
	 *
	 * `undefined` until something admits a principal, which is why `derivedIdentityFor` answers
	 * `undefined` rather than throwing: a workspace with no admissions has derived nothing about anyone,
	 * and that is a fact rather than an error.
	 */
	let deriveIdentity:
		| ((
				principalId: PrincipalId,
		  ) =>
				| { readonly issuer: string; readonly fingerprint: string }
				| undefined)
		| undefined;

	// Whoever asked to be told about commits. A set rather than a single callback,
	// because two subscribers on one store are two readers with their own cursors.
	const listeners = new Set<CommitListener>();

	/**
	 * **What a purge would remove**, from the predicate the purge itself uses.
	 *
	 * One function rather than two: the confirmation asks what would go, and the purge removes exactly
	 * that. Two implementations of "which records are demo" would be two answers, and the confirmation
	 * would drift from the act it describes.
	 */
	const purgeImpact = (): PurgeImpact => {
		const demoBoards = boards.filter((board) => board.origin === "demo");
		const demoBoardIds = new Set(demoBoards.map((board) => board.id));
		const demoThreads = threads.filter((thread) =>
			demoBoardIds.has(thread.boardId),
		);
		const demoThreadIds = new Set(demoThreads.map((thread) => thread.id));
		const demoEntries = [...entriesByThread.entries()].filter(([threadId]) =>
			demoThreadIds.has(threadId),
		);
		// **The overlap, and the predicate is narrower than it looks.** An entry counts as the reader's
		// when it was made **through the app** (`origin: "owner"`) by a principal a browser can act as.
		// The seeded entries are authored by those same principals — the seed's alex and maya wrote them —
		// so authorship alone would count the workspace's own demo conversation as the reader's, which is
		// the opposite of what the count is for. Measured: the first version reported 14 on an untouched
		// workspace.
		const ownEntriesOnDemoBoards = demoEntries.reduce(
			(total, [, entries]) =>
				total +
				entries.filter(
					(entry) =>
						entry.origin === "owner" &&
						principals.some(
							(principal) =>
								principal.id === entry.authorId &&
								principal.browserSelectable === true,
						),
				).length,
			0,
		);
		return {
			boards: demoBoards.length,
			threads: demoThreads.length,
			entries: demoEntries.reduce(
				(total, [, entries]) => total + entries.length,
				0,
			),
			resources: resources.filter((resource) =>
				demoBoardIds.has(resource.boardId),
			).length,
			ownEntriesOnDemoBoards,
		};
	};

	/**
	 * **The one entry-writing path.** Every kind of entry takes its `seq` here.
	 *
	 * 10a's central decision, and the reason it is a function rather than four copies of the same six
	 * lines: a status move, an artifact, an acknowledgement and a message must take numbers from **one
	 * counter** (spec L450), and four implementations of "read the last seq, add one, append" would be
	 * four places for that to stop being true. It is also where the permission is asked, so an act cannot
	 * be written by a principal that could not post.
	 *
	 * **One synchronous step.** The `seq` is computed and the entry that takes it is written with no
	 * `await` between them — the same rule `appendMessage` has followed since 02c, now stated once.
	 *
	 * A refusal happens **before** the `seq` is taken, so a refused act consumes no position and leaves
	 * the thread exactly as it was: there is no half-recorded act, and no gap in the numbering.
	 */
	const commitEntry = (
		threadId: ThreadId,
		authorId: PrincipalId,
		permission: PermissionName,
		build: (seq: number) => Entry,
	): Entry => {
		const thread = threadOf(threadId);
		if (!thread) throw new Error(errorMessages.threadNotFound);
		if (!holds(authorId, permission, thread.boardId)) {
			throw new Error(errorMessages.notABoardMember);
		}
		const current = entriesOf(threadId);
		const seq = lastSeq(current) + 1;
		const entry = frozen(build(seq));
		entriesByThread.set(threadId, Object.freeze([...current, entry]));
		let delivered = true;
		for (const principal of principals) {
			if (paused.has(principal.id)) {
				delivered = false;
				continue;
			}
			marksOf(principal.id, threadId).cursor = seq;
		}
		for (const listener of listeners) {
			listener({ threadId, entry, delivered });
		}
		return entry;
	};

	return {
		listBoards: () => boards,
		readBoard: (boardId) => boards.find((board) => board.id === boardId),
		listThreads: (boardId) =>
			threads.filter((thread) => thread.boardId === boardId),
		readThread: threadOf,
		readEntries: entriesOf,
		listResources: (boardId) =>
			resources.filter((resource) => resource.boardId === boardId),
		readPrincipal: (principalId) =>
			principals.find((principal) => principal.id === principalId),

		listMembers: (boardId) =>
			// A principal is on a board when it holds **any** grant there — which is what replaces the
			// predicate: membership is no longer a separate fact that could disagree with the grants.
			principals.filter(
				(principal) => grantOn(principal.id, boardId).length > 0,
			),

		lastSeq: lastSeqOf,

		readView: (threadId, principalId) => {
			const { cursor } = marksOf(principalId, threadId);
			return entriesOf(threadId).filter(
				(entry) => entry.seq <= cursor || entry.authorId === principalId,
			);
		},

		readPositions: (threadId) => {
			if (!threadOf(threadId)) throw new Error(errorMessages.threadNotFound);
			return principals.map((principal) => {
				const { cursor, seen, acknowledged } = marksOf(principal.id, threadId);
				return Object.freeze({
					principalId: principal.id,
					watermarks: Object.freeze({ cursor, seen, acknowledged }),
				});
			});
		},

		isPaused: (principalId) => paused.has(principalId),

		setConnection: (principalId, connected) => {
			if (!connected) {
				paused.add(principalId);
				return;
			}
			paused.delete(principalId);
			// Resume replays from the cursor: the withheld entries end at the thread's
			// last position, so delivering them is this one move, not a backlog.
			for (const thread of threads) {
				marksOf(principalId, thread.id).cursor = lastSeq(entriesOf(thread.id));
			}
		},

		markRead: (principalId, threadId) => {
			if (!threadOf(threadId)) throw new Error(errorMessages.threadNotFound);
			const marks = marksOf(principalId, threadId);
			// Deliberately does not touch `cursor`: receiving and reading are different
			// facts, and collapsing them is what makes a paused reader look caught up.
			marks.seen = Math.max(marks.seen, lastSeq(entriesOf(threadId)));
		},

		endAccess: (principalId, cause) => {
			ended.set(principalId, cause);
			// **An ending is an event**, because a long-lived connection has to learn about it rather than
			// poll for it (spec L362). Notified through the same listener set as a commit: the stream
			// already watches that, and a second channel would be a second thing to keep alive.
			for (const listener of accessListeners) {
				listener({ principalId, cause });
			}
		},

		accessEndedFor: (principalId) =>
			ended.get(principalId) ?? accessCheck?.(principalId),

		announceWorkspaceChange: () => {
			for (const listener of workspaceListeners) {
				listener();
			}
		},

		registerAccessCheck: (check) => {
			accessCheck = check;
		},

		/**
		 * What a purge would remove, computed from the same predicate the purge uses.
		 *
		 * **One predicate, two callers.** The confirmation asks what *would* go; the purge removes exactly
		 * that. Two implementations of "which records are demo" would be two answers, and the confirmation
		 * would drift from the act it describes.
		 *
		 * The second number is the honest one: the demo records are the workspace's, and the reader's own
		 * entries on those boards are the reader's. 14:14 requires naming that overlap before it happens.
		 */
		purgeImpact: () => purgeImpact(),

		/**
		 * Remove every demo-origin record, and nothing else.
		 *
		 * **Origin is provenance, never permission.** The caller was authorized at the boundary; this
		 * function decides what to remove from `origin` alone, and that is the only place `origin` decides
		 * anything in the product — which is why AGENTS.md's rule and 14:11 say the same thing.
		 *
		 * Principals, grants, watermarks and sessions are **untouched** (14:13, 14:19): a purge that logged
		 * the reader out or stripped access would make demo content feel load-bearing for identity.
		 */
		purgeDemoContent: () => {
			const impact = purgeImpact();
			const demoBoardIds = new Set(
				boards
					.filter((board) => board.origin === "demo")
					.map((board) => board.id),
			);
			const demoThreadIds = new Set(
				threads
					.filter((thread) => demoBoardIds.has(thread.boardId))
					.map((thread) => thread.id),
			);
			boards = Object.freeze(boards.filter((board) => board.origin !== "demo"));
			threads = Object.freeze(
				threads.filter((thread) => !demoBoardIds.has(thread.boardId)),
			);
			for (const threadId of demoThreadIds) {
				entriesByThread.delete(threadId);
			}
			resources = Object.freeze(
				resources.filter((resource) => !demoBoardIds.has(resource.boardId)),
			);
			return impact;
		},

		/**
		 * Put the demo content back, **without duplicating what survived**.
		 *
		 * 14:16. Restore re-seeds by id: a demo record that survived a purge under the same id is left
		 * alone, so restore cannot produce two copies of the same demo board. What restore cannot do is
		 * bring back a demo thread the reader had *added activity to* and then purged — that activity was
		 * the reader's and the thread was demo, so both went. Restore returns the seeded thread, and the
		 * reader's own entries do not come back with it, because they are not the demo's to restore.
		 */
		restoreDemoContent: () => {
			const demoBoards = seedSnapshot.boards;
			const demoThreadList = seedSnapshot.threads;
			const demoResources = seedSnapshot.resources;
			let restored = 0;

			const missingBoards = demoBoards.filter(
				(seed) => !boards.some((board) => board.id === seed.id),
			);
			if (missingBoards.length > 0) {
				boards = Object.freeze([...boards, ...missingBoards]);
				restored += missingBoards.length;
			}

			const missingThreads = demoThreadList.filter(
				(seed) => !threads.some((thread) => thread.id === seed.id),
			);
			if (missingThreads.length > 0) {
				threads = Object.freeze([...threads, ...missingThreads]);
				restored += missingThreads.length;
			}

			const missingResources = demoResources.filter(
				(seed) => !resources.some((resource) => resource.id === seed.id),
			);
			if (missingResources.length > 0) {
				resources = Object.freeze([...resources, ...missingResources]);
				restored += missingResources.length;
			}

			// The seed's entries, for every thread whose chronology is now empty. A thread that survived has
			// its entries; a thread that was purged has none, and the seed's are what a restore puts back.
			const seededEntries = seedSnapshot.entries;
			for (const [threadId, entries] of Object.entries(seededEntries)) {
				if (!threads.some((thread) => thread.id === threadId)) continue;
				if ((entriesByThread.get(threadId) ?? []).length > 0) continue;
				entriesByThread.set(threadId, Object.freeze([...entries]));
				restored += entries.length;
			}

			return { restored };
		},

		derivedIdentityFor: (principalId) => deriveIdentity?.(principalId),

		registerDerivedIdentity: (derive) => {
			deriveIdentity = derive;
		},

		onWorkspaceChange: (listener) => {
			workspaceListeners.add(listener);
			return () => {
				workspaceListeners.delete(listener);
			};
		},

		onAccessEnded: (listener) => {
			accessListeners.add(listener);
			return () => {
				accessListeners.delete(listener);
			};
		},

		onCommit: (listener) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},

		createBoard: (input) => {
			const name = input.name.trim();
			// `app.js` L116: the mark is the name's first letter and the hue defaults to blue.
			const board: Board = Object.freeze({
				id: nextId("board"),
				name,
				short: (name[0] ?? "B").toUpperCase(),
				theme: "blue" as const,
				description:
					input.description?.trim() || "Shared conversations and resources.",
				origin: "owner" as const,
			});
			boards = Object.freeze([...boards, board]);
			// **The creator holds the member grant on the board it just made**, in the same act.
			//
			// Without this the reader creates a room they cannot speak in: a grant *is* the membership, so
			// `appendMessage` asks `post:message` against the new board and nobody holds it. The prototype
			// does the equivalent at `app.js` L116 — `members: ['alex', 'maya', 'orion', 'beacon']` — and
			// this is that rule expressed as a grant.
			//
			// **Only the creator**, and the difference from the prototype is deliberate: the prototype is a
			// one-browser demo where everybody is in every room, and a real workspace should not silently
			// add participants to a board somebody else made.
			//
			// Found by 14's purge test, which created a board, created a thread on it, and could not post —
			// the sequence 09:14 promises and this line is what makes true.
			grants = Object.freeze([
				...grants,
				{
					granterId: input.creatorId,
					principalId: input.creatorId,
					scope: "board" as const,
					boardId: board.id,
					permissions: BOARD_MEMBER_PERMISSIONS,
				},
			]);
			return board;
		},

		createThread: (input) => {
			if (!boards.some((board) => board.id === input.boardId)) {
				throw new Error(errorMessages.boardNotFound);
			}
			const thread: Thread = Object.freeze({
				id: nextId("thread"),
				boardId: input.boardId,
				title: input.title.trim(),
				creatorId: input.creatorId,
				// A thread made through the app is not pinned: pinning is a seeded state until
				// something offers it as an action, and inventing that action here would be 09's.
				pinned: false,
				// A new thread starts open. The seed's one resolved thread exists so that the two
				// members of the set are both observable — a set whose only seen value is the default
				// cannot be told from a constant.
				status: "open",
				createdAt: new Date().toISOString(),
				origin: "owner" as const,
			});
			threads = Object.freeze([...threads, thread]);
			entriesByThread.set(thread.id, EMPTY_ENTRIES);
			return thread;
		},

		admitPrincipal: (input) => {
			if (principals.some((principal) => principal.id === input.principalId)) {
				throw new Error(errorMessages.principalExists);
			}
			// An admitted agent is a principal of kind agent — the one kind it could be, since this path
			// exists for agents and a human participant is provisioned rather than admitted.
			const principal: Principal = Object.freeze({
				id: input.principalId,
				name: input.name,
				kind: "agent" as const,
				description: input.description,
				origin: "owner" as const,
				// Not browser-selectable: a session is issued to a browser and an agent presents a
				// credential. Issuing it a cookie would be the conflation spec L404 forbids.
				browserSelectable: false,
			});
			principals = Object.freeze([...principals, principal]);
			return principal;
		},

		grantsFor: (principalId, boardId) =>
			boardId === undefined
				? grantOnWorkspace(principalId)
				: grantOn(principalId, boardId),

		permits: (principalId, permission, boardId) =>
			holds(principalId, permission, boardId),

		grant: (input) => {
			// **The order is the contract, and each step is a different family of refusal.**
			//
			// 1. A permission outside the vocabulary is a VALIDATION failure, before any rule runs
			//    (07b:18), so a caller learns "that is not a permission" rather than "you may not give
			//    it".
			const unknown = unknownPermission(input.permissions);
			if (unknown !== undefined) {
				throw new Error(
					`${errorMessages.grantMalformed}: ${unknown} is not a permission`,
				);
			}
			// 2. The shape: a scope it can act on, and a board exactly when it is board-scoped.
			if (!isWellFormedGrant(input)) {
				throw new Error(errorMessages.grantMalformed);
			}
			// 3. The two rules 07b adds, checked against the granter and the recipient.
			checkGrant(
				{
					granterId: input.granterId,
					recipientId: input.principalId,
					permissions: input.permissions,
					scope: input.scope,
					boardId: input.boardId,
				},
				{
					readPrincipal: (principalId) =>
						principals.find((principal) => principal.id === principalId),
					workspacePermissions: grantOnWorkspace,
					anyBoardPermissions: (principalId) => [
						...new Set(
							boards.flatMap((board) => grantOn(principalId, board.id)),
						),
					],
				},
			);
			// 4. The write, in the same synchronous step as the checks above. No `await` between the
			// read of the old state and this append, which is what makes two concurrent grants unable
			// to both read the old grant and both write (07b:19). There is no lock because there is
			// nothing to lock: JavaScript runs this function to completion.
			grants = Object.freeze([...grants, Object.freeze({ ...input })]);
			return grants;
		},

		addResource: (input) => {
			if (!boards.some((board) => board.id === input.boardId)) {
				throw new Error(errorMessages.boardNotFound);
			}
			const resource: Resource = Object.freeze({
				id: nextId("res"),
				boardId: input.boardId,
				name: input.name.trim(),
				url: input.url,
				type: input.type,
				description: input.description,
				origin: "owner" as const,
			});
			resources = Object.freeze([...resources, resource]);
			return resource;
		},

		/**
		 * Attach a resource to a thread: an **artifact** entry that names the resource by id.
		 *
		 * The entry holds no copy of the resource's content — that is the whole rule (spec L435), and it is
		 * why the field is `resourceId` and not `resource`. Two threads attaching one resource produce two
		 * entries and one record; a test asserts the record count.
		 *
		 * The store checks the resource exists **on this thread's board**, because an artifact pointing at
		 * another board's resource would be a reference the thread's readers cannot resolve.
		 */
		attachResource: (input) => {
			const thread = threadOf(input.threadId);
			if (!thread) throw new Error(errorMessages.threadNotFound);
			const resource = resources.find(
				(candidate) => candidate.id === input.resourceId,
			);
			if (!resource || resource.boardId !== thread.boardId) {
				throw new Error(errorMessages.resourceNotFound);
			}
			return commitEntry(
				input.threadId,
				input.authorId,
				"add:artifact",
				(seq) => ({
					id: `art-${input.threadId}-${seq}`,
					kind: "artifact" as const,
					seq,
					authorId: input.authorId,
					createdAt: new Date().toISOString(),
					origin: "owner" as const,
					resourceId: resource.id,
				}),
			);
		},

		/**
		 * Move a thread's status: a **status-move** entry recording the transition, with its author.
		 *
		 * `from` is the caller's belief and is **checked against the thread's actual status**: a stale
		 * control would otherwise move a thread twice, and the second entry would record a transition that
		 * never happened. This is optimistic concurrency with a synchronous store — there is no window to
		 * race, but a browser tab left open is exactly that window.
		 */
		moveStatus: (input) => {
			const thread = threadOf(input.threadId);
			if (!thread) throw new Error(errorMessages.threadNotFound);
			if (thread.status !== input.from) {
				throw new Error(errorMessages.statusChanged);
			}
			if (!isThreadStatus(input.to)) {
				throw new Error(errorMessages.statusUnknown);
			}
			if (input.to === thread.status) {
				// A move to the status it is already in is not a move. Refused rather than recorded,
				// because an entry saying "open → open" is an event that did not happen.
				throw new Error(errorMessages.statusUnchanged);
			}
			const entry = commitEntry(
				input.threadId,
				input.authorId,
				"move:status",
				(seq) => ({
					id: `mv-${input.threadId}-${seq}`,
					kind: "status-move" as const,
					seq,
					authorId: input.authorId,
					createdAt: new Date().toISOString(),
					origin: "owner" as const,
					from: thread.status,
					to: input.to,
				}),
			);
			// Written only after the entry exists: the status is derived from the chronology and this is
			// the only writer, so there is no state in which the thread says one thing and the last
			// status-move entry says another.
			threads = Object.freeze(
				threads.map((candidate) =>
					candidate.id === thread.id
						? Object.freeze({ ...candidate, status: input.to })
						: candidate,
				),
			);
			return entry;
		},

		/**
		 * A principal reporting how far it has got: an **acknowledgement** entry and a watermark.
		 *
		 * The two things this is and is not, both of them the model rather than a courtesy:
		 *
		 * - It advances **this principal's** `acknowledged` watermark and no one else's. A test asserts a
		 *   second principal's watermark is untouched.
		 * - It carries **no verdict**: there is no field that could read as approval, and it cannot
		 *   substitute for a status move (spec L438, DESIGN.md §295).
		 *
		 * Acknowledging backwards is refused: the ladder only goes up, which is what makes "has this
		 * principal caught up" answerable from one number.
		 */
		acknowledge: (input) => {
			const thread = threadOf(input.threadId);
			if (!thread) throw new Error(errorMessages.threadNotFound);
			const marks = marksOf(input.authorId, input.threadId);
			if (!holds(input.authorId, "acknowledge:thread", thread.boardId)) {
				throw new Error(errorMessages.notABoardMember);
			}
			if (input.upTo < marks.acknowledged) {
				throw new Error(errorMessages.acknowledgementBehind);
			}
			if (input.upTo > lastSeqOf(input.threadId)) {
				throw new Error(errorMessages.acknowledgementAhead);
			}
			const fromUpTo = marks.acknowledged;
			const entry = commitEntry(
				input.threadId,
				input.authorId,
				"acknowledge:thread",
				(seq) => ({
					id: `ack-${input.threadId}-${seq}`,
					kind: "acknowledgement" as const,
					seq,
					authorId: input.authorId,
					createdAt: new Date().toISOString(),
					origin: "owner" as const,
					upTo: input.upTo,
					fromUpTo,
				}),
			);
			marks.acknowledged = input.upTo;
			return entry;
		},

		appendMessage: (input) => {
			// Idempotency is checked before validation: a retry must be safe, so a stored
			// key returns the stored entry even when the retry's own payload would now be
			// refused.
			if (input.idempotencyKey !== undefined) {
				const replay = committed.get(input.idempotencyKey);
				if (replay) return replay;
			}

			// The documented order: thread, then membership, then text.
			const thread = threadOf(input.threadId);
			if (!thread) throw new Error(errorMessages.threadNotFound);
			if (!holds(input.authorId, "post:message", thread.boardId)) {
				throw new Error(errorMessages.notABoardMember);
			}
			const text = input.text.trim();
			if (text === "") throw new Error(errorMessages.messageEmpty);

			const current = entriesOf(input.threadId);
			const seq = lastSeq(current) + 1;
			// One synchronous step: the next `seq` and the entry that takes it are decided
			// here and written on the next line, with no `await` between them and nothing
			// else able to run. A later asynchronous store must preserve that pairing.
			const entry = frozen({
				id: `msg-${input.threadId}-${seq}`,
				kind: "message",
				seq,
				authorId: input.authorId,
				createdAt: new Date().toISOString(),
				origin: "owner",
				text,
				references: input.references ?? [],
				...(input.relation ? { relation: input.relation } : {}),
			});
			entriesByThread.set(input.threadId, Object.freeze([...current, entry]));

			if (input.idempotencyKey !== undefined) {
				committed.set(input.idempotencyKey, entry);
			}
			// Delivery is a consequence of the commit and never a condition of it: a paused
			// principal's cursor stays where it is, and the entry it did not receive is
			// still in the thread.
			let delivered = true;
			for (const principal of principals) {
				if (paused.has(principal.id)) {
					delivered = false;
					continue;
				}
				marksOf(principal.id, input.threadId).cursor = seq;
			}
			for (const listener of listeners) {
				listener({ threadId: input.threadId, entry, delivered });
			}
			return entry;
		},
	};
};
