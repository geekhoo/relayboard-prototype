import { createServerFn } from "@tanstack/react-start";
import type {
	BoardSummary,
	Entry,
	Resource,
	StreamState,
	Thread,
} from "#/client";
import { notYetOnTheWire, unknownObject } from "#/server/functions/errors";
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
import * as session from "#/server/session";
import { getStore } from "#/server/store/instance";

/**
 * The write half of the transport: one POST server function per mutation.
 *
 * ## The author is never the caller's to name
 *
 * Every handler resolves the acting principal from the session and passes **that** id to the store.
 * There is no `authorId` in any schema, and because the schemas are `z.object` without
 * `passthrough`, a body carrying one has it stripped before the handler runs (spec L376). That is
 * deliberate over refusing it: a caller cannot tell whether the forged field would have worked, so
 * there is nothing to probe.
 *
 * `simulateIncoming` is the subtler case (spec L377). The **author** is chosen here, from the
 * board's agent members, so the caller cannot make an agent say something in particular. The
 * **permission** checked is the caller's `post:message` — the simulated author's own grants are
 * never consulted, which is what keeps "an agent posted it" from becoming "the caller may do what an
 * agent may do".
 *
 * ## Permission checking is not here yet, and that is 07a's
 *
 * The grant check is 07a's boundary work, and 06b recorded why there is no copy of it in the client.
 * What this file does is preserve the *shape* the check needs — one call to `actingPrincipal()` at
 * the top of every handler, before anything else — so 07a adds a line rather than a restructure.
 *
 * The one place it already bites is `simulateIncoming`: 06c's criterion says a caller without
 * `post:message` cannot trigger a simulation, and until 07a there is no grant to test. What exists
 * instead is the *membership* refusal the store already makes — a principal not on the board cannot
 * post there, simulated or not — and the route seam asserts that a refused write surfaces as a
 * refusal rather than as an empty success.
 */

const store = () => getStore();
const actingPrincipal = () => session.actingPrincipal();

/**
 * The three acts that are on the interface but not writable yet.
 *
 * They throw `notYetOnTheWire` naming ticket 10a, exactly as the in-memory client throws its own
 * `NotYetImplementedError`: an absent capability must fail loudly over the wire too, because a
 * server function that returned `undefined` would read as a pass to the conformance suite.
 */
export const attachResource = createServerFn({ method: "POST" })
	.validator(attachResourceInput)
	.handler(async (): Promise<Entry> => {
		actingPrincipal();
		throw notYetOnTheWire("attachResource", "ticket 10a");
	});

export const moveStatus = createServerFn({ method: "POST" })
	.validator(moveStatusInput)
	.handler(async (): Promise<Entry> => {
		actingPrincipal();
		throw notYetOnTheWire("moveStatus", "ticket 10a");
	});

export const acknowledge = createServerFn({ method: "POST" })
	.validator(acknowledgeInput)
	.handler(async (): Promise<Entry> => {
		actingPrincipal();
		throw notYetOnTheWire("acknowledge", "ticket 10a");
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
		const actor = actingPrincipal();
		return store().appendMessage({
			threadId: data.threadId,
			// The resolved principal, never a field of the payload.
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
		const actor = actingPrincipal();
		return store().createThread({
			boardId: data.boardId,
			title: data.title,
			description: data.description,
			creatorId: actor.id,
		});
	});

export const createBoard = createServerFn({ method: "POST" })
	.validator(createBoardInput)
	.handler(async ({ data }): Promise<BoardSummary> => {
		actingPrincipal();
		const board = store().createBoard({
			name: data.name,
			description: data.description,
		});
		return { ...board, memberCount: store().listMembers(board.id).length };
	});

export const addResource = createServerFn({ method: "POST" })
	.validator(addResourceInput)
	.handler(async ({ data }): Promise<Resource> => {
		actingPrincipal();
		return store().addResource({
			boardId: data.boardId,
			name: data.name,
			url: data.url,
			// The prototype's default on `addResource` (app.js L117); 09 closes the set at the
			// boundary rather than letting a free string through.
			type: data.type ?? "Link",
			description: data.description,
		});
	});

/**
 * An entry from an agent on the board, authored by the agent the **server** picks.
 *
 * The line and the agent are chosen here for the same reason: a client that could name either could
 * put words in a particular agent's mouth. The rotation is the in-memory client's own — one line per
 * simulation, numbered so a repeated click is a new entry rather than an idempotent replay — because
 * the ticket that gives simulation a real home is 11c, and duplicating its behaviour here would give
 * two implementations to keep in step.
 */
export const simulateIncoming = createServerFn({ method: "POST" })
	.validator(simulateIncomingInput)
	.handler(async ({ data }): Promise<Entry> => {
		// The caller's own permission to post here — not the agent's grants (spec L340).
		actingPrincipal();
		const thread = store().readThread(data.threadId);
		if (!thread) throw unknownObject("thread", data.threadId);
		const agent = store()
			.listMembers(thread.boardId)
			.find((principal) => principal.kind === "agent");
		if (!agent) {
			throw unknownObject("agent", thread.boardId);
		}
		const simulation = nextSimulation();
		store().appendMessage({
			threadId: data.threadId,
			authorId: agent.id,
			text: simulatedLine(simulation),
			idempotencyKey: `sim-${simulation}`,
		});
		const entries = store().readEntries(data.threadId);
		const last = entries[entries.length - 1];
		if (!last) throw unknownObject("entry", data.threadId);
		return last;
	});

/**
 * The reader's own connection state.
 *
 * A no-op over the wire in this build: the stream is 11a's, and the *reader's* pause is the client's
 * own state (11b:17) rather than a server fact. It returns the derived state rather than throwing so
 * the conformance suite's shape assertion holds over both transports.
 */
export const setConnection = createServerFn({ method: "POST" })
	.validator(setConnectionInput)
	.handler(async (): Promise<StreamState> => {
		const actor = actingPrincipal();
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
		return { connected: true, pending };
	});

/**
 * The simulation counter, on the process.
 *
 * Numbered so the idempotency key and the line describe the same simulation — the same rule the
 * in-memory client follows. It is process state rather than store state because a restart clearing
 * it is correct: the store is in memory too, and a fresh workspace should start at the first line.
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
