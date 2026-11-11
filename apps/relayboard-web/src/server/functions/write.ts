import { createServerFn } from "@tanstack/react-start";
import type {
	BoardSummary,
	Entry,
	Resource,
	StreamState,
	Thread,
} from "#/client";
import { unknownObject } from "#/server/functions/errors";
import {
	acknowledgeInput,
	addResourceInput,
	appendMessageInput,
	attachResourceInput,
	createBoardInput,
	createThreadInput,
	moveStatusInput,
	setConnectionInput,
	simulateIncomingInput,
} from "#/server/functions/inputs";
import { authorize } from "#/server/permissions";
import * as session from "#/server/session";
import { getStore } from "#/server/store/instance";

/**
 * The write half of the transport: one POST server function per mutation.
 *
 * ## The order inside every handler, and why it is this order
 *
 * 1. **Resolve the record the request names**, so a malformed id is an unknown object rather than a
 *    permission question about a board that does not exist. A refusal that said "you lack
 *    `post:message`" about a thread that is not here would be a worse answer than "no such thread".
 * 2. **Authorize** — one call, reading the requirement from the declared table rather than from a
 *    branch, at the board the record actually belongs to. Never at a board the request names: a
 *    caller must not be able to present a board it holds a grant on and write into another.
 * 3. **Answer from the store.**
 *
 * ## The author is never the caller's to name
 *
 * Every handler passes the resolved principal's id to the store. No schema declares an `authorId`,
 * and because the schemas are closed `z.object`s, a body carrying one has it **stripped** before the
 * handler runs (spec L376) — a forged author is unnoticed rather than refused, so a caller cannot
 * even learn whether it would have worked.
 *
 * `simulateIncoming` is the subtler case (spec L377). The **author** is chosen here, from the board's
 * agent members, so a caller cannot put words in a particular agent's mouth. The **permission**
 * checked is the caller's `post:message` — the simulated author's own grants are never consulted,
 * which is what keeps "an agent posted it" from becoming "the caller may do what an agent may do".
 *
 * ## What is still absent
 *
 * The three acts throw `notYetOnTheWire` naming 10a — but only **after** their permission check, so a
 * caller who may not perform them learns that first. An absent capability and an unauthorized
 * caller are different refusals, and the one a caller can act on comes first.
 */

const store = () => getStore();

const authorizeAs = (
	operation: Parameters<typeof authorize>[0],
	scope: Parameters<typeof authorize>[2] = {},
) => authorize(operation, session.actingPrincipal(), scope);

/**
 * The three acts.
 *
 * Each resolves its thread first (so a stale id is a not-found rather than a permission refusal),
 * then authorizes at that thread's board, then writes. The author is the **acting principal** and
 * never the caller: the wire schema has no author field, and 06c's rule is that a forged one could
 * not reach here anyway.
 *
 * Until 10a these three threw `notYetOnTheWire` naming the ticket. That was 06a's rule — an absent
 * capability must fail loudly rather than read as a pass — and it has now done its job: the alarm
 * fired when the ticket landed, rather than being remembered.
 */
export const attachResource = createServerFn({ method: "POST" })
	.validator(attachResourceInput)
	.handler(async ({ data }): Promise<Entry> => {
		const thread = store().readThread(data.threadId);
		if (!thread) throw unknownObject("thread", data.threadId);
		authorizeAs("attachResource", { boardId: thread.boardId });
		const actor = authorizeAs("attachResource", { boardId: thread.boardId });
		return store().attachResource({
			threadId: data.threadId,
			resourceId: data.resourceId,
			authorId: actor.id,
		});
	});

export const moveStatus = createServerFn({ method: "POST" })
	.validator(moveStatusInput)
	.handler(async ({ data }): Promise<Entry> => {
		const thread = store().readThread(data.threadId);
		if (!thread) throw unknownObject("thread", data.threadId);
		authorizeAs("moveStatus", { boardId: thread.boardId });
		const actor = authorizeAs("moveStatus", { boardId: thread.boardId });
		return store().moveStatus({
			threadId: data.threadId,
			from: data.from,
			to: data.to,
			authorId: actor.id,
		});
	});

export const acknowledge = createServerFn({ method: "POST" })
	.validator(acknowledgeInput)
	.handler(async ({ data }): Promise<Entry> => {
		const thread = store().readThread(data.threadId);
		if (!thread) throw unknownObject("thread", data.threadId);
		authorizeAs("acknowledge", { boardId: thread.boardId });
		const actor = authorizeAs("acknowledge", { boardId: thread.boardId });
		return store().acknowledge({
			threadId: data.threadId,
			upTo: data.upTo,
			authorId: actor.id,
		});
	});

/**
 * Post a message.
 *
 * `idempotencyKey` travels through untouched: the store checks it **before** validation (02b), so a
 * replayed request returns the stored entry even when its own payload would now be refused. Passing
 * it through rather than re-deriving it here is what keeps that ordering the store's property rather
 * than a coincidence of this layer.
 */
export const appendMessage = createServerFn({ method: "POST" })
	.validator(appendMessageInput)
	.handler(async ({ data }): Promise<Entry> => {
		const thread = store().readThread(data.threadId);
		if (!thread) throw unknownObject("thread", data.threadId);
		const actor = authorizeAs("appendMessage", { boardId: thread.boardId });
		return store().appendMessage({
			threadId: data.threadId,
			authorId: actor.id,
			text: data.text,
			references: data.references,
			relation: data.relation,
			idempotencyKey: data.idempotencyKey,
		});
	});

