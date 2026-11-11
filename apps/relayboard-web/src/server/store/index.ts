import type {
	Board,
	BoardId,
	Entry,
	EntryReference,
	EntryRelation,
	Principal,
	PrincipalId,
	Resource,
	Thread,
	ThreadId,
	Watermarks,
} from "#/domain";
import { errorMessages } from "#/domain";

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
	 * This is the seeding path's second input, beside membership: the demo seed's
	 * `seen` map and stream `cursors` (`app.js` L83) become entries here, and a
	 * principal with no entry starts at the baseline — everything seeded is delivered,
	 * nothing is read.
	 */
	readonly watermarks?: StoreWatermarks;

	/**
	 * Whether this principal is on this board today.
	 *
	 * The provisional stand-in for a grant. The prototype encoded membership as a
	 * `board.members` array; in this model a principal is on a board because it holds
	 * a grant there, and grants arrive in 07a. Until then the store is handed a
	 * predicate rather than inventing a member list it would have to delete later.
	 * One function, named as the stand-in, is the whole of the debt.
	 */
	isBoardMember(principalId: PrincipalId, boardId: BoardId): boolean;
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

	/** The principal read the thread: `seen` catches up to the last position. `cursor` does not move. */
	markRead(principalId: PrincipalId, threadId: ThreadId): void;

	appendMessage(input: AppendMessageInput): Entry;
}

const EMPTY_ENTRIES: readonly Entry[] = Object.freeze([]);

const EMPTY_SEED: StoreSeed = {
	principals: [],
	boards: [],
	threads: [],
	entries: {},
	resources: [],
};

/** Nobody is on any board, which is the honest state of a workspace with no grants. */
const NO_MEMBERS: StoreOptions = { isBoardMember: () => false };

/** Deep-freezes an entry, so a `seq` handed to a caller cannot be reassigned by one. */
const frozen = (entry: Entry): Entry => {
	Object.freeze(entry.references);
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
	options: StoreOptions = NO_MEMBERS,
): Store => {
	const principals = collection(seed.principals);
	const boards = collection(seed.boards);
	const threads = collection(seed.threads);
	const resources = collection(seed.resources);
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
			if (!options.isBoardMember(input.authorId, thread.boardId)) {
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
			for (const principal of principals) {
				if (paused.has(principal.id)) continue;
				marksOf(principal.id, input.threadId).cursor = seq;
			}
			return entry;
		},
	};
};
