import { describe, expect, expectTypeOf, it } from "vitest";
import type {
	Board,
	BoardTheme,
	Entry,
	EntryRelation,
	Grant,
	MessageEntry,
	Origin,
	PermissionName,
	Principal,
	Resource,
	Seq,
	Thread,
	Watermarks,
} from "#/domain";
import * as domain from "#/domain";

/**
 * The domain's record types, asserted at the module's public seam.
 *
 * Shape assertions are written as exact types rather than as field-by-field
 * checks, because several of this ticket's criteria are about what a record must
 * **not** carry: a thread with no member list, a watermark type with no `read` or
 * `position`. An exact `toEqualTypeOf` fails on an added field as well as a missing
 * one, so the absence is asserted by the same line that asserts the presence.
 */

/** One human and one agent, both carrying nothing but the label that tells them apart. */
const human: Principal = {
	id: "alex",
	name: "Alex Morgan",
	kind: "human",
	origin: "demo",
	description: "Product & engineering",
	browserSelectable: true,
};

const agent: Principal = {
	id: "orion",
	name: "Orion",
	kind: "agent",
	origin: "demo",
	description: "Research agent · independent runtime",
	browserSelectable: false,
};

describe("Principal", () => {
	it("has exactly two kinds, a human and an agent", () => {
		expectTypeOf<Principal["kind"]>().toEqualTypeOf<"human" | "agent">();
		expect(human.kind).toBe("human");
		expect(agent.kind).toBe("agent");
	});

	it("is an id, a name, a kind, an origin, a declared description and a seed mark, and holds nothing that grants anything", () => {
		expect(Object.keys(human).sort()).toEqual([
			"browserSelectable",
			"description",
			"id",
			"kind",
			"name",
			"origin",
		]);
		// The two fields past 02a are neither capabilities nor derived values:
		// `description` is what the principal says about itself (declared, never
		// verified — 12 renders it labelled as declared), and `browserSelectable` is a
		// fact about the demo seed (spec L366: the session names a principal "selected
		// round-robin from those the seed marks as browser-selectable"), not a
		// permission. Neither may be read as "what this principal may do".
		expectTypeOf<Principal>().toEqualTypeOf<{
			readonly id: string;
			readonly name: string;
			readonly kind: "human" | "agent";
			readonly origin: Origin;
			readonly description: string;
			readonly browserSelectable: boolean;
		}>();
	});

	it("gives the two kinds the same shape, so nothing can be read off the difference", () => {
		// The one place a kind is load-bearing is the permission rule that only a
		// human may hold the gate, and that rule belongs to the permission module.
		// If the two kinds held different fields, this record would already imply a
		// second branch on kind.
		expect(Object.keys(agent).sort()).toEqual(Object.keys(human).sort());
		expectTypeOf<typeof agent>().toEqualTypeOf<typeof human>();
	});
});

describe("Origin", () => {
	it("is provenance with two values: demo content, or the reader's own", () => {
		expectTypeOf<Origin>().toEqualTypeOf<"demo" | "owner">();
		const demo: Origin = "demo";
		const owner: Origin = "owner";
		expect([demo, owner]).toEqual(["demo", "owner"]);
	});
});

/** The board and thread the resource and the entry below belong to. */
const board: Board = {
	id: "platform",
	name: "Platform workspace",
	short: "P",
	theme: "sage",
	description: "Engineering discussions, architecture, and shared decisions.",
	origin: "demo",
};

const thread: Thread = {
	id: "delivery",
	boardId: "platform",
	title: "Durable message delivery",
	creatorId: "maya",
	createdAt: "2026-11-11T05:00:00.000Z",
	origin: "demo",
};

/** One canonical resource, described the way the prototype describes one (`app.js` L30). */
const resource: Resource = {
	id: "res-1",
	boardId: "platform",
	name: "Messaging architecture notes",
	url: "https://microservices.io/patterns/data/transactional-outbox.html",
	type: "Document",
	description: "Transactional outbox reference",
	origin: "demo",
};

/** The entry the seed uses for a correction: prose that points at an earlier one. */
const correction: Entry = {
	id: "seed-delivery-6",
	kind: "message",
	seq: 6,
	authorId: "orion",
	createdAt: "2026-11-11T06:00:00.000Z",
	origin: "demo",
	text: "Give each subscriber a durable position and expose a replay API.",
	references: [],
	relation: { type: "In response to", entryId: "seed-delivery-5" },
};

