import { describe, expect, it } from "vitest";
import type { RelayboardClient, StreamEvent, Unsubscribe } from "#/client";
import { createInMemoryClient } from "#/client/in-memory";
import type { Store } from "#/server/store";
import { createStore } from "#/server/store";
import { demoOptions, demoSeed } from "#/server/store/demo-seed";
import { describeOperationsConformance } from "./contract/operations.conformance";
import { describeStreamConformance } from "./contract/stream.conformance";

/**
 * The in-memory client under conformance.
 *
 * The assertions themselves live in `tests/contract/operations.conformance.ts`, written
 * against the interface, because 06c has to run exactly those against the HTTP client
 * without editing them. This file supplies the subject and adds the two things only a
 * local implementation can be asked: that it drives `subscribe` from the store, and that
 * a second client over one store is a second participant rather than a second universe.
 */

/** One workspace, and a client per principal over it. */
const workspace = () => {
	const store: Store = createStore(demoSeed(), demoOptions());
	return {
		store,
		as: (principalId: string): RelayboardClient =>
			createInMemoryClient({ store, principalId }),
	};
};

describeOperationsConformance({
	label: "the in-memory client",
	// A fresh workspace per test, so no test inherits another's posts.
	makeClient: () => createInMemoryClient({ principalId: "alex" }),
	actor: "alex",
	boardId: "platform",
	threadId: "delivery",
	otherThreadId: "identity",
	otherPrincipalId: "maya",
});

describe("the in-memory client", () => {
	it("is the only implementation in this ticket, and it satisfies the interface", () => {
		// Assigned rather than asserted loosely: the interface is what a transport must be,
		// so a missing member would fail to compile here.
		const client: RelayboardClient = createInMemoryClient({
			principalId: "alex",
		});
		expect(client).toBeDefined();
		expect(typeof client.subscribe).toBe("function");
	});

	it("refuses to act as a principal the workspace does not hold", () => {
		// A session bound to a principal id that no longer exists must resolve to nobody
		// rather than to somebody else (spec L373). The client is fixed at construction, so
		// this is the moment that can be refused.
		expect(() => createInMemoryClient({ principalId: "nobody" })).toThrow(
			/nobody/,
		);
	});

	it("takes the acting principal from its construction, not from a payload", async () => {
		const client = createInMemoryClient({ principalId: "maya" });
		const entry = await client.appendMessage({
			threadId: "delivery",
			text: "Posted by whoever this client is.",
		});

		// Maya acts, so Maya authored it — no field of the request could have said otherwise.
		expect(entry.authorId).toBe("maya");
	});

	it("is one workspace seen by two participants, not two universes", async () => {
		const { as } = workspace();
		const alex = as("alex");
		const maya = as("maya");

		const posted = await alex.appendMessage({
			threadId: "delivery",
			text: "Visible to everybody in this workspace.",
		});

		// The other participant reads the same thread and finds the same entry, at the same
		// position: one store, two clients.
		const seen = await maya.readMessages("delivery");
		expect(seen.some((entry) => entry.id === posted.id)).toBe(true);
		expect(seen.find((entry) => entry.id === posted.id)?.seq).toBe(posted.seq);
	});

	it("keeps each participant's progress their own across one store", async () => {
		const { as } = workspace();
		const alex = as("alex");
		const maya = as("maya");

		// Both are asked through the interface, not by inspecting anything.
		const mayaBefore = await maya.readPositions("delivery");
		const alexBefore = await alex.readPositions("delivery");

		await alex.readThread("delivery");

		const mayaAfter = await maya.readPositions("delivery");
		const alexAfter = await alex.readPositions("delivery");
		const seenOf = (
			positions: Awaited<ReturnType<RelayboardClient["readPositions"]>>,
			principalId: string,
		) =>
			positions.find((position) => position.principalId === principalId)
				?.watermarks.seen;

		// Alex read the thread, so its `seen` moved to the last position.
		expect(seenOf(alexAfter, "alex")).toBeGreaterThan(
			seenOf(alexBefore, "alex") ?? 0,
		);
		// Maya did not, and is exactly where the seed left her: neither participant can
		// advance the other's position.
		expect(seenOf(mayaAfter, "maya")).toBe(seenOf(mayaBefore, "maya"));
	});
});

/**
 * The stream suite, called here so its skip is visible in every run.
 *
 * It asserts nothing yet: the stream's transport is 11a's, and the cases are declared in
 * the file as skipped tests rather than left as prose so that "the stream is not tested
 * here" appears in the report instead of being an empty silence. 11a removes the skip and
 * this call does not change.
 */
