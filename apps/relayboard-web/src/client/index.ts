import type {
	Board,
	BoardId,
	Entry,
	EntryReference,
	EntryRelation,
	Grant,
	Origin,
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

/**
 * The domain vocabulary the interface's signatures name, re-exported here.
 *
 * A caller that renders against this interface needs the record types it hands back,
 * and importing them from one module keeps the seam single: `src/client` is what a
 * component imports for data, and it gets the shapes with the operations rather than
 * reaching past them into the domain barrel.
 */
export type {
	Board,
	BoardId,
	Entry,
	EntryReference,
	EntryRelation,
	Grant,
	Origin,
	PermissionName,
	Principal,
	PrincipalId,
	Resource,
	ResourceId,
	Seq,
	Thread,
	ThreadId,
	Watermarks,
} from "#/domain";

/**
 * What a participant can do, and the only thing the UI is allowed to depend on.
 *
 * One interface, two implementations: the in-memory one in this directory, and the HTTP
 * one that arrives with the server functions (06a reads, 06c writes). The UI renders
 * against this, so swapping the transport touches nothing above it, and the whole data
 * layer is testable with no server and no network.
 *
 * The interface is **what a participant can do**, which is why two surfaces are
 * deliberately outside it: admission (the agent knocks, a human decides) and permission
 * administration. Both are reached by a caller who is not yet a participant, or by the
 * one principal who may change a grant, and putting either here would make the
 * interface's contract conditional on who is calling.
 *
 * Three rules the signatures encode:
 *
 * 1. **No operation takes an author.** The acting principal is resolved by the
 *    transport and never named in a payload (spec L376), so a browser cannot post as
 *    somebody else. The in-memory implementation takes that principal in its
 *    constructor; the HTTP one will take it from the session cookie.
 * 2. **Every operation that needs a grant declares it**, in one table below rather than
 *    in a branch inside a handler. 07a reads the table; this ticket only makes the
 *    declaration exist and complete.
 * 3. **A thread's contents are `Entry[]`, never `Message[]`.** `Entry` is a union with
 *    one member today; 10a adds three more, and widening a union is an addition rather
 *    than a refactor of every signature here.
 */

/**
 * A board as a list returns it: the record, plus how many participants it has.
 *
 * The count is an addition *beside* the record rather than a field on it, because
 * `read:member` is a permission of its own (spec L425): a caller allowed to list boards
 * is not thereby allowed to list who is on them, so the list carries a number and never
 * a list. Keeping `memberCount` off the domain `Board` is what stops a later caller
 * reading the participants off the board payload, which is exactly the leak the
 * prototype has.
 */
export type BoardSummary = Board & { readonly memberCount: number };

/**
 * One participant, as a list returns it.
 *
 * An id, a name and a kind: enough to attribute an entry, which the reader already
 * sees on every message. Nothing declared and nothing about what it may do — those are
 * the second participant read's business, and that one is entitled by `read:member` on
 * one board.
 */
/**
 * What one principal may do, at each scope it can mean.
 *
 * Board-scoped permissions are what a control *on this board* needs; workspace-scoped ones are what a
 * control *in the workspace* needs. They are separate because the answers are separate — a board member
 * holds `create:thread` on a board and no `create:board` at all, and a superadmin holds `create:board`
 * and no board grant.
 */
export interface HeldPermissions {
	readonly onBoard: readonly PermissionName[];
	readonly workspace: readonly PermissionName[];
}

export interface PrincipalSummary {
	readonly id: PrincipalId;
	readonly name: string;
	readonly kind: Principal["kind"];
}

/**
 * What a principal asserted about itself, kept separate from what was derived.
 *
 * `GLOSSARY.md`: a **declared** value is one a principal asserts about itself and is
 * "never verified, never tinted with the accent, never carrying a checkmark". A
 * **derived** value is one this workspace computed from a credential it issued. The
 * two are never merged into one bag of strings, because 12 has to label one and not the
 * other, and the prototype's drawer shows both under "Verified identity" — the mistake
 * this split exists to prevent.
 */
export interface DeclaredValues {
	/** The principal's own description of itself, as seeded from `app.js` L21-27. */
	readonly description: string;
	/** The operator the principal named, for an agent that knocked (08a). */
	readonly operator?: string;
	/** Why it asked to be admitted (08a). */
	readonly reason?: string;
}

/**
 * One participant, with the grant it holds **on one board**.
 *
 * The board id is a parameter rather than a field of the result because "what may this
 * participant do here" is a question with no meaning without a "here": a grant is per
 * board, and a read that took only a principal id could not answer it. Taking the board
 * also means the grant returned was checked against that board (spec L316).
 */
export interface ParticipantRead {
	/** The record. Its derived values — issuer, fingerprint — arrive with 08c and are computed, never seeded. */
	readonly principal: Principal;
	/** What it may do on the board that was asked about, and nothing outside it. */
	readonly grant: Grant;
	/** What it says about itself, separate so a client can label it declared. */
	readonly declared: DeclaredValues;
}

/** A thread and its contents, in canonical order. */
export interface ThreadContents {
	readonly thread: Thread;
	/** By `seq`, never by `createdAt`. A union of entry kinds with one member today. */
	readonly entries: readonly Entry[];
}

/** Where one principal has got to in one thread: the three-rung ladder. */
export interface PrincipalPosition {
	readonly principalId: PrincipalId;
	readonly watermarks: Watermarks;
}

/** The stream's state as the reader sees it, derived from the cursor rather than held in a flag. */
export interface StreamState {
	/** Whether the reader is receiving. The in-memory client is always connected until it is paused. */
	readonly connected: boolean;
	/** Entries committed while paused, awaiting replay. Zero when connected. */
	readonly pending: number;
}

/** The prototype's `appendMessage` input, without the `authorId` it used to accept. */
export interface AppendMessageInput {
	readonly threadId: ThreadId;
	readonly text: string;
	readonly references?: readonly EntryReference[];
	readonly relation?: EntryRelation;
	/** A retry key: replaying one appends nothing and returns the entry already stored. */
	readonly idempotencyKey?: string;
}

export interface CreateThreadInput {
	readonly boardId: BoardId;
	readonly title: string;
	/** The prototype's optional description (`app.js` L165), which the thread record does not carry. */
	readonly description?: string;
}

export interface CreateBoardInput {
	readonly name: string;
	readonly description?: string;
}

/**
 * The four resource types the prototype uses, closed.
 *
 * The seed's three (`app.js` L30-32: `Document`, `Repository`, `Design`) plus `Link`,
 * which is the prototype's own default on `addResource` (`app.js` L117). Asserted closed
 * here because 09 validates it at the boundary and a free string is a field nothing can
 * filter on later; the domain's `Resource.type` stays a string until that ticket closes it
 * beside the validator.
 */
export type ResourceType = "Document" | "Repository" | "Design" | "Link";

export interface AddResourceInput {
	readonly boardId: BoardId;
	readonly name: string;
	readonly url: string;
	/** Defaults to `Link`, as the prototype does. */
	readonly type?: ResourceType;
	readonly description: string;
}

export interface AttachResourceInput {
	readonly threadId: ThreadId;
	readonly resourceId: ResourceId;
}

export interface MoveStatusInput {
	readonly threadId: ThreadId;
	/**
	 * The status the mover believes the thread is in; a move from anything else is refused.
	 *
	 * Typed as the closed set rather than as a string: a caller that names a status outside it is a
	 * compile error in-process and a validation failure on the wire, which is the two places it can be
	 * caught. The store still checks, because a wire payload arrives as JSON.
	 */
	readonly from: ThreadStatus;
	readonly to: ThreadStatus;
}

export interface AcknowledgeInput {
	readonly threadId: ThreadId;
	/** How far this principal reports it has taken the thread into account. */
	readonly upTo: Seq;
}

export interface SetConnectionInput {
	readonly connected: boolean;
}

/**
 * The stream's event vocabulary.
 *
 * The eight names below are the **wire** vocabulary (spec L358) — exactly the set 11a
 * asserts a server route emits — plus one that is deliberately not on the wire:
 * `stream-error` is reported *by the client* when it cannot reach the stream, so the
 * interface can show "disconnected" rather than an empty thread (spec L518). Naming it
 * here rather than inventing a second channel is what lets a subscriber handle every
 * outcome through one callback, and keeping it out of the eight is what keeps 11a's
 * literal-set assertion true.
 *
 * Every entry-bearing event carries its entry, and the entry carries its `seq`; the
 * client uses that `seq` as its cursor and never does sequence arithmetic of its own.
 */
export type StreamEvent =
	/** The eight events a server route emits. */
	| {
			readonly type: "message-committed";
			readonly threadId: ThreadId;
			readonly entry: Entry;
			/** Whether this delivery reached the subscriber or is awaiting replay. */
			readonly delivered: boolean;
	  }
	| { readonly type: "thread-created"; readonly thread: Thread }
	| { readonly type: "board-created"; readonly board: Board }
	| { readonly type: "resource-created"; readonly resource: Resource }
	| {
			readonly type: "artifact-attached";
			readonly threadId: ThreadId;
			readonly entry: Entry;
	  }
	| {
			readonly type: "status-moved";
			readonly threadId: ThreadId;
			readonly entry: Entry;
	  }
	| {
			readonly type: "acknowledged";
			readonly threadId: ThreadId;
			readonly entry: Entry;
	  }
	| {
			readonly type: "connection-changed";
			readonly connected: boolean;
			/** How many entries a resume replayed. Present even when zero (11a:17). */
			readonly pending: number;
			/**
			 * **Why** the connection ended, when it ended because access did (11c:14-15).
			 *
			 * Absent for an ordinary connect or disconnect. Present as `"revoked"` or `"expired"` so the
			 * reader can be told access has ended rather than that the connection failed — and so the
			 * client does not retry into a stream it may no longer read.
			 */
			readonly cause?: "revoked" | "expired";
	  }
	| {
			/**
			 * **Not a wire event.** The client reports it when the transport fails, so a
			 * failure is never rendered as an absence (spec L518).
			 */
			readonly type: "stream-error";
			readonly message: string;
	  };

/** The eight-event wire subset, for a server route to assert against (11a). */
export type WireStreamEventType = Exclude<StreamEvent["type"], "stream-error">;

export interface StreamHandlers {
	readonly onEvent: (event: StreamEvent) => void;
}

export type Unsubscribe = () => void;

/**
 * What a participant can do.
 *
 * Every member is a promise, including the reads, because the real implementation is
 * over the wire. The in-memory one is synchronous underneath and resolves immediately,
 * which is the point of the seam: a screen written against this does not know the
 * difference.
 */
export interface RelayboardClient {
	// --- the prototype's nine, carried forward in name and intent ---
	listBoards(): Promise<readonly BoardSummary[]>;
	listThreads(boardId: BoardId): Promise<readonly Thread[]>;
	/** The prototype's name for the subset read: entries after a position. */
	readMessages(
		threadId: ThreadId,
		options?: { readonly after?: Seq },
	): Promise<readonly Entry[]>;
	appendMessage(input: AppendMessageInput): Promise<Entry>;
	createThread(input: CreateThreadInput): Promise<Thread>;
	createBoard(input: CreateBoardInput): Promise<BoardSummary>;
	addResource(input: AddResourceInput): Promise<Resource>;
	setConnection(input: SetConnectionInput): Promise<StreamState>;
	simulateIncoming(threadId: ThreadId): Promise<Entry>;

	// --- reading the objects that now have entries of their own ---
	/** A thread as a chronology: the record and its entries, not just its messages. */
	readThread(threadId: ThreadId): Promise<ThreadContents>;
	listResources(boardId: BoardId): Promise<readonly Resource[]>;

	// --- the authored acts beyond a message (the store writes them from 10a) ---
	attachResource(input: AttachResourceInput): Promise<Entry>;
	moveStatus(input: MoveStatusInput): Promise<Entry>;
	acknowledge(input: AcknowledgeInput): Promise<Entry>;

	// --- how far each principal has got, and who is here ---
	readPositions(threadId: ThreadId): Promise<readonly PrincipalPosition[]>;
	/** Who is on this board. Gated by `read:member`, which is why it is not on the board payload. */
	listMembers(boardId: BoardId): Promise<readonly PrincipalSummary[]>;
	/** One participant with the grant it holds on one board. Gated by `read:member`. */
	readPrincipal(input: {
		readonly principalId: PrincipalId;
		readonly boardId: BoardId;
	}): Promise<ParticipantRead>;

	/**
	 * Who this client acts as.
	 *
	 * The transport's own answer, not the frame's: an HTTP client asks the server, which resolved
	 * a principal from the session cookie it issued; the in-memory client answers from the
	 * principal it was constructed with, because there is no session in that build. Putting the
	 * question on the interface is what keeps one rule in the UI — "ask the transport who I am" —
	 * rather than a branch per component on which transport is in use.
	 *
	 * It is a read, so it is asynchronous like every other; a caller that needs it at first paint
	 * primes it in the route's loader rather than letting the answer arrive after hydration.
	 */
	readActingPrincipal(): Promise<Principal>;

	/**
	 * What this client may do, kept at the two scopes it can mean.
	 *
	 * Two lists rather than one union: a board-scoped permission and a workspace-scoped one are
	 * different statements, and a surface that renders both kinds of control needs to know which it
	 * has. Merging them would either disable a workspace holder's controls or offer a board holder
	 * controls that only a workspace grant justifies.
	 */
	readHeldPermissions(boardId: BoardId): Promise<HeldPermissions>;

	// --- the stream ---
	subscribe(handlers: StreamHandlers): Unsubscribe;
}

/** Every member of the interface, as a value a table can be built from. */
export const clientOperations = [
	"listBoards",
	"listThreads",
	"readMessages",
	"appendMessage",
	"createThread",
	"createBoard",
	"addResource",
	"setConnection",
	"simulateIncoming",
	"readThread",
	"listResources",
	"attachResource",
	"moveStatus",
	"acknowledge",
	"readPositions",
	"listMembers",
	"readPrincipal",
	"readActingPrincipal",
	"readHeldPermissions",
	"subscribe",
] as const satisfies readonly (keyof RelayboardClient)[];

export type ClientOperation = (typeof clientOperations)[number];

/**
 * What an operation requires of its caller.
 *
 * A named permission, a permission satisfied by holding it on any board, or nothing at all with
 * the reason stated. Modelled as three shapes rather than one nullable field so a reader cannot
 * mistake "no requirement" for "a predicate I did not bother to name" — the distinction 06c's
 * error mapping and 07a's matrix both depend on.
 */
export type PermissionRequirement =
	| PermissionName
	| { readonly atLeastOneBoard: PermissionName }
	| { readonly none: string };

/**
 * What an operation requires of the caller, declared once.
 *
 * Three kinds of answer, and they are three different symbols rather than one overloaded one,
 * because "no grant" and "a grant you cannot name as a permission" are not the same statement and
 * a reader must not have to guess which one a bare `null` meant:
 *
 * 1. **A named permission** — the common case. `appendMessage` requires `post:message`, and 07a
 *    enforces it at the boundary rather than in the UI.
 * 2. **`{ atLeastOneBoard: "read:board" }`** — the requirement is real but cannot be expressed as
 *    one name, because it is satisfied by holding the permission on *any* board (spec L339).
 *    `subscribe` and `setConnection` carry it: opening the stream needs no particular board, only
 *    that the caller can read one.
 * 3. **`{ none: "..." }`** — nothing is required, and the value is the reason. `readActingPrincipal`
 *    is the one operation here: an unauthenticated caller must be able to ask who it is, because
 *    that is how a client learns it has no session at all. Requiring a grant would make the
 *    question unanswerable exactly when the answer is "nobody".
 *
 * The third kind needs a reason rather than a bare `true`, so a reviewer can disagree with the
 * judgement instead of having to reconstruct it.
 *
 * The table is exhaustive by type over `ClientOperation`, so an operation added to the interface
 * without a line here does not compile. "Every operation declares what it requires" is therefore
 * a fact the compiler keeps rather than a review step.
 */
export const operationPermissions = {
	listBoards: "read:board",
	listThreads: "read:board",
	readMessages: "read:board",
	appendMessage: "post:message",
	createThread: "create:thread",
	createBoard: "create:board",
	addResource: "add:resource",
	setConnection: { atLeastOneBoard: "read:board" },
	simulateIncoming: "post:message",
	readThread: "read:board",
	listResources: "read:resource",
	attachResource: "add:artifact",
	moveStatus: "move:status",
	acknowledge: "acknowledge:thread",
	readPositions: "read:thread",
	listMembers: "read:member",
	readPrincipal: "read:member",
	readHeldPermissions: {
		none: "Reading your own permissions requires no grant beyond having them, for the same reason readActingPrincipal does not: a surface must be able to ask what it may offer before offering it, and a control that is disabled because the answer was unreadable would be indistinguishable from one disabled because the permission is missing.",
	},
	readActingPrincipal: {
		none: "Knowing which principal you are requires no grant: a caller with no session must be able to ask, which is how a client learns it has none. The spec's permission table gains a row for this operation; it has no equivalent today because the prototype had no session.",
	},
	subscribe: { atLeastOneBoard: "read:board" },
} as const satisfies Record<ClientOperation, PermissionRequirement>;

/**
 * The documented failure of an operation this build does not implement yet.
 *
 * Three acts — attach a resource, move a status, acknowledge — are on the interface
 * because this ticket must establish its shape, but the store writes them from 10a. The
 * in-memory client therefore throws this rather than returning a stub entry, on the rule
 * 06a applies to unwritten operations: it must be impossible for an absent feature to
 * read as a pass. The message names the ticket so a reader lands on the work that fixes
 * it.
 */
export class NotYetImplementedError extends Error {
	constructor(operation: ClientOperation, ticket: string) {
		super(
			`${operation} is not implemented in this build; it arrives with ${ticket}`,
		);
		this.name = "NotYetImplementedError";
	}
}

/** The origin of a record a client created, as opposed to one the seed supplied. */
export const OWNER_ORIGIN: Origin = "owner";
