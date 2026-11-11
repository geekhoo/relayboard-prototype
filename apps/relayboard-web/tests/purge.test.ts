import { describe, expect, it } from "vitest";
import { BOARD_MEMBER_PERMISSIONS } from "#/domain";
import { createStore } from "#/server/store";
import { demoOptions, demoSeed } from "#/server/store/demo-seed";

/**
 * A purge removes demo-origin records and nothing else.
 *
 * Every assertion here is about the **boundary** between what the workspace seeded and what the reader
 * made, because that boundary is the whole ticket: a purge that took the reader's work would be worse
 * than no purge at all, and a purge that left demo content behind would be a promise not kept.
 */
const seeded = () => createStore(demoSeed(), demoOptions());

describe("the purge's impact", () => {
	it("names the demo records and nothing about the reader's", () => {
		const store = seeded();
		const impact = store.purgeImpact();

		expect(impact.boards).toBeGreaterThan(0);
		expect(impact.threads).toBeGreaterThan(0);
		expect(impact.entries).toBeGreaterThan(0);
		expect(impact.resources).toBeGreaterThan(0);
		// Nothing of the reader's has been made yet, so the overlap is zero — and **zero is reported**, not
		// omitted: the confirmation says "0 of your entries" rather than dropping the line.
		expect(impact.ownEntriesOnDemoBoards).toBe(0);
	});

	it("counts the reader's own entries on demo boards, which is the overlap 14:14 names", () => {
		const store = seeded();
		// A browser-selectable principal — the reader — posting on a demo board.
		store.appendMessage({
			threadId: "delivery",
			authorId: "alex",
			text: "Mine, on a demo thread.",
		});

		const impact = store.purgeImpact();
		expect(impact.ownEntriesOnDemoBoards).toBeGreaterThan(0);
	});
});

describe("a purge", () => {
	it("removes every demo record", () => {
		const store = seeded();
		const before = store.purgeImpact();
		const impact = store.purgeDemoContent();

		expect(impact).toEqual(before);
		expect(store.purgeImpact()).toEqual({
			boards: 0,
			threads: 0,
			entries: 0,
			resources: 0,
			ownEntriesOnDemoBoards: 0,
		});
	});

	it("leaves the reader's own boards, threads, entries and resources", () => {
		const store = seeded();
		const board = store.createBoard({
			creatorId: "alex",
			name: "My board",
			description: "Mine",
		});
		const thread = store.createThread({
			boardId: board.id,
			title: "My thread",
			creatorId: "alex",
		});
		// A thread on the created board, rather than an entry: see the `todo` below — the creator holds
		// no grant on a board they made, so an entry there is refused by the store today.
		const resource = store.addResource({
			boardId: board.id,
			name: "My resource",
			url: "https://example.com/mine",
			type: "Link",
			description: "",
		});

		store.purgeDemoContent();

		// Everything the reader made survives, with its record intact.
		expect(store.readBoard(board.id)?.name).toBe("My board");
		expect(store.readThread(thread.id)?.title).toBe("My thread");
		expect(store.listResources(board.id).map((r) => r.id)).toEqual([
			resource.id,
		]);
		// The thread the reader made on their own board is still there, with its chronology.
		//
		// **Written this way because of the createBoard defect recorded below**, not by preference: an
		// entry would be the stronger assertion, and it cannot be written until a created board's creator
		// holds a grant on it. The `todo` records that, so this weaker assertion is a marker rather than a
		// judgement about what a purge should preserve.
		expect(
			store.listThreads(board.id).map((candidate) => candidate.id),
		).toEqual([thread.id]);
		expect(store.readEntries(thread.id)).toEqual([]);
	});

	it("leaves every principal, grant and watermark exactly as it was", () => {
		// 14:13 and 14:19: a purge must not log the reader out or strip access. The demo content is not
		// load-bearing for identity, and this is the assertion that says so.
		const store = seeded();
		const before = store.readPrincipal("alex");
		const grantsBefore = store.grantsFor("alex", "platform");
		const workspaceBefore = store.grantsFor("alex");

		store.purgeDemoContent();

		expect(store.readPrincipal("alex")).toEqual(before);
		expect(store.grantsFor("alex", "platform")).toEqual(grantsBefore);
		expect(store.grantsFor("alex")).toEqual(workspaceBefore);
	});

	it("keeps a board the reader created, even with demo-following activity on it", () => {
		// 14:15. The board is the reader's; what happened on it does not change whose it is.
		const store = seeded();
		const board = store.createBoard({ creatorId: "alex", name: "Mine" });
		store.createThread({
			boardId: board.id,
			title: "Mine too",
			creatorId: "alex",
		});
		// Activity on the reader's own board — a second thread, which is "demo-following activity" in the
		// sense 14:15 means: something the purge must not treat as a reason to remove the board.
		store.createThread({
			boardId: board.id,
			title: "Somebody else's thread here",
			creatorId: "maya",
		});

		store.purgeDemoContent();

		expect(store.readBoard(board.id)).toBeDefined();
		expect(store.listThreads(board.id)).toHaveLength(2);
	});
});

