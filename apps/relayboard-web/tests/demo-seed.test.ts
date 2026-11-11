import { describe, expect, it } from "vitest";
import type { Principal } from "#/domain";
import { createStore } from "#/server/store";
import {
	demoBoardMembers,
	demoGrants,
	demoOptions,
	demoSeed,
	demoWatermarks,
} from "#/server/store/demo-seed";
import { describeStoreRules } from "./store-contract";

/**
 * The demo seed, asserted twice over: that it reproduces the prototype's workspace,
 * and that 02b's rules still hold once the store is full of content.
 *
 * The counts and strings here are transcribed from `app.js` (the line numbers are in
 * the seed module) and from the prototype's own rendered output, so they are an
 * independent source of truth rather than a re-run of the seed's arithmetic: a seed
 * that deleted an entry would fail these numbers even if it were self-consistent.
 */

const store = () => createStore(demoSeed(), demoOptions());

describe("the demo workspace", () => {
	it("has the prototype's seven principals, with four humans and three agents", () => {
		const seed = demoSeed();
		// The prototype's own cast (app.js L21-27) is exactly the demo-origin principals:
		// the seed's eighth principal is the superadmin, who is `origin: "owner"` and is
		// asserted on its own below.
		const demoOrigin = seed.principals.filter(
			(principal) => principal.origin === "demo",
		);

		expect(demoOrigin.map((principal) => principal.id)).toEqual([
			"alex",
			"maya",
			"daniel",
			"sara",
			"orion",
			"beacon",
			"quill",
		]);
		expect(
			demoOrigin.filter((principal) => principal.kind === "human"),
		).toHaveLength(4);
		expect(
			demoOrigin
				.filter((principal) => principal.kind === "agent")
				.map((principal) => principal.name),
		).toEqual(["Orion", "Beacon", "Quill"]);
		// The prototype's order, which is the order a participant list walks.
		expect(demoOrigin.map((principal) => principal.name)).toEqual([
			"Alex Morgan",
			"Maya Chen",
			"Daniel Kim",
			"Sara Reed",
			"Orion",
			"Beacon",
			"Quill",
		]);
	});

	it("keeps each principal's declared description, and marks it declared", () => {
		const seed = demoSeed();
		const of = (id: string) =>
			seed.principals.find((principal) => principal.id === id);

		// The description is what the principal says about itself (app.js L21-27), not
		// something the workspace derived; 12 renders it labelled as declared.
		expect(of("maya")?.description).toBe("Engineering lead");
		expect(of("orion")?.description).toBe(
			"Research agent · independent runtime",
		);
		expect(of("orion")?.kind).toBe("agent");
	});

	it("includes the seeded superadmin as a human of owner origin", () => {
		const seed = demoSeed();
		const owners = seed.principals.filter(
			(principal) => principal.origin === "owner",
		);

		// Exactly one owner principal: the out-of-band provisioning of spec L429. It is
		// a human like any other, and its grant is 07a's to add.
		expect(owners).toHaveLength(1);
		expect(owners[0]?.kind).toBe("human");
		// 07a must keep this id, so it is asserted as a literal.
		expect(owners[0]?.id).toBe("nadia");
		// Demo content and provisioning are the two origins, and neither is a permission:
		// the superadmin is a human that cannot yet post anywhere, and the demo agents
		// are ordinary participants.
		expect(
			seed.principals.filter((principal) => principal.origin === "demo"),
		).toHaveLength(7);
	});

	it("marks alex then maya browser-selectable, in that order and nobody else", () => {
		const seed = demoSeed();
		const selectable = seed.principals
			.filter((principal) => principal.browserSelectable)
			.map((principal) => principal.id);

		// spec L368, L370: the session round-robin walks the principals the seed marks.
		// The order is the list's order, which is what makes "the first browser is alex"
		// a fact rather than a coin flip.
		expect(selectable).toEqual(["alex", "maya"]);
	});

	it("has the prototype's three boards, each with its mark and hue", () => {
		const seed = demoSeed();

		// app.js L30-32: the monogram and one of the four hues DESIGN.md §241 documents.
		expect(
			seed.boards.map((board) => [board.id, board.short, board.theme]),
		).toEqual([
			["platform", "P", "sage"],
			["campaign", "C", "ochre"],
			["design", "D", "lavender"],
		]);
		expect(seed.boards[0]?.name).toBe("Platform workspace");
		expect(seed.boards[0]?.description).toBe(
			"Engineering discussions, architecture, and shared decisions.",
		);
	});

	it("has the prototype's ten threads, each on its own board", () => {
		const seed = demoSeed();

		expect(seed.threads.map((thread) => thread.id)).toEqual([
			"delivery",
			"identity",
			"read-replay",
			"retention",
			"api",
			"launch",
			"assets",
			"review",
			"components",
			"accessibility",
		]);
		expect(
			seed.threads.map((thread) => [thread.boardId, thread.creatorId]),
		).toEqual([
			["platform", "maya"],
			["platform", "alex"],
			["platform", "daniel"],
			["platform", "maya"],
			["platform", "daniel"],
			["campaign", "sara"],
			["campaign", "sara"],
			["campaign", "alex"],
			["design", "alex"],
			["design", "maya"],
		]);
	});

	it("has the prototype's seven resources, on the right boards", () => {
		const seed = demoSeed();

		expect(seed.resources.map((resource) => resource.id)).toEqual([
			"res-1",
			"res-2",
			"res-3",
			"res-4",
			"res-5",
			"res-6",
			"res-7",
		]);
		expect(
			seed.resources.filter((resource) => resource.boardId === "platform"),
		).toHaveLength(3);
		expect(
			seed.resources.filter((resource) => resource.boardId === "campaign"),
		).toHaveLength(2);
		expect(
			seed.resources.filter((resource) => resource.boardId === "design"),
		).toHaveLength(2);
		// A resource's content lives at its url and nowhere else.
		expect(seed.resources[0]).toMatchObject({
			id: "res-1",
			url: "https://microservices.io/patterns/data/transactional-outbox.html",
			type: "Document",
		});
	});

	it("has the prototype's entries, with their counts, references and one relation", () => {
		const seeded = store();
		// app.js L52-82: 31 messages, 9 of them in `delivery`.
		const counts = Object.fromEntries(
			demoSeed().threads.map((thread) => [
				thread.id,
				seeded.readEntries(thread.id).length,
			]),
		);

		expect(counts).toEqual({
			delivery: 9,
			identity: 3,
			"read-replay": 3,
			retention: 2,
			api: 2,
			launch: 3,
			assets: 2,
			review: 2,
			components: 3,
			accessibility: 2,
		});
		expect(
			Object.values(counts).reduce((total, count) => total + count, 0),
		).toBe(31);

		// The resource chips of app.js L53, L60, L74 and L81.
		const withReferences = Object.values(demoSeed().entries)
			.flat()
			.flatMap((entry) =>
				entry.kind === "message" && entry.references.length > 0
					? [entry.references]
					: [],
			);
		expect(withReferences).toEqual([
			[{ resourceId: "res-1" }],
			[{ resourceId: "res-2" }],
			[{ resourceId: "res-5" }],
			[{ resourceId: "res-6" }],
		]);

		// The one relation, at app.js L57: a correction pointing at entry 5.
		const related = Object.values(demoSeed().entries)
			.flat()
			.filter((entry) => entry.relation);
		expect(related.map((entry) => entry.relation)).toEqual([
			{ type: "In response to", entryId: "seed-delivery-5" },
		]);
	});
});

