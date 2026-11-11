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
	Principal,
	PrincipalId,
	ThreadId,
} from "#/domain";
import { errorMessages } from "#/domain";
import type { Store } from "#/server/store";
import { createStore } from "#/server/store";
import { demoOptions, demoSeed } from "#/server/store/demo-seed";
import { connectionChanged, entryCommitted } from "#/server/stream";

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
	 * request is refused rather than silently becoming somebody else (spec L373). Issuing
	 * and resolving a session is 06b's; until then the only way to reach this is to build a
	 * client for an id the workspace does not hold, which is exactly what this guards.
	 */
	if (!store.readPrincipal(actingAs)) {
		throw new Error(
			`No principal ${actingAs} in this workspace: a session naming an unknown principal is refused rather than reassigned`,
		);
	}

	/**
	 * The grant this principal holds on one board — **the real one, since 07a.**
	 *
	 * `MEMBER_PERMISSIONS` is gone. It was the stand-in that derived a grant from membership, and a
	 * stand-in that survives its ticket is how a placeholder becomes a design: this now asks the
	 * store, which holds grant records, so "on the board" and "may do this here" are one mechanism.
	 */
	const grantOn = (principalId: PrincipalId, boardId: BoardId): Grant => ({
		scope: "board",
		permissions: store.grantsFor(principalId, boardId),
	});

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
		// **The same contract module the SSE route uses**, not a second literal. Since 11a there are two
		// transports, and a name that appeared in one and not the other would be invisible until a
		// component handled it — which is exactly the divergence 11a:19 asks the contract test to catch.
		// Asking the *per-principal* question rather than the commit's workspace-wide flag, for the
		// reason the route does.
		if (store.isPaused(actingAs)) return;
		emit(entryCommitted(commit.threadId, commit.entry, commit.delivered));
	});

	/**
	 * **An ending reaches an open subscription**, as it does on the SSE route (spec L362, 11c:14).
	 *
	 * Announced first and then closed, in that order, so the reader is told *why* rather than watching a
	 * stream go quiet. The subscriptions are cleared after the announcement, which is what makes the
	 * next commit fail to reach this client — the assertion 11c:24 asks for.
	 *
	 * There is no polling here, and that is the honest shape: the in-memory transport has no clock, so a
	 * revocation announced through the store is the only ending it can observe. Expiry is a clock, and
	 * its cause arrives the same way through the store's registered check whenever anything asks.
	 */
	store.onAccessEnded((event) => {
		if (event.principalId !== actingAs) return;
		emit(connectionChanged(false, 0, event.cause));
		for (const subscription of subscriptions) {
			subscription.closed = true;
		}
		subscriptions.clear();
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
				// The acting principal, because the creator holds the board's member grant.
				creatorId: actingAs,
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

		/**
		 * Pause or resume this reader, **through the store**, which owns the primitive.
		 *
		 * Until 11a this was a no-op returning `connected: true`: the store's pause existed since 02b
		 * and nothing wired it, so the contract test's "a paused subscriber receives nothing" failed
		 * with the entry delivered. The fix is one call — and it is the reason the ticket says the
		 * pause primitive 02b built is what 11a wires rather than replaces.
		 *
		 * `pending` is derived from the cursor rather than from a counter, so nothing here can
		 * disagree with the watermarks the store keeps.
		 */
		setConnection: async (input: SetConnectionInput): Promise<StreamState> => {
			// **The count first, then the state.** Resuming repositions the cursor to each thread's last
			// seq, so a count taken afterwards is zero — measured, and it is the same order the server
			// function uses and the prototype used (app.js L118).
			const pending = pendingTotal();
			store.setConnection(actingAs, input.connected);
			return { connected: input.connected, pending };
		},

		/** What a purge would remove. The same predicate the purge uses, so the two cannot disagree. */
		purgeImpact: async () => store.purgeImpact(),

		/**
		 * Remove the demo content.
		 *
		 * `confirmed` is checked here as it is on the wire: the in-memory transport is a transport, not a
		 * different product, so an unconfirmed purge is refused rather than performed.
		 */
		purgeDemoContent: async (input) => {
			if (input.confirmed !== true) {
				throw new Error("A purge must be confirmed: nothing was removed");
			}
			const impact = store.purgeDemoContent();
			store.announceWorkspaceChange();
			return impact;
		},

		restoreDemoContent: async () => {
			const result = store.restoreDemoContent();
			store.announceWorkspaceChange();
			return result;
		},

		simulateIncoming: async (threadId) => {
			const thread = store.readThread(threadId);
			if (!thread) throw new Error(errorMessages.threadNotFound);
			// The author is chosen here, server-side, from the board's agent members: the
			// caller cannot say which agent speaks, so authoring an agent's words never
			// becomes the caller's own claim (spec L377).
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

		readHeldPermissions: async (boardId) => ({
			onBoard: store.grantsFor(actingAs, boardId),
			workspace: store.grantsFor(actingAs),
		}),

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
			return {
				principal,
				grant: grantOn(principalId, boardId),
				declared,
				// The same derivation the server function asks for, so the two transports answer one shape.
				derived: store.derivedIdentityFor(principalId),
			};
		},

		attachResource: async (input: AttachResourceInput): Promise<Entry> => {
			// The author is the acting principal, never the caller: the interface has no `authorId`
			// field (06c), so a forged one cannot reach even this build.
			return store.attachResource({
				threadId: input.threadId,
				resourceId: input.resourceId,
				authorId: actingAs,
			});
		},

		moveStatus: async (input: MoveStatusInput): Promise<Entry> =>
			store.moveStatus({
				threadId: input.threadId,
				from: input.from,
				to: input.to,
				authorId: actingAs,
			}),

		acknowledge: async (input: AcknowledgeInput): Promise<Entry> =>
			// Advances **this** principal's `acknowledged` watermark and no other: acknowledgement is
			// personal, and the store is where that is enforced.
			store.acknowledge({
				threadId: input.threadId,
				upTo: input.upTo,
				authorId: actingAs,
			}),

		/**
		 * The stream, on the same contract the SSE route serves.
		 *
		 * **It replays on subscribe and reports the count**, which the first version did not: it simply
		 * registered a listener, so a subscriber that arrived after a commit never learned about it and
		 * the two transports disagreed about what a fresh subscription means. The contract test is what
		 * caught it — the same case run against both transports, which is precisely why 11a:19 asks for
		 * that test rather than two tests.
		 *
		 * The cursor is the **reader's own** watermark, so a second principal's replay is different and
		 * neither advances the other's (11a:22).
		 */
		subscribe: (handlers: StreamHandlers): Unsubscribe => {
			const subscription: Subscription = { handlers, closed: false };

			// The reader's actual state rather than an assumption — the same correction the SSE route
			// needed for 11b:21.
			const ended = store.accessEndedFor(actingAs);
			if (ended !== undefined) {
				// **The same ending the SSE route reports**, so a reader sees one behaviour whichever
				// transport it is on (11c:21). Announced, then closed — not a silent no-op.
				handlers.onEvent(connectionChanged(false, 0, ended));
				return () => undefined;
			}

			// Replay first, then report the count — `pending` always present, including zero.
			let pending = 0;
			for (const board of store.listBoards()) {
				for (const thread of store.listThreads(board.id)) {
					const cursor =
						store
							.readPositions(thread.id)
							.find((position) => position.principalId === actingAs)?.watermarks
							.cursor ?? 0;
					for (const entry of store.readEntries(thread.id)) {
						if (entry.seq <= cursor) continue;
						pending += 1;
						handlers.onEvent(entryCommitted(thread.id, entry, true));
					}
				}
			}
			handlers.onEvent(connectionChanged(!store.isPaused(actingAs), pending));

			subscriptions.add(subscription);
			return () => {
				subscription.closed = true;
				subscriptions.delete(subscription);
			};
		},
	};
};

/** The prototype's four simulated lines (app.js L120-123), in its order. */
const SIMULATED_LINES: readonly string[] = [
	"A quick follow-up from my independent session: I’ve reviewed the latest thread context. The message history is consistent with the proposed boundary.",
	"I found one useful clarification: an event notification is not the same as a committed message. Clients should use the canonical history for recovery.",
	"Adding a note for everyone: my local processing is independent of this board. I’m posting the result here so other participants can find it.",
	"I’ve checked the latest messages. No conflicting updates so far; I’ll continue to observe this thread asynchronously.",
];
