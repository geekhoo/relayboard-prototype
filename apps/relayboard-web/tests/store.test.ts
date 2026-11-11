import { describe, expect, expectTypeOf, it } from "vitest";
import type { Board, Entry, Principal, Resource, Thread } from "#/domain";
import type { StoreOptions, StoreSeed } from "#/server/store";
import { createStore } from "#/server/store";
import { describeStoreRules } from "./store-contract";

/**
 * The store against a two-board fixture.
 *
 * This is where 02b's rules are proven on a workspace small enough to reason about by
 * hand. The assertions themselves live in `store-contract`, because 02c has to run the
 * same ones against the demo seed — "the suite still passes against the seeded
 * workspace" has to be the same suite, not a second, gentler one.
 *
 * The demo seed is not here: the factory takes its seed as an argument, and 02c
 * supplies the real one as its own module.
 */

const alex: Principal = {
	id: "alex",
	name: "Alex Morgan",
	kind: "human",
	origin: "demo",
	description: "Product & engineering",
	browserSelectable: true,
};

const maya: Principal = {
	id: "maya",
	name: "Maya Chen",
	kind: "human",
	origin: "demo",
	description: "Engineering lead",
	browserSelectable: true,
};

const orion: Principal = {
	id: "orion",
	name: "Orion",
	kind: "agent",
	origin: "demo",
	description: "Research agent · independent runtime",
	browserSelectable: false,
};

const sara: Principal = {
	id: "sara",
	name: "Sara Reed",
	kind: "human",
	origin: "demo",
	description: "Campaign lead",
	browserSelectable: false,
};

const platform: Board = {
	id: "platform",
	name: "Platform workspace",
	short: "P",
	theme: "sage",
	description: "Engineering discussions and shared decisions.",
	origin: "demo",
};

const design: Board = {
	id: "design",
	name: "Design system",
	short: "D",
	theme: "lavender",
	description: "Component decisions and a shared UI language.",
	origin: "demo",
};

const delivery: Thread = {
	id: "delivery",
	boardId: "platform",
	title: "Durable message delivery",
	creatorId: "maya",
	createdAt: "2026-11-11T05:00:00.000Z",
	pinned: false,
	origin: "demo",
};

const identity: Thread = {
	id: "identity",
	boardId: "platform",
	title: "Agent identity and authorship",
	creatorId: "alex",
	createdAt: "2026-11-11T06:30:00.000Z",
	pinned: false,
	origin: "demo",
};

const components: Thread = {
	id: "components",
	boardId: "design",
	title: "Conversation components",
	creatorId: "alex",
	createdAt: "2026-11-11T04:15:00.000Z",
	pinned: false,
	origin: "demo",
};

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
 * expressed as grants since 07a. This fixture's permutation is not the demo one; 02c
 * supplies the real one from `app.js` L30-32.
 */
const MEMBERSHIP: Readonly<Record<string, readonly string[]>> = {
	platform: ["alex", "maya", "orion"],
	design: ["alex", "sara"],
};

const options = (): StoreOptions => ({
	// The fixture's membership, as grants. The permutation is the one above; the permissions are what
	// the store's own append path asks for, so a test that posts keeps working for the same reason a
	// real principal does rather than because the store was told to allow it.
	grants: Object.entries(MEMBERSHIP).flatMap(([boardId, members]) =>
		members.map((principalId) => ({
			principalId,
			scope: "board" as const,
			boardId,
			permissions: ["read:board", "post:message", "create:thread"] as const,
		})),
	),
});

/** A fresh fixture each time, so one test cannot hand its mutations to the next. */
const seed = (): StoreSeed => ({
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

const create = () => createStore(seed(), options());

describe("the store factory", () => {
	it("holds the workspace its seed described, read back through the operations", () => {
		const store = create();

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
		const one = createStore(seed(), options());
		// A different workspace: one thread, one entry.
		const two = createStore(
			{
				...seed(),
				threads: [components],
				entries: { components: [componentsOne] },
			},
			options(),
		);

		one.appendMessage({
			threadId: "delivery",
			authorId: "maya",
			text: "One more from the first store.",
		});

		expect(one.readEntries("delivery")).toHaveLength(3);
		expect(two.listThreads("platform")).toEqual([]);
		expect(two.readEntries("delivery")).toEqual([]);
		expect(one.readEntries("components")).toHaveLength(1);
	});

	it("keeps its collections to itself, so one store's lists are not another's and not the seed's", () => {
		const shared = seed();
		const one = createStore(shared, options());
		const two = createStore(shared, options());

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
		const store = create();
		const entries = store.readEntries("delivery");

		expect(() => {
			(entries as Entry[]).push(deliveryOne);
		}).toThrow();
		expect(() => {
			(entries[0] as { text: string }).text = "Rewritten.";
		}).toThrow();

		expect(store.readEntries("delivery")).toHaveLength(2);
	});

	it("starts an empty workspace when no seed is given", () => {
		const store = createStore();

		expect(store.listBoards()).toEqual([]);
		expect(store.readPrincipal("alex")).toBeUndefined();
		expect(store.readEntries("delivery")).toEqual([]);
	});

	it("takes five collections and no member list", () => {
		// Pinned as an exact type: the seed is the workspace's content, and a member
		// array here would be the list 07a has to delete.
		expectTypeOf<keyof StoreSeed>().toEqualTypeOf<
			"principals" | "boards" | "threads" | "entries" | "resources"
		>();
		expect(Object.keys(seed()).sort()).toEqual([
			"boards",
			"entries",
			"principals",
			"resources",
			"threads",
		]);
		expect(
			Object.values(seed().boards).flatMap((board) => Object.keys(board)),
		).not.toContain("members");
	});
});

describeStoreRules({
	label: "a two-board fixture",
	create,
	threadId: "delivery",
	otherThreadId: "identity",
	memberId: "maya",
	coMemberId: "orion",
	strangerId: "sara",
});

describe("the seeded watermarks", () => {
	it("are the options' numbers when the seed supplies them, per principal", () => {
		const store = createStore(seed(), {
			...options(),
			watermarks: {
				alex: { delivery: { cursor: 2, seen: 1 } },
				maya: { delivery: { cursor: 1, seen: 0 } },
			},
		});

		const positions = store.readPositions("delivery");
		const of = (principalId: string) =>
			positions.find((position) => position.principalId === principalId)
				?.watermarks;

		// Two principals, two different positions on one thread: this is what lets the
		// demo seed show different badges to two browsers.
		expect(of("alex")).toEqual({ cursor: 2, seen: 1, acknowledged: 0 });
		expect(of("maya")).toEqual({ cursor: 1, seen: 0, acknowledged: 0 });
	});

	it("fall back to the baseline for a principal the seed says nothing about", () => {
		const store = createStore(seed(), {
			...options(),
			watermarks: { alex: { delivery: { cursor: 2, seen: 1 } } },
		});

		const orion = store
			.readPositions("delivery")
			.find((position) => position.principalId === "orion");

		// Everything seeded counts as delivered and nothing is credited as read: a
		// principal the seed does not mention is not silently behind the history.
		expect(orion?.watermarks).toEqual({
			cursor: 2,
			seen: 0,
			acknowledged: 0,
		});
	});
});