describe("Entry", () => {
	it("is a discriminated union with exactly one member today: a message", () => {
		expectTypeOf<Entry>().toEqualTypeOf<MessageEntry>();
		expectTypeOf<Entry["kind"]>().toEqualTypeOf<"message">();
		expect(correction.kind).toBe("message");
	});

	it("carries its position, author, instant and origin whatever its kind", () => {
		expectTypeOf<Entry["seq"]>().toEqualTypeOf<Seq>();
		expectTypeOf<Entry["authorId"]>().toEqualTypeOf<Principal["id"]>();
		expectTypeOf<Entry["createdAt"]>().toEqualTypeOf<string>();
		expectTypeOf<Entry["origin"]>().toEqualTypeOf<Origin>();
	});

	it("carries the relation a correction uses to point at an earlier entry", () => {
		expectTypeOf<Entry["relation"]>().toEqualTypeOf<
			EntryRelation | undefined
		>();
		expect(correction.relation).toEqual({
			type: "In response to",
			entryId: "seed-delivery-5",
		});
		// A plain entry needs no relation, so the field is optional rather than a
		// sentinel such as `null`: absent means "no relation", and nothing has to
		// remember to write the sentinel.
		const first: Entry = { ...correction, relation: undefined };
		expect(first.relation).toBeUndefined();
	});

	it("is rendered by kind, so a new kind cannot be added without being handled", () => {
		// The record is exhaustive over the union's own discriminant. Ticket 10a
		// widens `Entry` to four kinds and this file stops compiling until each new
		// kind is handled here, which is the property the union exists to buy.
		const renderers: {
			readonly [K in Entry["kind"]]: (
				entry: Extract<Entry, { kind: K }>,
			) => string;
		} = {
			message: (entry) => entry.text,
		};

		// One cast, explained: TypeScript cannot correlate a value indexed by a
		// discriminant with the union member that discriminant selects, so the
		// lookup needs a widening. The record's *type* is what carries the
		// guarantee, not this line.
		const prose = (entry: Entry): string =>
			(renderers[entry.kind] as (entry: Entry) => string)(entry);

		expect(prose(correction)).toBe(
			"Give each subscriber a durable position and expose a replay API.",
		);
	});
});

describe("Resource", () => {
	it("is a board-scoped canonical record: id, board, name, url, type, description and origin", () => {
		expectTypeOf<Resource>().toEqualTypeOf<{
			readonly id: string;
			readonly boardId: string;
			readonly name: string;
			readonly url: string;
			readonly type: string;
			readonly description: string;
			readonly origin: Origin;
		}>();
		expect(resource.boardId).toBe(board.id);
	});

	it("is never copied into an entry that refers to it", () => {
		// An entry holds a resource *id*; the resource holds the content. Two threads
		// attaching one resource are two pointers to one record.
		const attached: Entry = {
			...correction,
			references: [{ resourceId: resource.id }],
		};
		expect(Object.keys(attached.references?.[0] ?? {})).toEqual(["resourceId"]);
		expect(Object.keys(attached).sort()).toEqual([
			"authorId",
			"createdAt",
			"id",
			"kind",
			"origin",
			"references",
			"relation",
			"seq",
			"text",
		]);
	});
});

describe("Board and Thread", () => {
	it("both carry their origin, so a purge can tell demo content from the reader's own", () => {
		expectTypeOf<Board["origin"]>().toEqualTypeOf<Origin>();
		expectTypeOf<Thread["origin"]>().toEqualTypeOf<Origin>();
		expect(board.origin).toBe("demo");
		expect(thread.origin).toBe("demo");
	});

	it("a board is a name, a description, its mark and no member list", () => {
		// `short` and `theme` are the rail's 30px rounded-square mark at four documented
		// hues (DESIGN.md §241). `members` is deliberately absent: who is on a board is
		// the grant, so a member list here would be a second source of truth (07a).
		expectTypeOf<Board>().toEqualTypeOf<{
			readonly id: string;
			readonly name: string;
			readonly short: string;
			readonly theme: BoardTheme;
			readonly description: string;
			readonly origin: Origin;
		}>();
		expect(Object.keys(board).sort()).toEqual([
			"description",
			"id",
			"name",
			"origin",
			"short",
			"theme",
		]);
	});

	it("a board's theme is one of four documented hues and no other value", () => {
		// A closed set rather than a free string, because the four hues are what the
		// design system documents and a fifth would render unstyled.
		expectTypeOf<BoardTheme>().toEqualTypeOf<
			"sage" | "ochre" | "lavender" | "blue"
		>();
		expect(board.theme).toBe("sage");
		// One character, not a letter invented per render: the mark is the datum.
		expect(board.short).toHaveLength(1);
	});

	it("a thread carries no member list: a principal is on a board by holding a grant there", () => {
		expectTypeOf<Thread>().toEqualTypeOf<{
			readonly id: string;
			readonly boardId: string;
			readonly title: string;
			readonly creatorId: Principal["id"];
			readonly createdAt: string;
			readonly origin: Origin;
		}>();
		expect(Object.keys(thread).sort()).toEqual([
			"boardId",
			"createdAt",
			"creatorId",
			"id",
			"origin",
			"title",
		]);
	});
});

