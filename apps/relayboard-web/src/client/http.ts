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
import {
	acknowledge,
	addResource,
	appendMessage,
	attachResource,
	createBoard,
	createThread,
	moveStatus,
	setConnection as setConnectionFn,
	simulateIncoming,
} from "#/server/functions/write";

/**
 * The error families a caller can act on differently.
 *
 * **07c closes the gap the ticket pass found in 06c:19** — the server has carried stable codes since
 * 06c and the client cast every response without looking. A refusal now arrives as a typed error
 * rather than as a bare `Error` with the right message, so the interface can distinguish "you may
 * not" from "that is malformed" from "that does not exist" (07a:18).
 *
 * The mapping is by `name` because that is what survives serialisation: the server sends a
 * `ServerError` and the response carries its `name` and `message`. `code` is the durable key on the
 * server side; this is the client's reading of the same fact.
 */
export class RelayboardRequestError extends Error {
	readonly family:
		| "validation"
		| "unresolved"
		| "unknown-object"
		| "unimplemented";

	constructor(
		family: "validation" | "unresolved" | "unknown-object" | "unimplemented",
		message: string,
	) {
		super(message);
		this.name = "RelayboardRequestError";
		this.family = family;
	}
}

/**
 * The family a thrown transport error belongs to.
 *
 * A `PermissionDenied` reaches the browser as a serialised `ServerError` with `code: "unresolved"`
 * and the documented message, so the client reads the message the domain already owns rather than
 * inventing a second vocabulary. Anything unrecognised is reported as `validation`, which is the
 * family whose advice ("retrying unchanged will fail again") is safe to give about an error nobody
 * anticipated.
 */
export const failureFamily = (
	error: unknown,
): RelayboardRequestError["family"] => {
	const message = error instanceof Error ? error.message : String(error);
	if (/permission|not a board member|No principal/i.test(message)) {
		return "unresolved";
	}
	if (/not found|No (thread|board|entry|paragraph)/i.test(message)) {
		return "unknown-object";
	}
	if (/arrives with ticket|not served in this build/i.test(message)) {
		return "unimplemented";
	}
	return "validation";
};

/**
 * The HTTP implementation of `RelayboardClient`: every operation over the server's functions.
 *
 * **Every payload is built field by field, never spread from the input.** That is not style: it is
 * the second line of the rule that no operation accepts an author from the caller. The interface has
 * no `authorId` field, so a well-typed caller cannot supply one — but a caller who casts can, and a
 * spread would put it on the wire for the server to strip. Building the body explicitly means the
 * forged field never leaves the browser, so there is nothing to strip and nothing to probe.
 *
 * `subscribe` is the one operation that does not live here as an RPC, and it throws naming 11a: the
 * stream is a server route rather than a server function (spec L357), so it is 11a's, and an empty
 * subscription would be indistinguishable from a thread with no entries — the failure spec L518
 * forbids.
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

	// --- the writes ---

	/**
	 * Post a message.
	 *
	 * **No author is sent, because there is nowhere to send one.** The input the interface accepts has
	 * no `authorId` field, and the payload below is constructed field by field rather than spread, so
	 * even a caller who casts their input cannot get an author onto the wire: the body is built from
	 * the fields this cast names, and an extra property is simply not among them.
	 */
	appendMessage: async (input: AppendMessageInput): Promise<Entry> =>
		(await appendMessage({
			data: {
				threadId: input.threadId,
				text: input.text,
				// Copied out of the readonly interface type into the array shape the wire schema takes.
				// A spread here rather than the value itself, because readonly and mutable differ and
				// the schema is the boundary: what leaves the browser is a plain array.
				references: input.references
					? input.references.map((reference) => ({
							resourceId: reference.resourceId,
						}))
					: undefined,
				relation: input.relation,
				idempotencyKey: input.idempotencyKey,
			},
		})) as Entry,

	createThread: async (input: CreateThreadInput): Promise<Thread> =>
		(await createThread({
			data: {
				boardId: input.boardId,
				title: input.title,
				description: input.description,
			},
		})) as Thread,

	createBoard: async (input: CreateBoardInput): Promise<BoardSummary> =>
		(await createBoard({
			data: { name: input.name, description: input.description },
		})) as BoardSummary,

	addResource: async (input: AddResourceInput): Promise<Resource> =>
		(await addResource({
			data: {
				boardId: input.boardId,
				name: input.name,
				url: input.url,
				type: input.type,
				description: input.description,
			},
		})) as Resource,

	simulateIncoming: async (threadId: ThreadId): Promise<Entry> =>
		(await simulateIncoming({ data: { threadId } })) as Entry,

	attachResource: async (input: AttachResourceInput): Promise<Entry> =>
		(await attachResource({
			data: { threadId: input.threadId, resourceId: input.resourceId },
		})) as Entry,

	moveStatus: async (input: {
		threadId: ThreadId;
		from: string;
		to: string;
	}): Promise<Entry> =>
		(await moveStatus({
			data: { threadId: input.threadId, from: input.from, to: input.to },
		})) as Entry,

	acknowledge: async (input: AcknowledgeInput): Promise<Entry> =>
		(await acknowledge({
			data: { threadId: input.threadId, upTo: input.upTo },
		})) as Entry,

	/**
	 * The transport's connection state.
	 *
	 * A no-op returning the current state, exactly as the in-memory client does: pause is the
	 * reader's own state and delivery belongs to the stream (11b), and this build has no
	 * stream yet. `pending` is `0` here rather than derived, because with no subscription
	 * there is nothing outstanding to report — and it says so instead of guessing.
	 */
	setConnection: async (input: SetConnectionInput): Promise<StreamState> =>
		(await setConnectionFn({
			data: { connected: input.connected },
		})) as StreamState,

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
