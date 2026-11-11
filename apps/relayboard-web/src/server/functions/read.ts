import { createServerFn } from "@tanstack/react-start";
import type { BoardSummary, ParticipantRead, PrincipalSummary } from "#/client";
import { createAdmissions } from "#/server/admissions";
import {
	boardNotFound,
	resetRefused,
	unknownObject,
	unknownPrincipal,
} from "#/server/functions/errors";
import {
	boardInput,
	readMessagesInput,
	readPrincipalInput,
	threadInput,
} from "#/server/functions/inputs";
import { authorize } from "#/server/permissions";
import * as session from "#/server/session";
import { getStore, resetAllowed, resetStore } from "#/server/store/instance";

/**
 * The read half of the transport: one server function per read.
 *
 * Every handler follows the same four steps, in this order, and the order is the contract:
 *
 * 1. **Validate the input.** The validator is a Zod schema, so a malformed request is refused at the
 *    boundary rather than reaching the store. The schemas strip unknown keys, so a caller cannot
 *    smuggle a field past the validator into a handler.
 * 2. **Resolve the acting principal** from the session cookie, issuing one when the request has none.
 * 3. **Authorize the operation.** Since 07a this is one call, `authorize(op, actor, scope)`, which
 *    reads the requirement from the **declared table** in `src/client` rather than from a branch —
 *    so an operation cannot declare one permission and check another, and cannot gain a handler that
 *    forgets to check at all.
 * 4. **Answer from the store.**
 *
 * `readActingPrincipal` is the one exception, and deliberately: its requirement is `none`, because a
 * caller with no session has to be able to ask who it is acting as (spec L341). Requiring a grant
 * there would make the question unanswerable exactly when the answer is "nobody".
 *
 * **These are not unit-tested by calling them.** `createServerFn` resolves through a request-scoped
 * Start context that a bare `vitest run` does not have, so an in-process call throws "No Start
 * context found in AsyncLocalStorage" — measured four ways in 06c. The behaviour is asserted at the
 * store seam (the operations these delegate to), at the matrix seam (`tests/permissions.test.ts`,
 * which is where the requirements are checked), and over HTTP at the route seam (`e2e/**`).
 */

/** How a handler reaches the workspace. */
const store = () => getStore();

/**
 * Resolve the actor and authorize one operation, in one call.
 *
 * A handler writes `const actor = authorizeAs("appendMessage", { boardId })` and gets an actor it
 * cannot proceed without. That shape is the point: an operation cannot be written that resolves the
 * principal first and checks the grant "later", because there is nothing to write in between.
 */
const authorizeAs = (
	operation: Parameters<typeof authorize>[0],
	scope: Parameters<typeof authorize>[2] = {},
) => authorize(operation, session.actingPrincipal(), scope);