describe("the watermarks", () => {
	it("are named cursor, seen and acknowledged, and by no other word", () => {
		const marks: Watermarks = { cursor: 9, seen: 7, acknowledged: 2 };
		expect(Object.keys(marks).sort()).toEqual([
			"acknowledged",
			"cursor",
			"seen",
		]);
		// Asserted by exhaustive shape: a `read`, `readPosition` or `position` field
		// would be an extra member here and this line stops compiling.
		expectTypeOf<Watermarks>().toEqualTypeOf<{
			readonly cursor: Seq;
			readonly seen: Seq;
			readonly acknowledged: Seq;
		}>();
	});

	it("are all positions in the thread's own sequence", () => {
		expectTypeOf<Watermarks["cursor"]>().toEqualTypeOf<Seq>();
		expectTypeOf<Watermarks["seen"]>().toEqualTypeOf<Seq>();
		expectTypeOf<Watermarks["acknowledged"]>().toEqualTypeOf<Seq>();
	});
});

describe("the permission vocabulary", () => {
	it("is the fifteen names of spec L326-339, and no other", () => {
		// Asserted as an exact union rather than as a list, because nothing in the domain
		// executes yet: the vocabulary is a type, and 07a is the ticket that gives it
		// enforcement. When 07a adds a runtime list, *this* is the assertion that keeps it
		// honest, because adding a name here is what a new permission costs.
		expectTypeOf<PermissionName>().toEqualTypeOf<
			| "read:board"
			| "read:thread"
			| "read:resource"
			| "read:member"
			| "post:message"
			| "create:thread"
			| "create:board"
			| "update:board"
			| "add:resource"
			| "add:artifact"
			| "move:status"
			| "acknowledge:thread"
			| "admit:agent"
			| "revoke:agent"
			| "grant:permission"
		>();
		// A permission is <verb>:<object> and nothing else, so the shape is checkable from
		// the type alone: every name has one colon and a non-empty side either way.
		const sample: PermissionName = "post:message";
		expect(sample.split(":")).toHaveLength(2);
		expect(sample.startsWith(":")).toBe(false);
	});

	it("is scoped, because an unscoped grant is a workspace-wide grant nobody chose", () => {
		expectTypeOf<Grant["scope"]>().toEqualTypeOf<"workspace" | "board">();
		expectTypeOf<Grant["permissions"]>().toEqualTypeOf<
			readonly PermissionName[]
		>();
		const onOneBoard: Grant = { scope: "board", permissions: ["read:board"] };
		expect(onOneBoard.permissions).toEqual(["read:board"]);
		// Two scopes and no third: there is no "no scope" and no "all boards", because a
		// permission held nowhere would be a workspace-wide one nobody chose.
		expectTypeOf<Grant["scope"]>().not.toEqualTypeOf<string>();
	});
});

describe("the domain module", () => {
	it("exports no runtime value except the documented error strings", () => {
		// 02a could assert something stronger — that the module held no runtime value at
		// all, so nothing in it could branch on anything — because every export was a
		// type. 02b puts the documented error strings here (spec L518: "they live in one
		// place in the domain module"), so that assertion is now false by design and the
		// guarantee it was standing in for is the narrower one below: the module's only
		// executable content is a vocabulary, and a vocabulary cannot branch on a
		// principal's `kind`.
		//
		// 07a owns the durable form of the `kind` check — "a test or lint check makes a
		// second occurrence visible" — because a source-text grep cannot make it here:
		// `Entry` reuses `kind` as its entry discriminant, so `entry.kind` is a
		// legitimate branch and `principal.kind` is not, and telling those apart needs a
		// type-aware rule rather than a search.
		expect(Object.keys(domain).sort()).toEqual([
			"errorMessageList",
			"errorMessages",
		]);
	});

	it("exports the three documented error strings, literally, in the documented order", () => {
		// The order is observable behaviour, not decoration: an append that is wrong in
		// two ways reports the first of these, so a caller learns one thing at a time.
		// Asserted as literals because these strings are user-visible and a reworded one
		// is a behaviour change, not a refactor.
		expect(domain.errorMessageList).toEqual([
			"Thread not found",
			"This participant is not a board member",
			"Message cannot be empty",
		]);
		expect(domain.errorMessages).toEqual({
			threadNotFound: "Thread not found",
			notABoardMember: "This participant is not a board member",
			messageEmpty: "Message cannot be empty",
			// The create path's own failure (spec L514), documented beside the others so
			// there is still one place a user-visible string can come from.
			boardNotFound: "Board not found",
		});
	});

	it("carries only strings, so no runtime rule can live in the domain yet", () => {
		// A function export would be the first place a rule could appear; a string
		// cannot read a record, so this is the property that lets the assertion above
		// mean something.
		for (const value of Object.values(domain)) {
			expect(typeof value === "string" || typeof value === "object").toBe(true);
		}
		expect(
			Object.values(domain).filter((value) => typeof value === "function"),
		).toEqual([]);
	});
});
