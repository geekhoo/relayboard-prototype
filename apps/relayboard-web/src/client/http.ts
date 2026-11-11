import type {
	AcknowledgeInput,
	AddResourceInput,
	AppendMessageInput,
	AttachResourceInput,
	BoardSummary,
	CreateBoardInput,
	CreateThreadInput,
	Entry,
	HeldPermissions,
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
	ThreadStatus,
} from "#/domain";
import {
	listBoards,
	listMembers,
	listResources,
	listThreads,
	readActingPrincipal,
	readHeldPermissions,
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
import {
	advanceCursor,
	eventOf,
	STREAM_PATH,
	WIRE_EVENT_NAMES,
} from "#/server/stream";

/**
 * The families a caller can act on differently.
 *
 * **Five, and the split between the first two is the point.** 06c:19 and 06b:22 both ask for a
 * refusal to be distinguishable from an unauthenticated result, and an earlier version of this file
 * mapped them to the *same* value (`unresolved`): a permission refusal and "we do not know who you
 * are" produced one answer, so a caller could not tell "you may not" from "log in". They are
 * different instructions to a reader, so they are different families:
 *
 * - **`denied`** — the caller is authenticated and is being told no. There is nothing to retry and
 *   nothing to fix by identifying again; the answer is a capability the caller does not have.
 * - **`unauthenticated`** — there is no principal to act as. The one case a client must not retry
 *   silently (spec L517), because the request will fail identically until a session exists.
 */
export type FailureFamily =
	| "denied"
	| "unauthenticated"
	| "validation"
	| "unknown-object"
	| "unimplemented";

/**
 * The message a UI can show per family.
 *
 * Exported so a component says the same thing in the same words rather than inventing a sentence per
 * call site — and so the wording is one place to change when 12 adds the participant drawels. The
 * server's own message is still carried on the error: these are the *fallbacks* for a surface that
 * wants to speak in its own voice about the family rather than repeat a server string.
 */
export const failureMessage: Readonly<Record<FailureFamily, string>> = {
	denied: "This participant does not hold the permission that action requires",
	unauthenticated:
		"There is no session to act as — start a session and try again",
	validation: "That request could not be understood",
	"unknown-object": "That does not exist in this workspace",
	unimplemented: "This build does not serve that operation yet",
};

/** A transport failure, carrying the family so a caller branches on it rather than on a string. */
export class RelayboardRequestError extends Error {
	readonly family: FailureFamily;

	constructor(family: FailureFamily, message: string) {
		super(message);
		this.name = "RelayboardRequestError";
		this.family = family;
	}
}

/**
 * The family a thrown transport error belongs to.
 *
 * Read from the **message the domain already owns** rather than from a second vocabulary: the server
 * sends a `ServerError`, and after serialisation the message is what reaches the browser.
 *
 * The order of the tests matters. `not a board member` and `permission` are refusals of a *known*
 * caller; `No principal` and the admission-token message are the absence of one. Testing the
 * absence first would classify a board-membership refusal as unauthenticated if a message ever named
 * both — so the specific refusal patterns are tested before the general absence pattern.
 */
export const failureFamily = (error: unknown): FailureFamily => {
	const message = error instanceof Error ? error.message : String(error);
	// A refusal of an authenticated caller: a capability is missing, nothing is wrong with the session.
	if (
		/permission|not a board member|cannot exceed|do not hold it yourself|only be granted to a human/i.test(
			message,
		)
	) {
		return "denied";
	}
	// No principal to act as. The absence, tested after the refusals so a message naming both lands on
	// the refusal.
	if (
		/No principal|no session|does not match any issued admission|not a gate holder|requires admit:agent/i.test(
			message,
		)
	) {
		return "unauthenticated";
	}
	if (
		/not found|No (thread|board|entry|paragraph|such participant)/i.test(
			message,
		)
	) {
		return "unknown-object";
	}
	if (/arrives with ticket|not served in this build/i.test(message)) {
		return "unimplemented";
	}
	return "validation";
};

/**
 * Run one server-function call, attaching the family to whatever it throws.
 *
 * **Every operation below goes through this**, which is what makes the classifier on the path rather
 * than beside it: a component catches a `RelayboardRequestError` and branches on `.family` without
 * parsing a message. An earlier version exported `failureFamily` and wrapped nothing, so the
 * classification existed and was unreachable — the appearance of error handling.
 *
 * `RelayboardRequestError` is passed through unchanged, so a nested call does not rewrap and lose
 * anything it carried.
 */
const call = async <T>(invoke: () => Promise<T>): Promise<T> => {
	try {
		return await invoke();
	} catch (error) {
		if (error instanceof RelayboardRequestError) throw error;
		throw new RelayboardRequestError(
			failureFamily(error),
			error instanceof Error ? error.message : String(error),
		);
	}
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
		(await call(() => listBoards())) as readonly BoardSummary[],

	listThreads: async (boardId: BoardId): Promise<readonly Thread[]> =>
		(await call(() => listThreads({ data: { boardId } }))) as readonly Thread[],

	readThread: async (threadId: ThreadId): Promise<ThreadContents> =>
		(await call(() => readThread({ data: { threadId } }))) as ThreadContents,

	readMessages: async (
		threadId: ThreadId,
		options?: { readonly after?: Seq },
	): Promise<readonly Entry[]> =>
		(await call(() =>
			readMessages({ data: { threadId, after: options?.after } }),
		)) as readonly Entry[],

	/**
	 * Who this client acts as, as the **server** resolved it.
	 *
	 * The one answer to "who am I" that the app may rely on over HTTP: the cookie is `HttpOnly`,
	 * so a script cannot read it, and guessing from the seed gets a second browser wrong. This
	 * calls the resolver's own read, which returns the principal and never the cookie.
	 */
	readActingPrincipal: async (): Promise<Principal> =>
		(await call(() => readActingPrincipal())) as Principal,

	readHeldPermissions: async (boardId: BoardId): Promise<HeldPermissions> =>
		(await call(() =>
			readHeldPermissions({ data: { boardId } }),
		)) as HeldPermissions,

	listResources: async (boardId: BoardId): Promise<readonly Resource[]> =>
		(await call(() =>
			listResources({ data: { boardId } }),
		)) as readonly Resource[],

	readPositions: async (
		threadId: ThreadId,
	): Promise<readonly PrincipalPosition[]> =>
		(await call(() =>
			readPositions({ data: { threadId } }),
		)) as readonly PrincipalPosition[],

	listMembers: async (boardId: BoardId): Promise<readonly PrincipalSummary[]> =>
		(await call(() =>
			listMembers({ data: { boardId } }),
		)) as readonly PrincipalSummary[],

	readPrincipal: async ({
		principalId,
		boardId,
	}: {
		readonly principalId: PrincipalId;
		readonly boardId: BoardId;
	}): Promise<ParticipantRead> =>
		(await call(() =>
			readPrincipal({ data: { principalId, boardId } }),
		)) as ParticipantRead,

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
		(await call(() =>
			appendMessage({
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
			}),
		)) as Entry,

	createThread: async (input: CreateThreadInput): Promise<Thread> =>
		(await call(() =>
			createThread({
				data: {
					boardId: input.boardId,
					title: input.title,
					description: input.description,
				},
			}),
		)) as Thread,

	createBoard: async (input: CreateBoardInput): Promise<BoardSummary> =>
		(await call(() =>
			createBoard({
				data: { name: input.name, description: input.description },
			}),
		)) as BoardSummary,

	addResource: async (input: AddResourceInput): Promise<Resource> =>
		(await call(() =>
			addResource({
				data: {
					boardId: input.boardId,
					name: input.name,
					url: input.url,
					type: input.type,
					description: input.description,
				},
			}),
		)) as Resource,

	simulateIncoming: async (threadId: ThreadId): Promise<Entry> =>
		(await call(() => simulateIncoming({ data: { threadId } }))) as Entry,

	attachResource: async (input: AttachResourceInput): Promise<Entry> =>
		(await call(() =>
			attachResource({
				data: { threadId: input.threadId, resourceId: input.resourceId },
			}),
		)) as Entry,

	moveStatus: async (input: {
		threadId: ThreadId;
		from: ThreadStatus;
		to: ThreadStatus;
	}): Promise<Entry> =>
		(await call(() =>
			moveStatus({
				data: { threadId: input.threadId, from: input.from, to: input.to },
			}),
		)) as Entry,

	acknowledge: async (input: AcknowledgeInput): Promise<Entry> =>
		(await call(() =>
			acknowledge({
				data: { threadId: input.threadId, upTo: input.upTo },
			}),
		)) as Entry,

	/**
	 * The transport's connection state.
	 *
	 * A no-op returning the current state, exactly as the in-memory client does: pause is the
	 * reader's own state and delivery belongs to the stream (11b), and this build has no
	 * stream yet. `pending` is `0` here rather than derived, because with no subscription
	 * there is nothing outstanding to report — and it says so instead of guessing.
	 */
	setConnection: async (input: SetConnectionInput): Promise<StreamState> =>
		(await call(() =>
			setConnectionFn({
				data: { connected: input.connected },
			}),
		)) as StreamState,

	/**
	 * The stream, which is a server route rather than a function (spec L357) and arrives in 11a.
	 *
	 * Throws rather than returning an empty subscription: an empty subscription is
	 * indistinguishable from a thread with no entries, which is precisely the failure mode
	 * spec L518 forbids. A caller that ignores this will get an exception at the call site,
	 * which is where 11a's implementation will be.
	 */
	/**
	 * The stream, over `EventSource` at the route 11a added.
	 *
	 * `EventSource` rather than a hand-rolled `fetch` reader, for one reason that matters to this ticket:
	 * it is the browser feature that **sends `Last-Event-ID` on a reconnect for you** (11a:18). A manual
	 * reader would have to track the last id and put it in a header, which is the bespoke client
	 * bookkeeping the criterion replaces.
	 *
	 * What it does not do: sequence arithmetic. The cursor moves to the `id` the server sent, through
	 * `advanceCursor`, which cannot compute a position of its own (11a:15).
	 *
	 * A transport failure arrives as `stream-error`, never as silence (spec L518): a stream that silently
	 * stopped would render as an empty thread, which is the failure the panel exists to avoid.
	 */
	subscribe: (handlers: StreamHandlers): Unsubscribe => {
		// Server-side there is no `EventSource`, and a subscription during SSR would be a connection per
		// render. A no-op with a stated reason rather than a throw, because a component that subscribes in
		// an effect legitimately runs on the server first.
		if (import.meta.env.SSR) return () => undefined;

		let cursor = 0;
		let source: EventSource | null = null;
		let closed = false;
		/** Set when the server reports why the connection ended; see the `error` handler below. */
		let endedCause: "revoked" | "expired" | null = null;

		const open = () => {
			if (closed) return;
			// The cursor rides in the URL as well as in the browser's own `Last-Event-ID`, because a **new**
			// `EventSource` after an error does not resend the header the old one sent — the header belongs
			// to a reconnect of the same instance. Measured: without the parameter, a re-open after a
			// transport failure replayed the whole thread.
			const url = cursor > 0 ? `${STREAM_PATH}?after=${cursor}` : STREAM_PATH;
			source = new EventSource(url);

			for (const name of WIRE_EVENT_NAMES) {
				source.addEventListener(name, (event) => {
					const parsed = eventOf(`data: ${(event as MessageEvent).data}`);
					if (!parsed) return;
					// **The ending, remembered before the error that follows it.** The server sends
					// `connection-changed` with a cause and then closes; the browser reports that close as an
					// `error`, so this is what tells the two apart.
					if (
						parsed.type === "connection-changed" &&
						parsed.cause !== undefined
					) {
						endedCause = parsed.cause;
					}
					cursor = advanceCursor(cursor, parsed);
					handlers.onEvent(parsed);
				});
			}

			source.addEventListener("error", () => {
				// **A closed door is not a dropped connection** (11c:14). An `EventSource` fires `error` for
				// both, and it reconnects on its own — which for a revoked principal would be a retry loop
				// against a stream it may no longer read. So the ended cause, once reported, closes the
				// source for good and reports the ending rather than a transport failure.
				if (endedCause !== null) {
					source?.close();
					source = null;
					return;
				}
				// **A stated failure, not silence.** The name is the client's own and is deliberately not on
				// the wire (spec L518).
				handlers.onEvent({
					type: "stream-error",
					message: "The stream could not be reached",
				});
			});
		};

		open();

		return () => {
			closed = true;
			source?.close();
			source = null;
		};
	},
});