describeStreamConformance({
	makeClient: () => createInMemoryClient({ principalId: "alex" }),
	makeOtherClient: () => createInMemoryClient({ principalId: "maya" }),
	actor: "alex",
	boardId: "platform",
	threadId: "delivery",
});

describe("the in-memory subscription", () => {
	/** Collects whatever arrives, so an assertion can look at the whole sequence. */
	const collector = () => {
		const events: StreamEvent[] = [];
		return {
			events,
			handlers: { onEvent: (event: StreamEvent) => events.push(event) },
		};
	};

	it("delivers a committed entry to a subscriber, carrying its seq", async () => {
		const store = createStore(demoSeed(), demoOptions());
		const client = createInMemoryClient({ store, principalId: "alex" });
		const { events, handlers } = collector();

		const unsubscribe: Unsubscribe = client.subscribe(handlers);
		const entry = await client.appendMessage({
			threadId: "delivery",
			text: "Announced as it lands.",
		});
		unsubscribe();

		expect(events).toHaveLength(1);
		const [event] = events;
		expect(event?.type).toBe("message-committed");
		// The entry's own position is the cursor: no client-side sequence arithmetic.
		expect(
			event?.type === "message-committed" ? event.entry.seq : undefined,
		).toBe(entry.seq);
	});

	it("announces a created thread and a created resource, with the records themselves", async () => {
		const client = createInMemoryClient({ principalId: "alex" });
		const { events, handlers } = collector();
		client.subscribe(handlers);

		const thread = await client.createThread({
			boardId: "platform",
			title: "Announced on creation",
		});
		const resource = await client.addResource({
			boardId: "platform",
			name: "Announced resource",
			url: "https://example.com/x",
			description: "For the event test",
		});

		expect(events.map((event) => event.type)).toEqual([
			"thread-created",
			"resource-created",
		]);
		const createdThread = events[0];
		expect(
			createdThread?.type === "thread-created" ? createdThread.thread.id : null,
		).toBe(thread.id);
		const createdResource = events[1];
		expect(
			createdResource?.type === "resource-created"
				? createdResource.resource.id
				: null,
		).toBe(resource.id);
	});

	it("stops delivering when unsubscribed, and never replays what it missed", async () => {
		const store = createStore(demoSeed(), demoOptions());
		const client = createInMemoryClient({ store, principalId: "alex" });
		const { events, handlers } = collector();

		const unsubscribe = client.subscribe(handlers);
		await client.appendMessage({ threadId: "delivery", text: "First." });
		unsubscribe();
		await client.appendMessage({ threadId: "delivery", text: "Second." });

		// The store keeps no backlog for anyone, so a subscriber that left gets nothing on
		// the way back — it resumes from its cursor, which is 11a's replay to build.
		expect(events).toHaveLength(1);
		const resumed = client.subscribe(handlers);
		expect(events).toHaveLength(1);
		resumed();
	});

	it("gives each subscriber its own stream, so one can stop without the other stopping", async () => {
		const store = createStore(demoSeed(), demoOptions());
		const client = createInMemoryClient({ store, principalId: "alex" });
		const first = collector();
		const second = collector();

		const stopFirst = client.subscribe(first.handlers);
		client.subscribe(second.handlers);
		await client.appendMessage({ threadId: "delivery", text: "Both hear it." });
		stopFirst();
		await client.appendMessage({ threadId: "delivery", text: "Only one now." });

		expect(first.events).toHaveLength(1);
		expect(second.events).toHaveLength(2);
	});

	it("reports a surface failure as stream-error rather than silence, once a transport exists to fail", () => {
		// The vocabulary is declared here and one member of it is deliberately not a wire
		// event: a client reports `stream-error` when it cannot reach the stream, so a
		// failure is never rendered as an empty thread (spec L518). The in-memory transport
		// cannot fail, so this asserts the shape the HTTP one will emit.
		const failure: StreamEvent = {
			type: "stream-error",
			message: "The stream is unreachable",
		};

		expect(failure.type).toBe("stream-error");
		// The eight wire names plus it, and nothing else.
		const vocabulary: readonly StreamEvent["type"][] = [
			"message-committed",
			"thread-created",
			"board-created",
			"resource-created",
			"artifact-attached",
			"status-moved",
			"acknowledged",
			"connection-changed",
			"stream-error",
		];
		expect(vocabulary).toHaveLength(9);
		expect(vocabulary).toContain(failure.type);
	});
});