/** Every board the reader may see, with the count of people on it and never the list. */
export const listBoards = createServerFn({ method: "GET" }).handler(
	async (): Promise<readonly BoardSummary[]> => {
		// **`read:board` is asked per board, and the answer is the boards it holds it on.** Spec L327
		// says `listBoards` requires `read:board` "on that board" — one per board — so this is a filter
		// rather than a single check. Asking it at workspace scope would be wrong in both directions: a
		// member holding it on one board would be refused entirely, and a superadmin's workspace
		// grant would be indistinguishable from a board grant.
		//
		// The actor is resolved first regardless, because this is where a browser's first request is
		// issued its session — a read that skipped it would leave the reader anonymous until they posted.
		const actor = session.actingPrincipal();
		const visible = store()
			.listBoards()
			.filter((board) => store().permits(actor.id, "read:board", board.id));
		// **A refusal, not an empty list.** A caller holding `read:board` nowhere has nothing to read,
		// and answering "zero boards" would be a claim about the workspace rather than about the
		// caller. The refusal names the permission so it can be acted on (07a:18).
		if (visible.length === 0) authorizeAs("listBoards");
		return visible.map((board) => ({
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
		authorizeAs("listThreads", { boardId: data.boardId });
		return store().listThreads(data.boardId);
	});

/** A thread as a chronology: its record and its entries, by `seq`. */
export const readThread = createServerFn({ method: "GET" })
	.validator(threadInput)
	.handler(({ data }) => {
		const thread = store().readThread(data.threadId);
		if (!thread) throw unknownObject("thread", data.threadId);
		// The board comes from the **thread**, not from the request: a caller cannot name a board it
		// holds a grant on and read a thread in one it does not.
		authorizeAs("readThread", { boardId: thread.boardId });
		return { thread, entries: store().readEntries(data.threadId) };
	});

/** A thread's entries after a position. The whole thread when no position is given. */
export const readMessages = createServerFn({ method: "GET" })
	.validator(readMessagesInput)
	.handler(({ data }) => {
		const thread = store().readThread(data.threadId);
		if (!thread) throw unknownObject("thread", data.threadId);
		authorizeAs("readMessages", { boardId: thread.boardId });
		return store()
			.readEntries(data.threadId)
			.filter((entry) => entry.seq > (data.after ?? 0));
	});

/** A board's canonical resources. */
export const listResources = createServerFn({ method: "GET" })
	.validator(boardInput)
	.handler(({ data }) => {
		if (!store().readBoard(data.boardId)) throw boardNotFound(data.boardId);
		authorizeAs("listResources", { boardId: data.boardId });
		return store().listResources(data.boardId);
	});

/** How far every principal has got in one thread. */
export const readPositions = createServerFn({ method: "GET" })
	.validator(threadInput)
	.handler(({ data }) => {
		const thread = store().readThread(data.threadId);
		if (!thread) throw unknownObject("thread", data.threadId);
		authorizeAs("readPositions", { boardId: thread.boardId });
		return store().readPositions(data.threadId);
	});

/** Who is on a board. Refused for a caller without `read:member` there, rather than answered empty. */
export const listMembers = createServerFn({ method: "GET" })
	.validator(boardInput)
	.handler(({ data }): readonly PrincipalSummary[] => {
		if (!store().readBoard(data.boardId)) throw boardNotFound(data.boardId);
		authorizeAs("listMembers", { boardId: data.boardId });
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
 * Both ids are required, because a grant is per board: a read that took only a principal could not
 * answer "what may this participant do here", and 12 has nothing to render without it.
 *
 * **The grant is now the real one.** 07a replaced the membership stand-in with a lookup, so what this
 * returns is what the store holds — and the board in the input is the board the grant was checked
 * against, which is why the read takes one.
 */
export const readPrincipal = createServerFn({ method: "GET" })
	.validator(readPrincipalInput)
	.handler(({ data }): ParticipantRead => {
		if (!store().readBoard(data.boardId)) throw boardNotFound(data.boardId);
		const principal = store().readPrincipal(data.principalId);
		if (!principal) throw unknownPrincipal(data.principalId);
		authorizeAs("readPrincipal", { boardId: data.boardId });
		return {
			principal,
			grant: {
				scope: "board",
				permissions: store().grantsFor(data.principalId, data.boardId),
			},
			declared: { description: principal.description },
			// **Derived, and read from the same call as everything else** (12:21: "no second read and no
			// field read off a board payload"). The admissions surface is the authority on what it issued, so
			// this asks it rather than reconstructing an HMAC here — a second derivation would be a second
			// place for the fingerprint to disagree with the one 08c stored.
			derived: createAdmissions(store()).derivedFor(data.principalId),
		};
	});

/**
 * What the caller may do, kept at the two scopes it can mean.
 *
 * **Two lists rather than one union, and that is the same rule 07a's `grantOn` fix established**: a
 * board-scoped answer and a workspace-scoped answer are different statements, and merging them would
 * return workspace permissions under a board label. The surface asks both questions because it renders
 * both kinds of control — a thread or a resource is created *on this board*, a board is created in the
 * workspace — and conflating them disables `create:board` for the one principal who holds it.
 *
 * Found by a route-seam test: with the board-scoped list alone, the seeded superadmin saw every
 * board-creating control disabled.
 */
export const readHeldPermissions = createServerFn({ method: "GET" })
	.validator(boardInput)
	.handler(
		({
			data,
		}): { onBoard: readonly string[]; workspace: readonly string[] } => {
			const actor = session.actingPrincipal();
			return {
				onBoard: store().grantsFor(actor.id, data.boardId),
				workspace: store().grantsFor(actor.id),
			};
		},
	);

/**
 * The principal this request acts as.
 *
 * The one read that exists *for* the session rather than for the workspace, and the only operation
 * whose requirement is `none` — a caller with no session must be able to ask who it is, which is how
 * a client learns it has none (spec L341). It returns the principal and never the cookie: the cookie
 * stays `HttpOnly` and unreadable from JavaScript, so this is the only way to learn what it is
 * acting as.
 */
export const readActingPrincipal = createServerFn({ method: "GET" }).handler(
	() => authorizeAs("readActingPrincipal"),
);

/**
 * The test/dev-only reset.
 *
 * Not a participant operation: it is absent from `RelayboardClient`, and it refuses outside a test
 * or development process. `resetAllowed()` is the decision, made in one place so a route cannot make
 * it differently.
 */
export const resetTestStore = createServerFn({ method: "POST" }).handler(() => {
	if (!resetAllowed()) throw resetRefused();
	resetStore();
	return { reset: true };
});
