import type {
	AcknowledgeInput,
	AddResourceInput,
	AppendMessageInput,
	AttachResourceInput,
	BoardSummary,
	CreateBoardInput,
	CreateThreadInput,
	DeclaredValues,
	Grant,
	MoveStatusInput,
	ParticipantRead,
	PrincipalPosition,
	PrincipalSummary,
	RelayboardClient,
	SetConnectionInput,
	StreamEvent,
	StreamHandlers,
	StreamState,
	ThreadContents,
	Unsubscribe,
} from "#/client";
import { NotYetImplementedError } from "#/client";
import type {
	BoardId,
	Entry,
	PermissionName,
	Principal,
	PrincipalId,
	ThreadId,
} from "#/domain";
import { errorMessages } from "#/domain";
import type { Store } from "#/server/store";
import { createStore } from "#/server/store";
import { demoOptions, demoSeed } from "#/server/store/demo-seed";

/**
 * The in-memory implementation of `RelayboardClient`.
 *
 * A thin adapter, on purpose: every rule lives in the store, and this file's whole job is
 * to translate the interface's promises into the store's synchronous calls while fixing
 * **who is acting**. That is the one thing a transport knows and the store must not: the
 * client is constructed for a principal and never accepts one in a payload, which is what
 * makes "no client names its own author" true here and reproducible over a cookie in 06b.
 *
 * Three things this file does not do, each deliberately:
 *
 * - **It does not check permissions.** 07a's check runs at the boundary, and putting a
 *   copy here would be a second place to disagree with it. It *declares* them, through
 *   `operationPermissions` in `src/client`.
 * - **It does not hold a connection flag.** `setConnection` is a no-op returning the
 *   current {@link StreamState}, because pause is the reader's own state and delivery
 *   belongs to the stream (11b:17). The store's pause primitive drives the in-memory
 *   subscription's withholding, not a modelled transport.
 * - **It does not fake the three acts the store cannot write yet.** They throw
 *   {@link NotYetImplementedError} naming 10a, so their absence cannot read as a pass.
 *
 * It is honest about the store's lifetime in one producer-visible place, because the
 * interface may never claim a guarantee the implementation does not make: everything
 * here is in memory, and a process restart clears it.
 */

/**
 * What one subscriber has seen, and where it is.
 *
 * Kept beside the client rather than inside it: a subscription is a reader's position in
 * a thread, and two subscriptions on one client are two positions.
 */
interface Subscription {
	readonly handlers: StreamHandlers;
	closed: boolean;
}

/** A store and the one principal this client acts as. */
export interface InMemoryClientOptions {
	/** The workspace. Defaults to a fresh demo seed, which is what the app runs against in this build. */
	readonly store?: Store;
	/** The principal the client acts as: the session's, in the app; a literal in a test. */
	readonly principalId: PrincipalId;
}

/**
 * Builds a client over one store, acting as one principal.
 *
 * `principalId` is read once, at construction. A caller that wants a second participant
 * builds a second client over the same store — which is how 06c's two-browser test will
 * describe one workspace seen by two participants without inventing a mock for it.
 */