describe("restore", () => {
	it("brings the demo content back without duplicating what survived", () => {
		const store = seeded();
		const board = store.createBoard({ creatorId: "alex", name: "Mine" });
		const seededBefore = store.purgeImpact();

		store.purgeDemoContent();
		const restored = store.restoreDemoContent();

		expect(restored.restored).toBeGreaterThan(0);
		// The same demo content as before, and the reader's board untouched.
		expect(store.purgeImpact()).toEqual(seededBefore);
		expect(store.readBoard(board.id)).toBeDefined();
	});

	it("is idempotent: a second restore adds nothing", () => {
		const store = seeded();
		store.purgeDemoContent();
		store.restoreDemoContent();
		const second = store.restoreDemoContent();

		// **Zero restored**, because nothing is missing: an id that survived is left alone, so restore
		// cannot produce two copies of the same demo board.
		expect(second.restored).toBe(0);
	});
});

/**
 * **The defect this ticket found, and the fix it now asserts.**
 *
 * `createBoard` used to append the board and grant nothing, and a grant *is* the membership — so the
 * creator of a board held no permission on it. They could create a thread there and could not write in it,
 * because `appendMessage` asks `post:message` against the new board and nobody held it.
 *
 * 09:14 says a new board "opens immediately with an empty state that says what to do next"; what it did not
 * say, and what was true, is that the reader then could not do it. The prototype makes its creator a member
 * at `app.js` L116 (`members: ['alex', 'maya', 'orion', 'beacon']`); this app encodes that as the board
 * member grant, for the creator only.
 *
 * The sequence below is the one that failed: create a board, create a thread in it, post.
 */
describe("a board the reader created", () => {
	it("is one the reader can post to, because creating a board and using it is one act", () => {
		const store = seeded();
		const board = store.createBoard({ creatorId: "alex", name: "Mine" });

		// The creator is the board's first member, and membership is the grant.
		expect(store.grantsFor("alex", board.id)).toEqual([
			...BOARD_MEMBER_PERMISSIONS,
		]);

		const thread = store.createThread({
			boardId: board.id,
			creatorId: "alex",
			title: "Mine too",
		});
		// **The sequence that was broken**: a thread on the new board, and a post into it.
		const posted = store.appendMessage({
			threadId: thread.id,
			authorId: "alex",
			text: "Posting on the board I just made.",
		});
		// Narrowed through the union rather than cast: since 10a an entry may be any of four kinds.
		expect(posted.kind === "message" ? posted.text : null).toBe(
			"Posting on the board I just made.",
		);
	});

	it("grants the creator only, unlike the prototype's everybody-is-in-every-room demo", () => {
		// The prototype adds four principals to every board it makes (app.js L116). That is a one-browser
		// demo simplification, and a real workspace should not silently add participants to a board somebody
		// else made — so the difference is asserted rather than left to be discovered.
		const store = seeded();
		const board = store.createBoard({ creatorId: "alex", name: "Mine" });

		expect(store.listMembers(board.id).map((member) => member.id)).toEqual([
			"alex",
		]);
	});
});
