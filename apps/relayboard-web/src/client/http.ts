import type {
	AcknowledgeInput,
	AddResourceInput,
	AppendMessageInput,
	AttachResourceInput,
	BoardSummary,
	CreateBoardInput,
	CreateThreadInput,
	Entry,
	ParticipantRead,
	PrincipalPosition,
	PrincipalSummary,
	RelayboardClient,
	Resource,
	SetConnectionInput,
	StreamHandlers,
	StreamState,
	ThreadContents,
	Unsubscribe,
} from "#/client";
import { NotYetImplementedError } from "#/client";
import type {
	BoardId,
	Principal,
	PrincipalId,
	Seq,
	Thread,
	ThreadId,
} from "#/domain";
import {
	listBoards,
	listMembers,
	listResources,
	listThreads,
	readActingPrincipal,
	readMessages,
	readPositions,
	readPrincipal,
	readThread,
} from "#/server/functions/read";

/**
 * The HTTP implementation of `RelayboardClient`: the reads, over the server's functions.
 *
 * **This build serves the reads and nothing else.** Every mutation and `subscribe` throws a
 * `NotYetImplementedError` naming the ticket that lands it, because the rule this repo keeps
 * applying to absent capabilities is that they must fail loudly: a stub returning `undefined`
 * or an empty array would read as a pass to a conformance suite and to a reader alike.
 *
 * Why the reads can be honest here and the writes cannot: 06a's server functions are the
 * read half of the transport, and the writes need the acting principal resolved from a
 * session (06b) before they can take an author from anything but the caller. Implementing
 * `appendMessage` here now would mean either accepting an `authorId` from the browser —
 * which the whole design forbids — or pretending a session exists.
 *
 * The functions are imported rather than fetched by hand: `createServerFn` returns a callable
 * whose client half performs the RPC, so this file is a thin adapter and the transport stays
 * TanStack Start's. That also means this module is part of the client bundle and must not
 * import anything server-only — it imports the *function definitions*, which the plugin
 * splits, never `src/server/store/**`.
 */
export const createHttpClient = (): RelayboardClient => ({
	listBoards: async (): Promise<readonly BoardSummary[]> =>
		(await listBoards()) as readonly BoardSummary[],

	listThreads: async (boardId: BoardId): Promise<readonly Thread[]> =>
		(await listThreads({ data: { boardId } })) as readonly Thread[],

	readThread: async (threadId: ThreadId): Promise<ThreadContents> =>
		(await readThread({ data: { threadId } })) as ThreadContents,

	readMessages: async (
		threadId: ThreadId,
		options?: { readonly after?: Seq },
	): Promise<readonly Entry[]> =>
		(await readMessages({
			data: { threadId, after: options?.after },
		})) as readonly Entry[],

	/**
	 * Who this client acts as, as the **server** resolved it.
	 *
	 * The one answer to "who am I" that the app may rely on over HTTP: the cookie is `HttpOnly`,
	 * so a script cannot read it, and guessing from the seed gets a second browser wrong. This
	 * calls the resolver's own read, which returns the principal and never the cookie.
	 */
	readActingPrincipal: async (): Promise<Principal> =>
		(await readActingPrincipal()) as Principal,

	listResources: async (boardId: BoardId): Promise<readonly Resource[]> =>
		(await listResources({ data: { boardId } })) as readonly Resource[],

	readPositions: async (
		threadId: ThreadId,
	): Promise<readonly PrincipalPosition[]> =>
		(await readPositions({
			data: { threadId },
		})) as readonly PrincipalPosition[],

	listMembers: async (boardId: BoardId): Promise<readonly PrincipalSummary[]> =>
		(await listMembers({
			data: { boardId },
		})) as readonly PrincipalSummary[],

	readPrincipal: async ({
		principalId,
		boardId,
	}: {
		readonly principalId: PrincipalId;
		readonly boardId: BoardId;
	}): Promise<ParticipantRead> =>
		(await readPrincipal({
			data: { principalId, boardId },
		})) as ParticipantRead,

	// --- the writes, which 06c lands ---
	appendMessage: async (_input: AppendMessageInput): Promise<Entry> => {
		throw new NotYetImplementedError("appendMessage", "ticket 06c");
	},
	createThread: async (_input: CreateThreadInput): Promise<Thread> => {
		throw new NotYetImplementedError("createThread", "ticket 06c");
	},
	createBoard: async (_input: CreateBoardInput): Promise<BoardSummary> => {
		throw new NotYetImplementedError("createBoard", "ticket 06c");
	},
	addResource: async (_input: AddResourceInput): Promise<Resource> => {
		throw new NotYetImplementedError("addResource", "ticket 06c");
	},
	simulateIncoming: async (_threadId: ThreadId): Promise<Entry> => {
		throw new NotYetImplementedError("simulateIncoming", "ticket 06c");
	},
	attachResource: async (_input: AttachResourceInput): Promise<Entry> => {
		throw new NotYetImplementedError("attachResource", "ticket 10a");
	},
	moveStatus: async (_input: {
		threadId: ThreadId;
		from: string;
		to: string;
	}): Promise<Entry> => {
		throw new NotYetImplementedError("moveStatus", "ticket 10a");
	},
	acknowledge: async (_input: AcknowledgeInput): Promise<Entry> => {
		throw new NotYetImplementedError("acknowledge", "ticket 10a");
	},

	/**
	 * The transport's connection state.
	 *
	 * A no-op returning the current state, exactly as the in-memory client does: pause is the
	 * reader's own state and delivery belongs to the stream (11b), and this build has no
	 * stream yet. `pending` is `0` here rather than derived, because with no subscription
	 * there is nothing outstanding to report — and it says so instead of guessing.
	 */
	setConnection: async (_input: SetConnectionInput): Promise<StreamState> => ({
		connected: false,
		pending: 0,
	}),

	/**
	 * The stream, which is a server route rather than a function (spec L357) and arrives in 11a.
	 *
	 * Throws rather than returning an empty subscription: an empty subscription is
	 * indistinguishable from a thread with no entries, which is precisely the failure mode
	 * spec L518 forbids. A caller that ignores this will get an exception at the call site,
	 * which is where 11a's implementation will be.
	 */
	subscribe: (_handlers: StreamHandlers): Unsubscribe => {
		throw new Error(
			"subscribe is not served in this build: the stream is a server route, not a server function, and it arrives with ticket 11a",
		);
	},
});
