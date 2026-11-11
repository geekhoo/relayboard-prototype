import { describe, expect, expectTypeOf, it } from "vitest";
import type { Board, Entry, Principal, Resource, Thread } from "#/domain";
import { errorMessageList } from "#/domain";
import type { StoreSeed } from "#/server/store";
import { createStore } from "#/server/store";

/**
 * The store, asserted at its operations rather than at its insides.
 *
 * Every assertion here can be made by a caller who has never seen the module: what
 * the operations return, and which documented string a rejected call fails with.
 * No test names a field of the store's own, a map key, or the files the module is
 * split into, so the store can be reorganised without any of this changing.
 *
 * The fixture is a two-board workspace rather than the demo one, because the
 * factory takes its seed as input (02b) and the demo seed is 02c's separate job.
 */

const alex: Principal = {
	id: "alex",
	name: "Alex Morgan",
	kind: "human",
	origin: "demo",
};

const maya: Principal = {
	id: "maya",
	name: "Maya Chen",
	kind: "human",
	origin: "demo",
};

const orion: Principal = {
	id: "orion",
	name: "Orion",
	kind: "agent",
	origin: "demo",
};

const sara: Principal = {
	id: "sara",
	name: "Sara Reed",
	kind: "human",
	origin: "demo",
};

const platform: Board = {
	id: "platform",
	name: "Platform workspace",
	description: "Engineering discussions and shared decisions.",
	origin: "demo",
};

const design: Board = {
	id: "design",
	name: "Design system",
	description: "Component decisions and a shared UI language.",
	origin: "demo",
};

const delivery: Thread = {
	id: "delivery",
	boardId: "platform",
	title: "Durable message delivery",
	creatorId: "maya",
	createdAt: "2026-11-11T05:00:00.000Z",
	origin: "demo",
};

const identity: Thread = {
	id: "identity",
	boardId: "platform",
	title: "Agent identity and authorship",
	creatorId: "alex",
	createdAt: "2026-11-11T06:30:00.000Z",
	origin: "demo",
};

const components: Thread = {
	id: "components",
	boardId: "design",
	title: "Conversation components",
	creatorId: "alex",
	createdAt: "2026-11-11T04:15:00.000Z",
	origin: "demo",
};

/** The first delivery entry. Its timestamp is *earlier* than the second one's is *later*: order is `seq`. */
const deliveryOne: Entry = {
	id: "seed-delivery-1",
	kind: "message",
	seq: 1,
	authorId: "maya",
	createdAt: "2026-11-11T07:00:00.000Z",
	origin: "demo",
	text: "Flat threads, per-thread ordering, and no runtime dependency.",
	references: [],
};

const deliveryTwo: Entry = {
	id: "seed-delivery-2",
	kind: "message",
	seq: 2,
	authorId: "orion",
	createdAt: "2026-11-11T06:45:00.000Z",
	origin: "demo",
	text: "Persist the message and its outbox event together.",
	references: [{ resourceId: "res-1" }],
};

const identityOne: Entry = {
	id: "seed-identity-1",
	kind: "message",
	seq: 1,
	authorId: "alex",
	createdAt: "2026-11-11T06:20:00.000Z",
	origin: "demo",
	text: "Humans and agents share one principal abstraction.",
	references: [],
};

const componentsOne: Entry = {
	id: "seed-components-1",
	kind: "message",
	seq: 1,
	authorId: "alex",
	createdAt: "2026-11-11T06:10:00.000Z",
	origin: "demo",
	text: "The composer should be the most obvious action.",
	references: [],
};

const notes: Resource = {
	id: "res-1",
	boardId: "platform",
	name: "Messaging architecture notes",
	url: "https://microservices.io/patterns/data/transactional-outbox.html",
	type: "Document",
	description: "Transactional outbox reference",
	origin: "demo",
};

/**
 * The prototype's `board.members` arrays have no home in the new model (a principal
 * is on a board because it holds a grant there), so the store is handed a predicate
 * until 07a's grant lookup replaces it. This fixture's permutation is not the demo
 * one; 02c supplies the real one from `app.js` L30-32.
 */