describe("the demo seed as input", () => {
	it("is passed to the factory, not baked in: no seed is still an empty workspace", () => {
		const empty = createStore();

		expect(empty.listBoards()).toEqual([]);
		expect(empty.readPrincipal("alex")).toBeUndefined();
		expect(store().listBoards()).toHaveLength(3);
	});

	it("is pure: two calls return equal but distinct copies", () => {
		const one = demoSeed();
		const two = demoSeed();

		expect(two).toEqual(one);
		expect(two).not.toBe(one);
		expect(two.principals).not.toBe(one.principals);
		expect(two.entries.delivery).not.toBe(one.entries.delivery);
		// Mutating one seed's arrays cannot reach the other, nor the constant data behind
		// either of them.
		(two.principals as Principal[]).pop();
		expect(one.principals).toHaveLength(8);
		expect(demoSeed().principals).toHaveLength(8);
	});

	it("gives two stores built from it no state to share", () => {
		const seed = demoSeed();
		const one = createStore(seed, demoOptions());
		const two = createStore(seed, demoOptions());

		one.appendMessage({
			threadId: "delivery",
			authorId: "alex",
			text: "Posted in the first store only.",
		});

		expect(one.readEntries("delivery")).toHaveLength(10);
		expect(two.readEntries("delivery")).toHaveLength(9);
	});

	it("reproduces the prototype's board.members permutation as grants", () => {
		// 07a's criterion: a principal that could act in the prototype can act here, and one that
		// could not still cannot. Asserted from the GRANTS rather than from a member list, because the
		// member list is gone — which is the point of the ticket.
		for (const [boardId, members] of Object.entries(demoBoardMembers)) {
			const onBoard = demoGrants
				.filter((grant) => grant.scope === "board" && grant.boardId === boardId)
				// **The gate grant is not a membership.** Since 08a the demo's gate holder (Alex) holds
				// `admit:agent` on platform, which is a second, narrower grant at the same scope. Counting
				// it as membership would make this assertion about "the permutation" quietly assert
				// something else, so the member grant is identified by its permission set.
				.filter((grant) => grant.permissions.length > 1)
				.map((grant) => grant.principalId);
			expect(onBoard.sort()).toEqual([...members].sort());
		}
		// Nobody holds a board grant on a board the prototype did not put them on.
		const boards = Object.keys(demoBoardMembers);
		for (const grant of demoGrants) {
			if (grant.scope !== "board") continue;
			expect(boards).toContain(grant.boardId);
			expect(demoBoardMembers[grant.boardId as string]).toContain(
				grant.principalId,
			);
		}
	});

	it("gives the superadmin the workspace row and nothing more", () => {
		// Spec L429 and stories 81-85: the workspace row is five names, and a superadmin that could
		// POST to a board it holds no board grant on would be the inference the spec forbids.
		const workspace = demoGrants.filter((grant) => grant.scope === "workspace");
		expect(workspace).toHaveLength(1);
		expect(workspace[0]?.principalId).toBe("nadia");
		expect([...(workspace[0]?.permissions ?? [])].sort()).toEqual([
			"admit:agent",
			"create:board",
			"grant:permission",
			"read:board",
			"revoke:agent",
		]);
	});

	it("puts origin: demo on every board, thread, entry and resource", () => {
		const seed = demoSeed();

		expect(seed.boards.every((board) => board.origin === "demo")).toBe(true);
		expect(seed.threads.every((thread) => thread.origin === "demo")).toBe(true);
		expect(seed.resources.every((resource) => resource.origin === "demo")).toBe(
			true,
		);
		expect(
			Object.values(seed.entries)
				.flat()
				.every((entry) => entry.origin === "demo"),
		).toBe(true);
	});

	it("starts every thread at 1 and leaves it gapless", () => {
		const seeded = store();

		for (const thread of demoSeed().threads) {
			const sequences = seeded.readEntries(thread.id).map((entry) => entry.seq);
			expect(sequences, `${thread.id} should be 1..n`).toEqual(
				sequences.map((_, index) => index + 1),
			);
		}
	});
});