export const createThread = createServerFn({ method: "POST" })
	.validator(createThreadInput)
	.handler(async ({ data }): Promise<Thread> => {
		if (!store().readBoard(data.boardId)) {
			throw unknownObject("board", data.boardId);
		}
		const actor = authorizeAs("createThread", { boardId: data.boardId });
		return store().createThread({
			boardId: data.boardId,
			title: data.title,
			description: data.description,
			creatorId: actor.id,
		});
	});

/**
 * A new board.
 *
 * `create:board` is a **workspace-scoped** permission (spec L420), so this is the one mutation asked
 * at workspace scope. A principal holding it only on a board has `read:board` there and not this.
 */
export const createBoard = createServerFn({ method: "POST" })
	.validator(createBoardInput)
	.handler(async ({ data }): Promise<BoardSummary> => {
		authorizeAs("createBoard");
		const board = store().createBoard({
			name: data.name,
			description: data.description,
		});
		return { ...board, memberCount: store().listMembers(board.id).length };
	});

export const addResource = createServerFn({ method: "POST" })
	.validator(addResourceInput)
	.handler(async ({ data }): Promise<Resource> => {
		if (!store().readBoard(data.boardId)) {
			throw unknownObject("board", data.boardId);
		}
		authorizeAs("addResource", { boardId: data.boardId });
		return store().addResource({
			boardId: data.boardId,
			name: data.name,
			url: data.url,
			type: data.type ?? "Link",
			description: data.description,
		});
	});

/**
 * An entry from an agent on the board, authored by the agent the **server** picks.
 *
 * The line and the agent are both chosen here for the same reason: a client that could name either
 * could put words in a particular agent's mouth. The rotation is the prototype's — one line per
 * simulation, numbered so a repeated click is a new entry rather than an idempotent replay — because
 * the ticket that gives simulation a real home is 11c, and duplicating its behaviour here would give
 * two implementations to keep in step.
 */
export const simulateIncoming = createServerFn({ method: "POST" })
	.validator(simulateIncomingInput)
	.handler(async ({ data }): Promise<Entry> => {
		const thread = store().readThread(data.threadId);
		if (!thread) throw unknownObject("thread", data.threadId);
		// The CALLER's `post:message`, never the agent's grants (spec L340, L377).
		authorizeAs("simulateIncoming", { boardId: thread.boardId });
		const agent = store()
			.listMembers(thread.boardId)
			.find((principal) => principal.kind === "agent");
		if (!agent) throw unknownObject("agent", thread.boardId);
		const simulation = nextSimulation();
		return store().appendMessage({
			threadId: data.threadId,
			authorId: agent.id,
			text: simulatedLine(simulation),
			idempotencyKey: `sim-${simulation}`,
		});
	});

/**
 * The reader's own connection state.
 *
 * A no-op over the wire in this build: the stream is 11a's, and the *reader's* pause is the client's
 * own state rather than a server fact. It returns derived state rather than throwing so the
 * conformance suite's shape assertion holds over both transports.
 */
export const setConnection = createServerFn({ method: "POST" })
	.validator(setConnectionInput)
	.handler(async ({ data }): Promise<StreamState> => {
		const actor = authorizeAs("setConnection");
		// **The pause reaches the store.** Until 11a this handler ignored its input, on the reasoning that
		// pause was the reader's own state rather than a server fact. The stream proved that wrong: a
		// paused reader's cursor has to hold still, or a resume replays nothing and the "no backlog,
		// replay from the cursor" model loses its only mechanism. The store's primitive has existed
		// since 02b; this is the wire that lets a client reach it.
		//
		// **Asserted at the store, not here.** Removing this line leaves the whole suite green, measured:
		// the in-memory transport reaches `store.setConnection` directly, and a `createServerFn` cannot be
		// driven under `vitest run` (06c measured that four ways). So the pause's *mechanism* is asserted
		// (`tests/store-contract.ts`) and its *wire* is asserted by 11b, where a pause affordance exists
		// for the route seam to click. Recorded rather than implied, because a line no test can see is
		// the kind of line that gets deleted.
		store().setConnection(actor.id, data.connected);
		const pending = store()
			.listBoards()
			.flatMap((board) => store().listThreads(board.id))
			.reduce((total, thread) => {
				const position = store()
					.readPositions(thread.id)
					.find((candidate) => candidate.principalId === actor.id);
				const cursor = position?.watermarks.cursor ?? 0;
				const latest = store()
					.readEntries(thread.id)
					.reduce((last, entry) => Math.max(last, entry.seq), 0);
				return total + Math.max(0, latest - cursor);
			}, 0);
		return { connected: data.connected, pending };
	});

/**
 * The simulation counter, on the process.
 *
 * Numbered so the idempotency key and the line describe the same simulation, as the in-memory client
 * does. Process state rather than store state because a restart clearing it is correct: the store is
 * in memory too, and a fresh workspace should start at the first line.
 */
let simulations = 0;
const nextSimulation = (): number => {
	simulations += 1;
	return simulations;
};

/** The prototype's four simulated lines (app.js L120-123), in its order. */
const SIMULATED_LINES: readonly string[] = [
	"A quick follow-up from my independent session: I’ve reviewed the latest thread context. The message history is consistent with the proposed boundary.",
	"I found one useful clarification: an event notification is not the same as a committed message. Clients should use the canonical history for recovery.",
	"Adding a note for everyone: my local processing is independent of this board. I’m posting the result here so other participants can find it.",
	"I’ve checked the latest messages. No conflicting updates so far; I’ll continue to observe this thread asynchronously.",
];

const simulatedLine = (simulation: number): string =>
	SIMULATED_LINES[(simulation - 1) % SIMULATED_LINES.length] as string;