const MEMBERSHIP: Readonly<Record<string, readonly string[]>> = {
	platform: ["alex", "maya", "orion"],
	design: ["alex", "sara"],
};

const isBoardMember = (principalId: string, boardId: string): boolean =>
	(MEMBERSHIP[boardId] ?? []).includes(principalId);

/** A fresh fixture each time, so one test cannot hand its mutations to the next. */
const fixture = (): StoreSeed => ({
	principals: [alex, maya, orion, sara],
	boards: [platform, design],
	threads: [delivery, identity, components],
	entries: {
		delivery: [deliveryOne, deliveryTwo],
		identity: [identityOne],
		components: [componentsOne],
	},
	resources: [notes],
});

describe("the store factory", () => {
	it("holds the workspace its seed described, read back through the operations", () => {
		const store = createStore(fixture(), { isBoardMember });

		expect(store.listBoards().map((board) => board.id)).toEqual([
			"platform",
			"design",
		]);
		expect(store.listThreads("platform").map((thread) => thread.id)).toEqual([
			"delivery",
			"identity",
		]);
		expect(
			store.listResources("platform").map((resource) => resource.id),
		).toEqual(["res-1"]);
		expect(store.readEntries("delivery").map((entry) => entry.seq)).toEqual([
			1, 2,
		]);
	});

	it("creates two stores from two different seeds that share no state", () => {
		const one = createStore(fixture(), { isBoardMember });
		// A different workspace: one board, one thread, one entry.
		const two = createStore(
			{
				...fixture(),
				threads: [components],
				entries: { components: [componentsOne] },
			},
			{ isBoardMember },
		);

		one.appendMessage({
			threadId: "delivery",
			authorId: "maya",
			text: "One more from the first store.",
		});

		// Neither the appended entry nor the seeded collections leaked across.
		expect(one.readEntries("delivery")).toHaveLength(3);
		expect(two.listBoards().map((board) => board.id)).toEqual([
			"platform",
			"design",
		]);
		expect(two.listThreads("platform")).toEqual([]);
		expect(two.readEntries("delivery")).toEqual([]);
		expect(one.readEntries("components")).toHaveLength(1);
		// And the seed object the caller passed in was not modified by either store.
		expect(fixture().entries.delivery).toHaveLength(2);
	});

	it("keeps its collections to itself, so one store's lists are not another's and not the seed's", () => {
		const shared = fixture();
		const one = createStore(shared, { isBoardMember });
		const two = createStore(shared, { isBoardMember });

		// Two stores over one seed object hold the same records, not the same arrays. A
		// caller that mutates what it was handed — or the seed it handed in — cannot
		// reach either store's state through it.
		const boards = one.listBoards() as Board[];
		expect(() => {
			boards.push(design);
		}).toThrow();
		const threads = one.listThreads("platform") as Thread[];
		threads.pop();
		(shared.boards as Board[]).pop();

		expect(one.listBoards()).toHaveLength(2);
		expect(one.listThreads("platform")).toHaveLength(2);
		expect(two.listBoards()).toHaveLength(2);
		expect(two.listThreads("platform")).toHaveLength(2);
	});

	it("hands out entries a caller cannot rewrite and a history it cannot append to", () => {
		const store = createStore(fixture(), { isBoardMember });
		const entries = store.readEntries("delivery");

		expect(() => {
			(entries as Entry[]).push(deliveryOne);
		}).toThrow();
		expect(() => {
			(entries[0] as { text: string }).text = "Rewritten.";
		}).toThrow();

		expect(store.readEntries("delivery")).toHaveLength(2);
		expect(store.readEntries("delivery")[0]?.text).toBe(
			"Flat threads, per-thread ordering, and no runtime dependency.",
		);
	});
});
describe("the per-thread sequence", () => {
	it("starts each thread at 1 and appends its own gapless sequence", () => {
		const store = createStore(fixture(), { isBoardMember });

		const onIdentity = store.appendMessage({
			threadId: "identity",
			authorId: "alex",
			text: "One abstraction for both kinds.",
		});
		const onDelivery = store.appendMessage({
			threadId: "delivery",
			authorId: "maya",
			text: "Retention is a separate question.",
		});

		// Two threads, two counters: each continues from its own last number.
		expect(onIdentity.seq).toBe(2);
		expect(onDelivery.seq).toBe(3);
		// The untouched thread is untouched.
		expect(store.readEntries("components").map((entry) => entry.seq)).toEqual([
			1,
		]);
		// Gapless, from 1, with no repeats.
		const delivery = store.readEntries("delivery").map((entry) => entry.seq);
		expect(delivery).toEqual([1, 2, 3]);
	});

	it("never rewrites a number, and a caller cannot reassign one it was given", () => {
		const store = createStore(fixture(), { isBoardMember });

		const first = store.readEntries("delivery")[0];
		store.appendMessage({
			threadId: "delivery",
			authorId: "maya",
			text: "A third entry.",
		});

		// The entry handed out before the append is the same record afterwards, at the
		// same position: an assigned number is not re-derived on read.
		expect(store.readEntries("delivery")[0]).toBe(first);
		expect(first?.seq).toBe(1);
		// And the record is frozen, so a caller cannot take a position and change it.
		expect(() => {
			(first as { seq: number }).seq = 99;
		}).toThrow();
		expect(store.readEntries("delivery").map((entry) => entry.seq)).toEqual([
			1, 2, 3,
		]);
	});
});
describe("an append the store refuses", () => {
	const rejections = [
		{
			// Every way to be wrong at once: the thread is what is checked first.
			name: "an unknown thread",
			append: {
				threadId: "no-such-thread",
				authorId: "sara",
				text: "",
			},
			message: "Thread not found",
		},
		{
			name: "a principal who is not on the thread's board",
			append: {
				threadId: "delivery",
				authorId: "sara",
				text: "",
			},
			message: "This participant is not a board member",
		},
		{
			name: "text that is empty once trimmed",
			append: {
				threadId: "delivery",
				authorId: "maya",
				text: "   \n\t ",
			},
			message: "Message cannot be empty",
		},
	];

	it("rejects each in the documented order, with the documented string", () => {
		const store = createStore(fixture(), { isBoardMember });

		// The three cases carry an empty text on purpose: each must fail on the rule
		// before the last one, which is what makes the order observable.
		for (const rejection of rejections) {
			expect(
				() => store.appendMessage(rejection.append),
				rejection.name,
			).toThrow(rejection.message);
		}
	});

	it("leaves the store unchanged and consumes no seq", () => {
		const store = createStore(fixture(), { isBoardMember });

		for (const rejection of rejections) {
			expect(() => store.appendMessage(rejection.append)).toThrow();
		}
		// The rejections would have taken 3, 4 and 5 — three refusals, no numbers.
		expect(store.readEntries("delivery").map((entry) => entry.seq)).toEqual([
			1, 2,
		]);

		const accepted = store.appendMessage({
			threadId: "delivery",
			authorId: "maya",
			text: "Accepted, and it lands on the number the refusals did not take.",
		});

		expect(accepted.seq).toBe(3);
		expect(store.readEntries("delivery").map((entry) => entry.seq)).toEqual([
			1, 2, 3,
		]);
	});

	it("throws the domain's own strings, in the domain's documented order", () => {
		const store = createStore(fixture(), { isBoardMember });

		// A caller can only observe the message; comparing it to the domain's exported
		// list is what makes "one place in the domain" checkable from outside rather
		// than a claim about the source layout.
		const thrown = rejections.map((rejection) => {
			try {
				store.appendMessage(rejection.append);
				return null;
			} catch (error) {
				return (error as Error).message;
			}
		});

		expect(thrown).toEqual([...errorMessageList]);
	});

	it("trims the text it stores, so the stored words are the words that matter", () => {
		const store = createStore(fixture(), { isBoardMember });

		const entry = store.appendMessage({
			threadId: "delivery",
			authorId: "maya",
			text: "  Padded on purpose.  ",
		});

		expect(entry.text).toBe("Padded on purpose.");
	});
});

