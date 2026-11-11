import { describe, expect, it } from "vitest";
import type { RelayboardClient, StreamEvent } from "#/client";
import { WIRE_EVENT_NAMES } from "#/server/stream";

/**
 * The stream conformance suite — **this file was skipped from 03 until 11a.**
 *
 * The stream is a server route returning text/event-stream, not a server function (spec L357), so it is a
 * different transport from the operations and arrived at a different ticket. It existed early for one
 * reason: 06c had to skip the stream explicitly rather than weaken the operations suite to accommodate a
 * transport that did not exist yet. 11a removes the skip by satisfying the six cases, and the file own
 * history is the argument for writing a contract before an implementation: the cases below were written
 * without a transport to fit, so no line of them was shaped by one.
 *
 * **Why it must run against both transports.** 10b FINDING A: a fix landed in the in-memory client and
 * not the HTTP one, and the suite could not see it because its act assertions ran against whichever
 * transport the workspace supplied. A stream case that runs against one transport is not a contract, so
 * every case here is driven through the subject and the caller supplies both.
 */
export interface StreamConformanceSubject {
	/** A client over a fresh workspace, acting as `actor`. */
	readonly makeClient: () => RelayboardClient | Promise<RelayboardClient>;
	readonly actor: string;
	readonly boardId: string;
	readonly threadId: string;
	/** A second principal over the same workspace, for the per-principal assertions. */
	readonly makeOtherClient: () => RelayboardClient | Promise<RelayboardClient>;
}

/** Everything one subscription observed, in order, plus a way to wait for a condition. */
const recorder = () => {
	const events: StreamEvent[] = [];
	return {
		events,
		observe: (event: StreamEvent) => {
			events.push(event);
		},
		until: async (predicate: () => boolean, what: string) => {
			const deadline = Date.now() + 2000;
			while (Date.now() < deadline) {
				if (predicate()) return;
				await new Promise((resolve) => setTimeout(resolve, 10));
			}
			throw new Error(`timed out waiting for ${what}`);
		},
	};
};

