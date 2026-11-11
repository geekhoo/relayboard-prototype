import type {
	Board,
	Entry,
	Resource,
	StreamEvent,
	Thread,
	ThreadId,
} from "#/client";
import type { AccessEndCause } from "#/server/store";

/**
 * The stream's event contract, written down in one place.
 *
 * Spec L358 and 11a:14: the wire vocabulary is **exactly eight names**, and a non-browser client must be
 * able to consume the stream without reading the UI source (story 155). So the names, the payload shapes
 * and the frame encoding all live here, and both ends import them: the SSE route encodes through
 * `frameOf`, the client decodes through `eventOf`, and neither invents a second vocabulary.
 *
 * ## `stream-error` is not on the wire, and this is the file that says why
 *
 * It is a name the **client** reports when its transport fails (spec L518), so that a disconnected
 * stream is never rendered as an empty thread. Putting it in `WIRE_EVENT_NAMES` would make the
 * eight-name assertion false and would let a server claim a failure it cannot observe. It is in the
 * `StreamEvent` union — the client must have a name for it — and out of the wire set, which is exactly
 * the distinction `WireStreamEventType` already draws.
 */

/**
 * The eight names a server route may emit, in the order spec L358 lists them.
 *
 * A literal tuple rather than a type alone: 11a:14 asks for a test that asserts **the emitted set equals
 * this literal set**, and a test can only compare against a value.
 */
export const WIRE_EVENT_NAMES = [
	"message-committed",
	"thread-created",
	"board-created",
	"resource-created",
	"artifact-attached",
	"status-moved",
	"acknowledged",
	"connection-changed",
] as const;

export type WireEventName = (typeof WIRE_EVENT_NAMES)[number];

/**
 * Which wire event an entry-bearing act produces.
 *
 * **The one place the entry kind and the event name are related.** A message is `message-committed`;
 * the three acts have their own names because a client needs to tell "something was said" from "an
 * event was recorded" without reading the entry. `null` for a kind that is not entry-bearing, which
 * cannot happen today and would be a compile error if a fifth kind appeared.
 */
export const eventNameForEntry = (entry: Entry): WireEventName => {
	switch (entry.kind) {
		case "message":
			return "message-committed";
		case "artifact":
			return "artifact-attached";
		case "status-move":
			return "status-moved";
		case "acknowledgement":
			return "acknowledged";
	}
};

/**
 * The `seq` an event carries, or `undefined` for the two events that are not about an entry.
 *
 * 11a:15: every entry-bearing event carries its `seq`, and the client uses **that** value as its
 * cursor — there is no client-side sequence arithmetic anywhere in the transport path. Exported so a
 * test can assert the property for every event in a recorded run rather than for the ones it happened
 * to check.
 */
export const seqOfEvent = (event: StreamEvent): number | undefined => {
	switch (event.type) {
		case "message-committed":
		case "artifact-attached":
		case "status-moved":
		case "acknowledged":
			return event.entry.seq;
		default:
			return undefined;
	}
};

/**
 * One SSE frame: `id`, `event`, `data`, and a blank line.
 *
 * The `id` is the event's `seq` when it has one, because that IS the cursor a reconnect needs: the
 * browser resends the last `id` it saw as `Last-Event-ID`, and the server replays from there. An event
 * with no `seq` gets no `id` rather than `id: 0`, because a zero would move a reader's cursor backwards.
 *
 * `\n\n` terminates a frame (the event-stream spec); `data` is JSON on one line, which is legal because
 * JSON escapes its own newlines.
 */
export const frameOf = (event: StreamEvent, seq?: number): string => {
	const lines: string[] = [];
	if (seq !== undefined) lines.push(`id: ${seq}`);
	lines.push(`event: ${event.type}`);
	lines.push(`data: ${JSON.stringify(event)}`);
	return `${lines.join("\n")}\n\n`;
};

/**
 * A frame parsed back into an event, or `null` when the frame is a comment or a keep-alive.
 *
 * Deliberately strict: an unknown name or unparsable JSON yields `null` rather than a guessed event,
 * because a transport that invents events is worse than one that drops a frame it cannot read.
 */
export const eventOf = (raw: string): StreamEvent | null => {
	const data = raw
		.split("\n")
		.filter((line) => line.startsWith("data: "))
		.map((line) => line.slice("data: ".length))
		.join("\n");
	if (data === "") return null;
	try {
		const parsed = JSON.parse(data) as StreamEvent;
		if (!(WIRE_EVENT_NAMES as readonly string[]).includes(parsed.type))
			return null;
		return parsed;
	} catch {
		return null;
	}
};