describe("the seed's timestamps", () => {
	it("run against seq in at least one thread, so a timestamp sort is visibly wrong", () => {
		const seeded = store();
		const outOfOrder = demoSeed().threads.filter((thread) => {
			const entries = seeded.readEntries(thread.id);
			return entries.some((entry, index) => {
				const previous = entries[index - 1];
				return previous !== undefined && entry.createdAt < previous.createdAt;
			});
		});

		// Asserted on the store's own output, not on the seed's data: what matters is that
		// a reader who sorted by `createdAt` would get a different order from the one the
		// store hands out.
		expect(outOfOrder.map((thread) => thread.id)).toContain("retention");
		const retention = seeded.readEntries("retention");
		expect(retention.map((entry) => entry.seq)).toEqual([1, 2]);
		expect(
			retention[0]?.createdAt.localeCompare(retention[1]?.createdAt ?? ""),
		).toBe(1);
	});

	it("are fixed instants, so two runs of the seed are the same data", () => {
		// The prototype measured from `Date.now()`; the seed measures from a fixed base so
		// the demo workspace is reproducible and a test can assert a literal.
		expect(demoSeed()).toEqual(demoSeed());
		expect(demoSeed().threads[0]?.createdAt).toBe(
			store().readThread("delivery")?.createdAt,
		);
		expect(demoSeed().threads[0]?.createdAt).toMatch(
			/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
		);
	});
});