export const createInMemoryClient = (
	options: InMemoryClientOptions,
): RelayboardClient => {
	const store = options.store ?? createStore(demoSeed(), demoOptions());
	const actingAs = options.principalId;
	const subscriptions = new Set<Subscription>();

	/**
	 * Resolved once, at construction, and refused if the workspace does not hold it.
	 *
	 * A session naming a principal that no longer exists resolves to no principal and the
	 * request is refused rather than silently becoming somebody else (spec L371). Issuing
	 * and resolving a session is 06b's; until then the only way to reach this is to build a
	 * client for an id the workspace does not hold, which is exactly what this guards.
	 */
	if (!store.readPrincipal(actingAs)) {
		throw new Error(
			`No principal ${actingAs} in this workspace: a session naming an unknown principal is refused rather than reassigned`,
		);
	}

	/**
	 * The grant this principal holds on one board, as the store can answer today.
	 *
	 * Until 07a lands real grants, membership is the stand-in: a principal on a board holds
	 * `read:board`, `read:thread`, `read:resource`, `read:member`, `post:message`,
	 * `create:thread`, `add:resource` and `add:artifact` there — everything the prototype
	 * let a member do — and `create:board` nowhere, because only the superadmin's
	 * workspace grant holds that.
	 */
	const grantOn = (principalId: PrincipalId, boardId: BoardId): Grant => {
		const member = store
			.listMembers(boardId)
			.some((principal) => principal.id === principalId);
		return {
			scope: "board",
			permissions: member ? MEMBER_PERMISSIONS : [],
		};
	};

	// The prototype cycles its four example lines (app.js L119-124) and numbers each
	// simulation, so a repeated click is a new entry rather than an idempotent replay.
	let simulations = 0;
	const nextSimulation = (): number => {
		simulations += 1;
		return simulations;
	};
	/** The prototype cycles its four example lines (app.js L120-123) rather than repeating one. */
	const simulatedLine = (simulation: number): string =>
		SIMULATED_LINES[(simulation - 1) % SIMULATED_LINES.length] as string;

	/** How many entries this principal has been delivered in a thread, from its own cursor. */
	const pendingIn = (threadId: ThreadId): number => {
		const position = store
			.readPositions(threadId)
			.find((candidate) => candidate.principalId === actingAs);
		const cursor = position?.watermarks.cursor ?? 0;
		return Math.max(0, store.readEntries(threadId).length - cursor);
	};

	/** The reader's own last position in each thread, which is what its badges count from. */
	const pendingTotal = (): number =>
		store
			.listBoards()
			.flatMap((board) => store.listThreads(board.id))
			.reduce((total, thread) => total + pendingIn(thread.id), 0);

	const emit = (event: StreamEvent): void => {
		for (const subscription of subscriptions) {
			if (subscription.closed) continue;
			// `stream-error` is never emitted here: it is the client reporting a transport
			// failure, and the in-memory transport cannot fail.
			subscription.handlers.onEvent(event);
		}
	};

	// One listener on the store, registered once per client rather than once per
	// subscription: the store announces commits, and this client turns them into events
	// for whoever is watching.
	store.onCommit((commit) => {
		emit({
			type: "message-committed",
			threadId: commit.threadId,
			entry: commit.entry,
			delivered: commit.delivered,
		});
	});

	return {
		listBoards: async (): Promise<readonly BoardSummary[]> =>
			store.listBoards().map((board) => ({
				...board,
				memberCount: store.listMembers(board.id).length,
			})),

		listThreads: async (boardId) => store.listThreads(boardId),

		readMessages: async (threadId, readOptions) => {
			const entries = store.readEntries(threadId);
			const after = readOptions?.after ?? 0;
			return entries.filter((entry) => entry.seq > after);
		},

		readThread: async (threadId): Promise<ThreadContents> => {
			const thread = store.readThread(threadId);
			if (!thread) throw new Error(errorMessages.threadNotFound);
			// Reading is an act: it advances this principal's `seen` watermark and nothing
			// else, which is what makes the unread badge mean something.
			store.markRead(actingAs, threadId);
			return { thread, entries: store.readEntries(threadId) };
		},

		listResources: async (boardId) => store.listResources(boardId),

		appendMessage: async (input: AppendMessageInput) =>
			store.appendMessage({
				threadId: input.threadId,
				// The author is the resolved principal, never a field of the payload.
				authorId: actingAs,
				text: input.text,
				references: input.references,
				relation: input.relation,
				idempotencyKey: input.idempotencyKey,
			}),

		createThread: async (input: CreateThreadInput) => {
			const thread = store.createThread({
				boardId: input.boardId,
				title: input.title,
				description: input.description,
				creatorId: actingAs,
			});
			emit({ type: "thread-created", thread });
			return thread;
		},

		createBoard: async (input: CreateBoardInput): Promise<BoardSummary> => {
			const board = store.createBoard({
				name: input.name,
				description: input.description,
			});
			emit({ type: "board-created", board });
			return { ...board, memberCount: store.listMembers(board.id).length };
		},

		addResource: async (input: AddResourceInput) => {
			const resource = store.addResource({
				boardId: input.boardId,
				name: input.name,
				url: input.url,
				// The prototype's default on `addResource` (app.js L117); 09 validates the
				// closed set at the boundary rather than letting a free string through.
				type: input.type ?? "Link",
				description: input.description,
			});
			emit({ type: "resource-created", resource });
			return resource;
		},

		setConnection: async (
			_input: SetConnectionInput,
		): Promise<StreamState> => ({
			// A no-op: the reader is connected for as long as it holds this client. `pending`
			// is derived from the cursor rather than from a counter, so nothing here can
			// disagree with the watermarks the store keeps.
			connected: true,
			pending: pendingTotal(),
		}),

		simulateIncoming: async (threadId) => {
			const thread = store.readThread(threadId);
			if (!thread) throw new Error(errorMessages.threadNotFound);
			// The author is chosen here, server-side, from the board's agent members: the
			// caller cannot say which agent speaks, so authoring an agent's words never
			// becomes the caller's own claim (spec L375).
			const agents = store
				.listMembers(thread.boardId)
				.filter((principal) => principal.kind === "agent");
			const agent = agents[0];
			if (!agent) {
				throw new Error("This board has no agent principal to speak");
			}
			// Numbered first, so the line and the key describe the same simulation.
			const simulation = nextSimulation();
			return store.appendMessage({
				threadId,
				authorId: agent.id,
				text: simulatedLine(simulation),
				idempotencyKey: `sim-${simulation}`,
			});
		},

		readPositions: async (threadId): Promise<readonly PrincipalPosition[]> =>
			store.readPositions(threadId),

		listMembers: async (boardId): Promise<readonly PrincipalSummary[]> =>
			store.listMembers(boardId).map((principal) => ({
				id: principal.id,
				name: principal.name,
				kind: principal.kind,
			})),

		readActingPrincipal: async () => store.readPrincipal(actingAs) as Principal,

		readPrincipal: async ({
			principalId,
			boardId,
		}): Promise<ParticipantRead> => {
			const principal = store.readPrincipal(principalId);
			if (!principal) {
				throw new Error(`No principal ${principalId} in this workspace`);
			}
			const declared: DeclaredValues = {
				// The principal's own description of itself. Declared, never verified: 12 labels
				// it as such, and the derived issuer and fingerprint arrive with 08c.
				description: principal.description,
			};
			return { principal, grant: grantOn(principalId, boardId), declared };
		},

		attachResource: async (_input: AttachResourceInput): Promise<Entry> => {
			throw new NotYetImplementedError("attachResource", "ticket 10a");
		},

		moveStatus: async (_input: MoveStatusInput): Promise<Entry> => {
			throw new NotYetImplementedError("moveStatus", "ticket 10a");
		},

		acknowledge: async (_input: AcknowledgeInput): Promise<Entry> => {
			throw new NotYetImplementedError("acknowledge", "ticket 10a");
		},

		subscribe: (handlers: StreamHandlers): Unsubscribe => {
			const subscription: Subscription = { handlers, closed: false };
			subscriptions.add(subscription);
			return () => {
				subscription.closed = true;
				subscriptions.delete(subscription);
			};
		},
	};
};

/**
 * What a member of a board may do there, until 07a's grants.
 *
 * Everything the prototype let a member do on its board (`app.js` L140-160 reads and
 * L178 posts), expressed as the spec's named permissions. It is the honest stand-in:
 * broad enough that the demo workspace behaves as it looks, and scoped to a board so
 * nothing here can become a workspace-wide capability.
 */
const MEMBER_PERMISSIONS: readonly PermissionName[] = [
	"read:board",
	"read:thread",
	"read:resource",
	"read:member",
	"post:message",
	"create:thread",
	"add:resource",
	"add:artifact",
];

/** The prototype's four simulated lines (app.js L120-123), in its order. */
const SIMULATED_LINES: readonly string[] = [
	"A quick follow-up from my independent session: I’ve reviewed the latest thread context. The message history is consistent with the proposed boundary.",
	"I found one useful clarification: an event notification is not the same as a committed message. Clients should use the canonical history for recovery.",
	"Adding a note for everyone: my local processing is independent of this board. I’m posting the result here so other participants can find it.",
	"I’ve checked the latest messages. No conflicting updates so far; I’ll continue to observe this thread asynchronously.",
];