describe("an append replayed under its idempotency key", () => {
	it("returns the identical entry and appends nothing", () => {
		const store = createStore(fixture(), { isBoardMember });
		const input = {
			threadId: "delivery",
			authorId: "maya",
			text: "Send once.",
			idempotencyKey: "draft-1",
		};

		const first = store.appendMessage(input);
		const replay = store.appendMessage(input);

		expect(replay).toBe(first);
		expect(store.readEntries("delivery")).toHaveLength(3);
	});

	it("is checked before validation, so a replay of a stored key returns the entry even if the text would now be rejected", () => {
		const store = createStore(fixture(), { isBoardMember });

		const first = store.appendMessage({
			threadId: "delivery",
			authorId: "maya",
			text: "Send once.",
			idempotencyKey: "draft-2",
		});

		// The retry carries the same key and a text that is now empty. If validation ran
		// first it would fail with "Message cannot be empty"; a retry must be safe, so
		// the stored entry comes back instead. Only that ordering makes both true.
		const replay = store.appendMessage({
			threadId: "delivery",
			authorId: "maya",
			text: "   ",
			idempotencyKey: "draft-2",
		});

		expect(replay).toBe(first);
		expect(store.readEntries("delivery")).toHaveLength(3);
		// And the blank replayed text was not written anywhere.
		expect(store.readEntries("delivery").at(-1)?.text).toBe("Send once.");
	});
});
describe("the watermarks", () => {
	/** One principal's position in one thread, as `readPositions` reports it. */
	const positionOf = (
		store: ReturnType<typeof createStore>,
		threadId: string,
		principalId: string,
	) => {
		const position = store
			.readPositions(threadId)
			.find((candidate) => candidate.principalId === principalId);
		if (!position) throw new Error(`no position for ${principalId}`);
		return position.watermarks;
	};

	it("advances neither watermark while the principal is paused", () => {
		const store = createStore(fixture(), { isBoardMember });
		store.setConnection("alex", false);

		store.appendMessage({
			threadId: "delivery",
			authorId: "maya",
			text: "Committed while Alex had the stream paused.",
		});

		// Seeded history counts as delivered, so the cursor sits where the seed left it
		// and the pause holds it there rather than winding it back.
		expect(positionOf(store, "delivery", "alex")).toEqual({
			cursor: 2,
			seen: 0,
			acknowledged: 0,
		});
		// The entry is in history regardless: pausing withholds, it does not lose.
		expect(store.readEntries("delivery")).toHaveLength(3);
	});

	it("advances cursor only on resume, and never seen", () => {
		const store = createStore(fixture(), { isBoardMember });
		store.setConnection("alex", false);
		store.appendMessage({
			threadId: "delivery",
			authorId: "maya",
			text: "Withheld while paused.",
		});

		store.setConnection("alex", true);

		// Resuming replays what was withheld, so delivery catches up to the thread's
		// last position. Reading did not happen, so `seen` did not move.
		expect(positionOf(store, "delivery", "alex")).toEqual({
			cursor: 3,
			seen: 0,
			acknowledged: 0,
		});
	});

	it("advances seen only when the principal reads, and leaves cursor where it was", () => {
		const store = createStore(fixture(), { isBoardMember });
		store.setConnection("alex", true);
		const before = positionOf(store, "delivery", "alex");

		store.markRead("alex", "delivery");

		expect(before).toEqual({ cursor: 2, seen: 0, acknowledged: 0 });
		expect(positionOf(store, "delivery", "alex")).toEqual({
			cursor: 2,
			seen: 2,
			acknowledged: 0,
		});
	});

	it("is per principal and per thread, so one principal's progress moves nobody else's", () => {
		const store = createStore(fixture(), { isBoardMember });

		store.markRead("alex", "delivery");

		// Alex read the delivery thread, and only that one.
		expect(positionOf(store, "delivery", "alex").seen).toBe(2);
		expect(positionOf(store, "identity", "alex").seen).toBe(0);
		// Maya is in the same thread and has not read it, so Alex's read moved nothing.
		expect(positionOf(store, "delivery", "maya").seen).toBe(0);

		store.markRead("maya", "delivery");

		expect(positionOf(store, "delivery", "maya").seen).toBe(2);
	});

	it("withholds a paused principal's entries from its view and leaves them in history", () => {
		const store = createStore(fixture(), { isBoardMember });
		store.setConnection("alex", true);

		const lastSeenBeforePause = store.readView("delivery", "alex").at(-1);
		store.setConnection("alex", false);
		store.appendMessage({
			threadId: "delivery",
			authorId: "maya",
			text: "First while paused.",
		});
		store.appendMessage({
			threadId: "delivery",
			authorId: "orion",
			text: "Second while paused.",
		});

		const view = store.readView("delivery", "alex");
		expect(view.at(-1)).toBe(lastSeenBeforePause);
		expect(view).toHaveLength(2);
		// Meanwhile the thread grew, and the withheld entries are readable history.
		expect(store.readEntries("delivery")).toHaveLength(4);
		expect(store.readEntries("delivery").at(-1)?.text).toBe(
			"Second while paused.",
		);
	});

	it("keeps the principal's own entries in its view while paused, because they are not someone else's delivery", () => {
		const store = createStore(fixture(), { isBoardMember });
		store.setConnection("alex", false);

		const own = store.appendMessage({
			threadId: "delivery",
			authorId: "alex",
			text: "Written while the stream was paused.",
		});

		expect(store.readView("delivery", "alex")).toContainEqual(own);
	});
});
describe("the seed", () => {
	it("is five collections and nothing else", () => {
		// The factory takes exactly this, so a test can start from an empty workspace or
		// a two-thread fixture; nothing about the demo content is baked in (02c supplies
		// that as a seed like any other).
		expectTypeOf<keyof StoreSeed>().toEqualTypeOf<
			"principals" | "boards" | "threads" | "entries" | "resources"
		>();
		expect(Object.keys(fixture()).sort()).toEqual([
			"boards",
			"entries",
			"principals",
			"resources",
			"threads",
		]);
	});

	it("starts an empty workspace when no seed is given", () => {
		const store = createStore();

		expect(store.listBoards()).toEqual([]);
		expect(store.readPrincipal("alex")).toBeUndefined();
		expect(store.readEntries("delivery")).toEqual([]);
	});
});

