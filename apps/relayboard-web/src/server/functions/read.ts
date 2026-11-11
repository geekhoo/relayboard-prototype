import { createServerFn } from "@tanstack/react-start";
import type { BoardSummary, ParticipantRead, PrincipalSummary } from "#/client";
import {
	boardNotFound,
	invalidInput,
	resetRefused,
	unknownPrincipal,
} from "#/server/functions/errors";
import {
	boardInput,
	readMessagesInput,
	readPrincipalInput,
	threadInput,
} from "#/server/functions/inputs";
import * as session from "#/server/session";
import { getStore, resetAllowed, resetStore } from "#/server/store/instance";

/**
 * The read half of the transport: one server function per read.
 *
 * Every function here follows the same three steps, in this order, and the order is the
 * contract:
 *
 * 1. **Validate the input.** The validator is a Zod schema, so a malformed request is
 *    refused at the boundary with an identifiable error rather than reaching the store. The
 *    schemas also strip unknown keys, so a caller cannot smuggle a field past the validator
 *    into a handler.
 * 2. **Resolve the acting principal.** This ticket has no session yet (06b), so the store's
 *    seeded first browser-selectable principal stands in — the same one 04a's router context
 *    acts as. The resolution is a single function call behind a named seam, so 06b replaces
 *    its body and every handler here is unchanged.
 * 3. **Answer from the store.**
 *
 * **They are not unit-tested by calling them.** `createServerFn` resolves through a
 * request-scoped Start context that a bare `vitest run` does not have, so an in-process call
 * throws "No Start context found in AsyncLocalStorage" — a test of a fabricated context would
 * prove nothing about the deployed path. The assertions live on the store seam (the reads
 * delegate to operations that are tested) and on the route seam (each endpoint answers over
 * HTTP with the right shape). 06c and 04c carry the second; this file's own `npm test`
 * coverage is the error vocabulary and the principal-resolution seam.
 */

/** How a handler reaches the workspace. */
const store = () => getStore();

/**
 * Every read below starts here, and this is the line that makes the server's answer depend on
 * the caller rather than on the request body.
 *
 * `actingPrincipal()` reads the session cookie, resolves it to a seeded principal, and issues a
 * session on the response when the request had none — so a browser's first page load leaves with
 * a cookie naming a real participant, and every subsequent operation acts as that principal.
 * The reads do not yet differ per principal (grants are 07a's), which is why the call is made
 * and its result discarded in most handlers: the seam exists, it is exercised on every request,
 * and 07a makes it load-bearing without touching a handler.
 */
const actingPrincipal = () => session.actingPrincipal();

/** Every board the reader may see, with the count of people on it and never the list. */
export const listBoards = createServerFn({ method: "GET" }).handler(
	async (): Promise<readonly BoardSummary[]> => {
		// The acting principal is resolved even for a read every participant may make: this is
		// where a browser's first request is issued its session, and a read that skipped it would
		// leave the reader anonymous until they happened to post.
		actingPrincipal();
		const boards = store().listBoards();
		return boards.map((board) => ({
			...board,
			memberCount: store().listMembers(board.id).length,
		}));
	},
);

/** A board's threads, newest first by the only ordering the product applies across threads. */
export const listThreads = createServerFn({ method: "GET" })
	.validator(boardInput)
	.handler(({ data }) => {
		if (!store().readBoard(data.boardId)) throw boardNotFound(data.boardId);
		return store().listThreads(data.boardId);
	});

/** A thread as a chronology: its record and its entries, by `seq`. */
export const readThread = createServerFn({ method: "GET" })
	.validator(threadInput)
	.handler(({ data }) => {
		const thread = store().readThread(data.threadId);
		if (!thread)
			throw invalidInput(`No thread ${data.threadId} in this workspace`);
		return { thread, entries: store().readEntries(data.threadId) };
	});

/** A thread's entries after a position. The whole thread when no position is given. */
export const readMessages = createServerFn({ method: "GET" })
	.validator(readMessagesInput)
	.handler(({ data }) =>
		store()
			.readEntries(data.threadId)
			.filter((entry) => entry.seq > (data.after ?? 0)),
	);

/** A board's canonical resources. */
export const listResources = createServerFn({ method: "GET" })
	.validator(boardInput)
	.handler(({ data }) => {
		if (!store().readBoard(data.boardId)) throw boardNotFound(data.boardId);
		return store().listResources(data.boardId);
	});

/** How far every principal has got in one thread. */
export const readPositions = createServerFn({ method: "GET" })
	.validator(threadInput)
	.handler(({ data }) => store().readPositions(data.threadId));

/** Who is on a board. Gated by `read:member` in 07a; the gate is not this ticket's. */
export const listMembers = createServerFn({ method: "GET" })
	.validator(boardInput)
	.handler(({ data }): readonly PrincipalSummary[] => {
		if (!store().readBoard(data.boardId)) throw boardNotFound(data.boardId);
		return store()
			.listMembers(data.boardId)
			.map((principal) => ({
				id: principal.id,
				name: principal.name,
				kind: principal.kind,
			}));
	});

/**
 * One participant, with the grant it holds on one board.
 *
 * Both ids are required, because a grant is per board: a read that took only a principal
 * would be unable to answer "what may this participant do here", and 12 has nothing to
 * render without it. The grant returned is the store's membership stand-in until 07a.
 */
export const readPrincipal = createServerFn({ method: "GET" })
	.validator(readPrincipalInput)
	.handler(({ data }): ParticipantRead => {
		if (!store().readBoard(data.boardId)) throw boardNotFound(data.boardId);
		const principal = store().readPrincipal(data.principalId);
		if (!principal) throw unknownPrincipal(data.principalId);
		const member = store()
			.listMembers(data.boardId)
			.some((candidate) => candidate.id === principal.id);
		return {
			principal,
			grant: {
				scope: "board",
				permissions: member ? MEMBER_PERMISSIONS : [],
			},
			declared: { description: principal.description },
		};
	});

/**
 * What a member of a board may do there, until 07a's grants.
 *
 * The same stand-in the in-memory client uses, stated once so the two transports cannot
 * disagree about the demo workspace: everything the prototype let a member do on its board,
 * scoped to that board, and `create:board` nowhere — that is the superadmin's workspace grant.
 */
const MEMBER_PERMISSIONS = [
	"read:board",
	"read:thread",
	"read:resource",
	"read:member",
	"post:message",
	"create:thread",
	"add:resource",
	"add:artifact",
] as const;

/**
 * The principal this request acts as.
 *
 * The one read that exists *for* the session rather than for the workspace, and the one a test
 * uses to ask which participant it got instead of assuming an order (06c:22). It returns the
 * principal and never the cookie — the cookie stays `HttpOnly` and unread from JavaScript, so
 * this is the only way a caller can learn what it is acting as.
 */
export const readActingPrincipal = createServerFn({ method: "GET" }).handler(
	() => actingPrincipal(),
);

/**
 * The test/dev-only reset.
 *
 * Refused outside a test or dev process, so the product cannot expose a way to wipe a
 * workspace that skipped the purge's confirmation and its permission check (14). It is not on
 * `RelayboardClient` and never will be: this is the harness's hook, not a participant's.
 */
export const resetTestStore = createServerFn({ method: "POST" }).handler(() => {
	if (!resetAllowed()) throw resetRefused();
	resetStore();
	return { reset: true as const };
});
