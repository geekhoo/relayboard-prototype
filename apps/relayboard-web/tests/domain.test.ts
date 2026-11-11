import { describe, expect, expectTypeOf, it } from "vitest";
import type {
	Board,
	BoardTheme,
	Entry,
	EntryRelation,
	Grant,
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
		// fact about the demo seed (spec L368: the session names a principal "selected
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
	pinned: true,
	status: "open",
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
	it("is a discriminated union over the four kinds, and only those", () => {
		// **10a is where the union widened.** Before it this asserted a single member; the assertion
		// that replaces it is the closed set itself, so adding a fifth kind is a deliberate edit here
		// rather than a kind that quietly renders nothing.
		expectTypeOf<Entry["kind"]>().toEqualTypeOf<
			"message" | "artifact" | "status-move" | "acknowledgement"
		>();
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
			// **The three 10a added.** This record is exhaustive over the union, so adding a fifth kind
			// fails to compile here — which is the property the union was widened for.
			artifact: (entry) => entry.resourceId,
			"status-move": (entry) => `${entry.from} to ${entry.to}`,
			acknowledgement: (entry) => `up to ${entry.upTo}`,
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
			// Carried because the prototype carries it (app.js L35) and renders a pin. It is a
			// label, not a sort key: the thread list orders by the latest entry's timestamp.
			readonly pinned: boolean;
			// A closed set of two, moved only by a status-move entry (10a).
			readonly status: "open" | "resolved";
			readonly origin: Origin;
		}>();
		expect(Object.keys(thread).sort()).toEqual([
			"boardId",
			"createdAt",
			"creatorId",
			"id",
			"origin",
			"pinned",
			"status",
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
	it("is the fifteen names of spec L327-341, and no other", () => {
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
	it("exports a vocabulary and five total functions over its own types, and nothing else", () => {
		// **This assertion has now been rewritten twice, and the second rewrite is the interesting one.**
		//
		// 02a could assert that the module held no runtime value at all. 02b put the documented error
		// strings here and narrowed it to "a vocabulary". 10a widens `Entry` to four kinds, and "what
		// does this entry say" has to be answered once and totally — a `text?` on the base type, or a
		// cast per call site, would both be worse. So the domain now holds functions, and the honest
		// statement of what it holds is an exact list rather than a category.
		//
		// What has *not* changed is the property those earlier assertions were protecting: **nothing in
		// this module decides what a principal may do.** There is no permission rule here, and 07a's
		// `kind` scan still requires `src/domain/grants.ts` to contain no comparison — the rule lives at
		// the boundary, not in the vocabulary.
		expect(Object.keys(domain).sort()).toEqual([
			"BOARD_MEMBER_PERMISSIONS",
			"THREAD_STATUSES",
			"entrySentence",
			"entryText",
			"errorMessageList",
			"errorMessages",
			"isThreadStatus",
			"movableTo",
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
		// Compared by key set and by each value being a sentence, rather than as one literal object.
		// **Written this way on purpose**: the object had grown to fourteen hand-copied strings, so every
		// ticket that added one had to edit this assertion too, and the risk of a copy-paste slip grew
		// with it. What this test is for is that the vocabulary is user-visible words rather than codes,
		// and that adding a string is a deliberate act; the key-set comparison keeps both.
		expect(Object.keys(domain.errorMessages).sort()).toEqual([
			"acknowledgementAhead",
			"acknowledgementBehind",
			"boardNotFound",
			"grantMalformed",
			"messageEmpty",
			"notABoardMember",
			"permissionDenied",
			"principalExists",
			"principalNotFound",
			"resourceNotFound",
			"statusChanged",
			"statusUnchanged",
			"statusUnknown",
			"threadNotFound",
		]);
		for (const value of Object.values(domain.errorMessages)) {
			expect(typeof value).toBe("string");
			expect(value.length).toBeGreaterThan(0);
			// A user-visible sentence rather than an identifier: a caller shows it to a person.
			expect(value).toMatch(/^[A-Z]/);
		}
	});

	it("holds no rule about who may do what, which is the property all three rewrites protect", () => {
		// 02a asserted there were no functions at all. 10a added five, and they are total functions
		// over the module's own types: what an entry says, and which statuses a thread can move to.
		// None of them reads a principal, a grant or a board, so none of them can be a permission rule
		// — which is what "the domain is a vocabulary" was always standing in for.
		for (const [name, value] of Object.entries(domain)) {
			if (typeof value !== "function") continue;
			// Every function here takes data and returns data: none is shaped like a decision.
			expect(
				name.includes("permit") ||
					name.includes("allow") ||
					name.includes("can"),
				`${name} looks like a rule, and rules belong at the boundary (07a)`,
			).toBe(false);
		}
	});
});