describe("origin", () => {
	it("is recorded on every entry, and a seeded one keeps the origin it was given", () => {
		const store = createStore(fixture(), { isBoardMember });

		const appended = store.appendMessage({
			threadId: "delivery",
			authorId: "maya",
			text: "Mine, made here.",
		});

		// A seeded record says where it came from; a record written through the store is
		// the owner's. Neither is inferred from the other.
		expect(store.readEntries("delivery").map((entry) => entry.origin)).toEqual([
			"demo",
			"demo",
			"owner",
		]);
		expect(appended.origin).toBe("owner");
	});

	it("changes nothing about what an operation will do, because it is provenance and not permission", () => {
		const store = createStore(fixture(), { isBoardMember });

		// A demo thread accepts an owner entry and its demo entries stay demo: no
		// operation consults origin, so nothing is refused or rewritten on account of it.
		store.appendMessage({
			threadId: "delivery",
			authorId: "maya",
			text: "An owner entry on a demo thread.",
		});

		expect(store.readEntries("delivery")[0]?.origin).toBe("demo");
		expect(store.readThread("delivery")?.origin).toBe("demo");
		expect(store.readEntries("delivery")).toHaveLength(3);
	});
});

describe("the append's synchronous step", () => {
	it("returns an entry rather than a promise, because there is nothing to interleave with", () => {
		const store = createStore(fixture(), { isBoardMember });

		const entry = store.appendMessage({
			threadId: "delivery",
			authorId: "maya",
			text: "Synchronous.",
		});

		// Asserted so that a later move to an asynchronous store cannot happen quietly:
		// an `async` append changes this type and this test, which is the moment the
		// "no await between computing the next seq and appending" rule has to be revisited.
		expectTypeOf(store.appendMessage).returns.toEqualTypeOf<Entry>();
		expect(entry).not.toBeInstanceOf(Promise);
		expect(store.readEntries("delivery").at(-1)).toBe(entry);
	});
});
