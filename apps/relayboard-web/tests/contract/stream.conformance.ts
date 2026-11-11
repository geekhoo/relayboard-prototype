import { describe, it } from "vitest";
import type { RelayboardClient } from "#/client";

/**
 * The stream conformance suite — **skipped pending 11a**.
 *
 * The stream is a server route returning `text/event-stream`, not a server function
 * (spec L343), so it is a different transport from the operations and arrives at a
 * different ticket. This file exists now rather than then for one reason: 06c has to be
 * able to skip the stream *explicitly* rather than weaken the operations suite to
 * accommodate a transport that does not exist yet, and 11a turns this skip into a run
 * rather than writing the file from scratch.
 *
 * The cases below are the ones 11a's criteria name. They are written as skipped tests,
 * not as prose, so the absence is visible in every test run: an empty file would make
 * "the stream is not tested yet" invisible, which is the failure mode 06a's "fails
 * loudly" rule exists to prevent. 11a removes `.skip` from the `describe` and fills the
 * bodies, at which point the same file runs against the SSE transport and against the
 * in-memory client.
 */

/** What a stream transport under conformance must supply. */
export interface StreamConformanceSubject {
	/** A client over a fresh workspace, acting as `actor`. */
	readonly makeClient: () => RelayboardClient | Promise<RelayboardClient>;
	readonly actor: string;
	readonly boardId: string;
	readonly threadId: string;
	/** A second principal over the same workspace, for the per-principal assertions. */
	readonly makeOtherClient: () => RelayboardClient | Promise<RelayboardClient>;
}

export const describeStreamConformance = (
	_subject: StreamConformanceSubject,
): void => {
	describe.skip("the stream conformance suite (arrives with 11a)", () => {
		it("emits exactly the eight wire event names and never a ninth", () => {
			// `message-committed`, `thread-created`, `board-created`, `resource-created`,
			// `artifact-attached`, `status-moved`, `acknowledged`, `connection-changed`.
			// `stream-error` is client-reported and must not appear on the wire, or 11a's own
			// literal-set assertion breaks.
		});

		it("carries each entry's seq on every entry-bearing event, with no client arithmetic", () => {});

		it("delivers nothing to a paused subscriber while the entry stays in history", () => {});

		it("replays from the subscriber's cursor on resume and reports the count, including zero", () => {});

		it("reports a stream-error rather than silence when the transport cannot be reached", () => {});

		it("keeps two principals' subscriptions independent, each on its own cursor", () => {});
	});
};