describe("the prototype's board members", () => {
	it("are carried as the provisional predicate, in the prototype's own order", () => {
		// app.js L30-32, verbatim: the permutation 07a reproduces as grants. Order is
		// part of the record, because it is the order the participant list walks.
		expect(demoBoardMembers).toEqual({
			platform: ["alex", "maya", "daniel", "orion", "beacon"],
			campaign: ["alex", "sara", "maya", "quill"],
			design: ["alex", "maya", "sara", "beacon", "quill"],
		});
	});

	it("is what the store consults for the not-a-member check", () => {
		const seeded = store();

		// Sara is on campaign and design but not on platform (app.js L30), so the same
		// principal is refused on one board and accepted on another.
		expect(() =>
			seeded.appendMessage({
				threadId: "delivery",
				authorId: "sara",
				text: "Not a platform member.",
			}),
		).toThrow("This participant is not a board member");
		expect(
			seeded.appendMessage({
				threadId: "launch",
				authorId: "sara",
				text: "A campaign member speaking on campaign.",
			}).seq,
		).toBe(4);
	});

	it("is not seeded as a member list on any board or thread", () => {
		const seed = demoSeed();

		// The model has no member list: a principal is on a board by holding a grant
		// there (07a). A `members` field in the seed would be the list that ticket has to
		// delete, so it is absent from the data and present only as the predicate above.
		for (const board of seed.boards)
			expect(Object.keys(board)).not.toContain("members");
		for (const thread of seed.threads)
			expect(Object.keys(thread)).not.toContain("members");
	});
});

describe("the seeded watermarks", () => {
	it("reproduce the prototype's unread badges for alex", () => {
		const seeded = store();
		const alex = (threadId: string) =>
			seeded
				.readPositions(threadId)
				.find((position) => position.principalId === "alex")?.watermarks;

		// app.js L83: seen = {delivery:7, identity:1, read-replay:2, retention:2, api:2,
		// launch:2, assets:2, review:2, components:2, accessibility:1}, and the stream's
		// cursor is each thread's message count.
		expect(alex("delivery")).toEqual({ cursor: 9, seen: 7, acknowledged: 0 });
		expect(alex("identity")).toEqual({ cursor: 3, seen: 1, acknowledged: 0 });
		expect(alex("accessibility")).toEqual({
			cursor: 2,
			seen: 1,
			acknowledged: 0,
		});
	});

	it("differ for maya, so a test can tell the two browsers apart", () => {
		const seeded = store();
		const of = (principalId: string, threadId: string) =>
			seeded
				.readPositions(threadId)
				.find((position) => position.principalId === principalId)?.watermarks;

		// The second selectable principal is one entry further along, so it is not simply
		// "everything unread" and not identical to the first browser either.
		expect(of("maya", "delivery")).toEqual({
			cursor: 9,
			seen: 8,
			acknowledged: 0,
		});
		expect(of("maya", "identity")?.seen).toBe(2);
		expect(of("maya", "delivery")?.seen).not.toBe(of("alex", "delivery")?.seen);
		// Both are in every thread's positions, because both watermarks exist for every
		// principal.
		expect(seeded.readPositions("delivery").map((p) => p.principalId)).toEqual([
			"alex",
			"maya",
			"daniel",
			"sara",
			"orion",
			"beacon",
			"quill",
			"nadia",
		]);
	});

	it("leave a principal the prototype says nothing about with everything delivered and nothing read", () => {
		const seeded = store();
		const orion = seeded
			.readPositions("delivery")
			.find((position) => position.principalId === "orion");

		expect(orion?.watermarks).toEqual({
			cursor: 9,
			seen: 0,
			acknowledged: 0,
		});
	});

	it("are what the seed exports, so the store is not second-guessing them", () => {
		const seeded = store();
		const positions = seeded.readPositions("delivery");

		expect(
			positions.find((position) => position.principalId === "alex")?.watermarks,
		).toEqual({ ...demoWatermarks.alex?.delivery, acknowledged: 0 });
	});
});

describeStoreRules({
	label: "the demo workspace",
	create: store,
	threadId: "delivery",
	otherThreadId: "identity",
	memberId: "alex",
	coMemberId: "maya",
	strangerId: "nadia",
});