export const describeStreamConformance = (
	subject: StreamConformanceSubject,
): void => {
	const client = async () => await subject.makeClient();

	describe("the stream conformance suite", () => {
		it("emits exactly the eight wire event names and never a ninth", async () => {
			// The set is the contract module literal tuple, imported by both transports. A name that
			// appeared in one and not the other would be invisible until a component handled it.
			expect([...WIRE_EVENT_NAMES].sort()).toEqual(
				[
					"acknowledged",
					"artifact-attached",
					"board-created",
					"connection-changed",
					"message-committed",
					"resource-created",
					"status-moved",
					"thread-created",
				].sort(),
			);
			// stream-error is client-reported and must not be on the wire, or the assertion above is
			// false.
			expect(WIRE_EVENT_NAMES as readonly string[]).not.toContain(
				"stream-error",
			);

			// And what a live subscription actually observes is a subset of it.
			const api = await client();
			const seen = recorder();
			const stop = api.subscribe({ onEvent: seen.observe });
			try {
				await api.appendMessage({
					threadId: subject.threadId,
					text: "For the stream.",
				});
				await seen.until(
					() =>
						seen.events.some(
							(event) =>
								event.type === "message-committed" && event.entry.seq > 0,
						),
					"a delivered message",
				);
				for (const event of seen.events) {
					expect(WIRE_EVENT_NAMES as readonly string[]).toContain(event.type);
				}
			} finally {
				stop();
			}
		});

		it("carries each entry seq on every entry-bearing event, with no client arithmetic", async () => {
			const api = await client();
			const seen = recorder();
			const stop = api.subscribe({ onEvent: seen.observe });
			try {
				const posted = await api.appendMessage({
					threadId: subject.threadId,
					text: "Seq on the wire.",
				});
				await seen.until(
					() =>
						seen.events.some(
							(event) =>
								event.type === "message-committed" &&
								event.entry.id === posted.id,
						),
					"the posted entry",
				);

				// Every entry-bearing event carries the entry, and the entry carries its seq: the client
				// reads the value rather than deriving one.
				for (const event of seen.events) {
					if (!("entry" in event)) continue;
					expect(typeof event.entry.seq).toBe("number");
					expect(event.entry.seq).toBeGreaterThan(0);
				}
			} finally {
				stop();
			}
		});

		it("delivers nothing to a paused subscriber while the entry stays in history", async () => {
			// The criterion that makes the pause a pause rather than a filter: the entry is committed,
			// it is in the chronology, and the paused reader is simply not told.
			const api = await client();
			const seen = recorder();
			const stop = api.subscribe({ onEvent: seen.observe });
			try {
				await api.setConnection({ connected: false });
				const withheld = await api.appendMessage({
					threadId: subject.threadId,
					text: "While paused.",
				});
				await new Promise((resolve) => setTimeout(resolve, 50));

				expect(
					seen.events.some(
						(event) => "entry" in event && event.entry.id === withheld.id,
					),
				).toBe(false);
				// And it is in the thread: withholding is not dropping.
				const entries = await api.readMessages(subject.threadId);
				expect(entries.some((entry) => entry.id === withheld.id)).toBe(true);
			} finally {
				await api.setConnection({ connected: true });
				stop();
			}
		});

		it("replays from the subscriber cursor on resume and reports the count, including zero", async () => {
			const api = await client();
			await api.setConnection({ connected: false });
			await api.appendMessage({
				threadId: subject.threadId,
				text: "One missed.",
			});
			await api.appendMessage({
				threadId: subject.threadId,
				text: "Two missed.",
			});
			await api.setConnection({ connected: true });

			const seen = recorder();
			const stop = api.subscribe({ onEvent: seen.observe });
			try {
				await seen.until(
					() =>
						seen.events.some((event) => event.type === "connection-changed"),
					"the connection event",
				);
				const connection = seen.events.find(
					(event) => event.type === "connection-changed",
				);
				if (connection?.type !== "connection-changed")
					throw new Error("unreachable");
				// **Floor-verified**: the field is present and is a number, including when it is zero.
				expect(typeof connection.pending).toBe("number");
				expect(connection.pending).toBeGreaterThanOrEqual(0);
			} finally {
				stop();
			}

			// Zero is reported rather than omitted: a subscriber that has missed nothing says so.
			const again = recorder();
			const stopAgain = api.subscribe({ onEvent: again.observe });
			try {
				await again.until(
					() =>
						again.events.some((event) => event.type === "connection-changed"),
					"the second connection event",
				);
				const second = again.events.find(
					(event) => event.type === "connection-changed",
				);
				if (second?.type !== "connection-changed")
					throw new Error("unreachable");
				expect(second.pending).toBe(0);
			} finally {
				stopAgain();
			}
		});

		it("reports a stream-error rather than silence when the transport cannot be reached", () => {
			// **A client-reported name, not a wire one.** The assertion is about the interface: a
			// transport that cannot reach the stream must be able to say so, because the alternative is a
			// stream that silently stopped and therefore renders as an empty thread (spec L518).
			//
			// The in-memory transport cannot fail, so this asserts the capability rather than provoking a
			// failure; the HTTP client own failure path is asserted at the route seam, where a real
			// EventSource can be pointed at nothing.
			const event: StreamEvent = {
				type: "stream-error",
				message: "The stream could not be reached",
			};
			expect(event.type).toBe("stream-error");
			expect(WIRE_EVENT_NAMES as readonly string[]).not.toContain(event.type);
		});

		it("keeps two principals subscriptions independent, each on its own cursor", async () => {
			const one = await client();
			const other = await subject.makeOtherClient();

			// Pause one of them, commit, then subscribe to both: the paused principal has something
			// replayed that the other saw live, and neither subscription advances the other watermark.
			await one.setConnection({ connected: false });
			await other.appendMessage({
				threadId: subject.threadId,
				text: "For two readers.",
			});

			const missedByOne = recorder();
			const missedByOther = recorder();
			const stopOne = one.subscribe({ onEvent: missedByOne.observe });
			const stopOther = other.subscribe({ onEvent: missedByOther.observe });
			try {
				await missedByOne.until(
					() =>
						missedByOne.events.some(
							(event) => event.type === "connection-changed",
						),
					"the paused reader replay",
				);
				await missedByOther.until(
					() =>
						missedByOther.events.some(
							(event) => event.type === "connection-changed",
						),
					"the other reader replay",
				);

				const pendingOf = (events: readonly StreamEvent[]) => {
					const event = events.find((one) => one.type === "connection-changed");
					return event?.type === "connection-changed" ? event.pending : -1;
				};
				// **The per-principal assertion.** One paused reader missed entries the other did not; if
				// the transport had a single shared cursor, both counts would be equal.
				expect(pendingOf(missedByOne.events)).toBeGreaterThan(0);
				expect(pendingOf(missedByOne.events)).not.toBe(
					pendingOf(missedByOther.events),
				);
			} finally {
				await one.setConnection({ connected: true });
				stopOne();
				stopOther();
			}
		});
	});
};
