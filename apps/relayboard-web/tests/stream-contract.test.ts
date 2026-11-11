import { describe, expect, it } from "vitest";
import type { StreamEvent } from "#/client";
import {
	advanceCursor,
	cursorFromHeader,
	eventOf,
	frameOf,
	seqOfEvent,
	WIRE_EVENT_NAMES,
} from "#/server/stream";

/**
 * The stream contract, asserted as data.
 *
 * The transport half is in `tests/contract/stream.conformance.ts` and the route half in
 * `e2e/stream.spec.ts`. This file covers the two things that are neither: the **frame encoding** (what a
 * non-browser client must be able to parse, story 155) and the **cursor** (a value the client reads and
 * never computes).
 */
const message: StreamEvent = {
	type: "message-committed",
	threadId: "delivery",
	entry: {
		id: "msg-delivery-7",
		kind: "message",
		seq: 7,
		authorId: "alex",
		createdAt: "2026-11-11T10:00:00.000Z",
		origin: "owner",
		text: "A line with a \n newline in it.",
		references: [],
	},
	delivered: true,
};

describe("the frame encoding", () => {
	it("round-trips an event, with the seq as the SSE id", () => {
		const frame = frameOf(message, 7);
		expect(frame).toContain("id: 7");
		expect(frame).toContain("event: message-committed");
		// The frame ends with a blank line, which is what terminates it.
		expect(frame.endsWith("\n\n")).toBe(true);

		const parsed = eventOf(frame);
		expect(parsed).toEqual(message);
	});

	it("survives a newline inside the payload", () => {
		// JSON escapes its own newlines, so `data` is one line. This is why a payload can contain prose
		// without breaking the framing — worth asserting because a naive `data: ${text}` would not.
		const parsed = eventOf(frameOf(message, 7));
		expect(parsed?.type).toBe("message-committed");
		if (parsed?.type !== "message-committed") return;
		// Narrowed through the union rather than cast: since 10a an entry may be any of four kinds, and a
		// cast here would be the assertion pretending to know more than the type does.
		if (parsed.entry.kind !== "message")
			throw new Error("expected a message entry");
		expect(parsed.entry.text).toContain("\n");
	});

	it("gives an event with no seq no id at all, rather than id 0", () => {
		// A zero would move a reader's cursor backwards, which is the one thing a cursor must not do.
		const frame = frameOf({
			type: "connection-changed",
			connected: true,
			pending: 0,
		});
		expect(frame).not.toContain("id:");
	});

	it("refuses an unknown event name rather than inventing one", () => {
		// A transport that guesses is worse than one that drops a frame it cannot read.
		expect(eventOf('data: {"type":"not-a-wire-name"}')).toBeNull();
		expect(eventOf("data: not json")).toBeNull();
		expect(eventOf(": keep-alive")).toBeNull();
	});
});

describe("the cursor", () => {
	it("advances to a value the server sent, and never computes one", () => {
		// 11a:15: `advanceCursor` is the only place a client cursor moves, and it can only take the max
		// of what it had and what arrived. There is no arithmetic here to get wrong.
		expect(advanceCursor(0, message)).toBe(7);
		expect(advanceCursor(9, message)).toBe(9);
		expect(seqOfEvent(message)).toBe(7);
	});

	it("is unchanged by an event that carries no entry", () => {
		expect(
			seqOfEvent({ type: "connection-changed", connected: true, pending: 3 }),
		).toBe(undefined);
		expect(
			advanceCursor(4, {
				type: "connection-changed",
				connected: true,
				pending: 9,
			}),
		).toBe(4);
	});

	it("reads Last-Event-ID, treating anything unreadable as absent", () => {
		// A proxy is allowed to send anything; refusing the connection over a header would turn a proxy
		// quirk into an outage.
		expect(cursorFromHeader("42")).toBe(42);
		expect(cursorFromHeader(null)).toBe(0);
		expect(cursorFromHeader("not-a-number")).toBe(0);
		expect(cursorFromHeader("-5")).toBe(0);
	});
});

describe("the wire vocabulary", () => {
	it("has no stream-error, which is the client's own name", () => {
		// `stream-error` is in the client union and out of the wire set: a server cannot observe a
		// transport failure, so claiming one on the wire would be a fiction (spec L518).
		expect(WIRE_EVENT_NAMES as readonly string[]).not.toContain("stream-error");
		expect(WIRE_EVENT_NAMES).toHaveLength(8);
	});
});