/**
 * The `Last-Event-ID` header as a cursor, or `0` when the client sent none.
 *
 * `0` rather than `undefined`: a fresh subscriber has received nothing, and the store's watermarks start
 * at `0` for the same reason. A non-numeric header is treated as absent rather than as a failure — a
 * proxy is allowed to send anything, and refusing the connection over a header would turn a proxy quirk
 * into an outage.
 */
export const cursorFromHeader = (header: string | null): number => {
	if (header === null) return 0;
	const parsed = Number.parseInt(header, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/**
 * The reduction a client applies to its own cursor as events arrive.
 *
 * The **only** place a cursor moves on the client side, and it moves to a value the server sent — never
 * to a value the client computed. 11a:15 asks for no sequence arithmetic in the transport path, and the
 * way to guarantee that is to have one function that cannot do arithmetic at all.
 */
export const advanceCursor = (cursor: number, event: StreamEvent): number =>
	Math.max(cursor, seqOfEvent(event) ?? 0);

/** The two non-entry events a client can receive, for the interface's own event handling. */
export const isEntryBearing = (
	event: StreamEvent,
): event is Extract<StreamEvent, { readonly entry: Entry }> =>
	seqOfEvent(event) !== undefined;

/**
 * The path the stream is served at.
 *
 * One constant, because three places need to agree about it: the route that defines it, the HTTP client
 * that connects to it, and the harness that opens a raw connection to terminate deliberately. A second
 * copy of the string is a second place to get it wrong — and 11a:13 says the stream must be on the same
 * origin as the server functions, which is what makes a relative path correct rather than convenient.
 */
export const STREAM_PATH = "/api/stream";

/**
 * The events a `board-created`/`thread-created`/`resource-created` notification carries.
 *
 * Named here so the route and the in-memory client cannot disagree about the payload shape: a keeper of
 * the contract rather than four inline object literals.
 */
export const threadCreated = (thread: Thread): StreamEvent => ({
	type: "thread-created",
	thread,
});

export const boardCreated = (board: Board): StreamEvent => ({
	type: "board-created",
	board,
});

export const resourceCreated = (resource: Resource): StreamEvent => ({
	type: "resource-created",
	resource,
});

/**
 * The connection event, with `pending` **always present**.
 *
 * 11a:17, floor-verified: "replaying zero reports zero rather than omitting the field". A missing field
 * and a zero would render differently in a client that distinguished `undefined` from `0`, and the
 * ticket says which of those the protocol promises.
 */
/**
 * The connection event, with `pending` **always present** and an optional **cause**.
 *
 * 11a:17, floor-verified: "replaying zero reports zero rather than omitting the field". A missing field
 * and a zero would render differently in a client that distinguished `undefined` from `0`.
 *
 * `cause` is 11c's addition, and it is **inside the existing event** rather than a ninth wire name:
 * the vocabulary is fixed at eight (spec L358), and a `connection-changed` that says why it changed is
 * the same event saying more. The client needs it to tell "your access ended" from "the network
 * dropped", because one of those must not be retried.
 */
/**
 * Why a connection event arrived when it was not about access ending.
 *
 * **One added field rather than a ninth wire name**, for the reason `cause` is: the vocabulary is fixed
 * at eight (spec L358), and an event that says more about *why* it fired is the same event saying more.
 * `"workspace-changed"` means the content behind this connection changed wholesale — a purge or a
 * restore — so what it can still deliver is not what it described a moment ago.
 */
export type ConnectionReason = "workspace-changed";

export const connectionChanged = (
	connected: boolean,
	pending: number,
	cause?: AccessEndCause,
	reason?: ConnectionReason,
): StreamEvent => ({
	type: "connection-changed",
	connected,
	pending,
	...(cause === undefined ? {} : { cause }),
	...(reason === undefined ? {} : { reason }),
});

/** The entry-bearing event for a committed entry, its `delivered` flag set from the store's answer. */
export const entryCommitted = (
	threadId: ThreadId,
	entry: Entry,
	delivered: boolean,
): StreamEvent =>
	entry.kind === "message"
		? { type: "message-committed", threadId, entry, delivered }
		: entry.kind === "artifact"
			? { type: "artifact-attached", threadId, entry }
			: entry.kind === "status-move"
				? { type: "status-moved", threadId, entry }
				: { type: "acknowledged", threadId, entry };
