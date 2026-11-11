import { describe, expect, it } from "vitest";
import type { PrincipalPosition, Thread } from "#/client";
import { boardUnreadCounts, unreadInThread } from "#/components/-unread";

/**
 * The unread badge's arithmetic, asserted on its own.
 *
 * The badge is the one number on the rail, and its rule is that it comes from `seen` and
 * nothing else (spec L500). That is cheap to get subtly wrong — the prototype subtracts its
 * own posts instead — so the rule is tested directly rather than through a rendered rail,
 * and 04c's browser assertion then checks the pixels.
 */

const position = (principalId: string, seen: number): PrincipalPosition => ({
	principalId,
	watermarks: { cursor: 9, seen, acknowledged: 0 },
});

const thread = (id: string, boardId: string): Thread => ({
	id,
	boardId,
	title: `Thread ${id}`,
	creatorId: "alex",
	createdAt: "2026-11-11T05:00:00.000Z",
	origin: "demo",
});

describe("a thread's unread count", () => {
	it("is everything past the seen watermark", () => {
		expect(unreadInThread(9, position("alex", 7))).toBe(2);
		expect(unreadInThread(9, position("alex", 9))).toBe(0);
		expect(unreadInThread(9, position("alex", 0))).toBe(9);
	});

	it("never goes negative, even if a watermark is ahead of the thread", () => {
		// A thread can shrink (a purge removes demo entries), and a count that went negative
		// would render as a badge reading "-2".
		expect(unreadInThread(2, position("alex", 9))).toBe(0);
	});

	it("is the whole thread for a principal with no position yet", () => {
		// No position is "has read nothing", not "is caught up": an absent watermark must not
		// read as a zero.
		expect(unreadInThread(9, undefined)).toBe(9);
		expect(unreadInThread(0, undefined)).toBe(0);
	});
});

describe("a board's unread count", () => {
	const boards = [{ id: "platform" }, { id: "campaign" }];
	const threads = [
		thread("delivery", "platform"),
		thread("identity", "platform"),
		thread("launch", "campaign"),
	];

	it("is the sum of its threads' unread counts", () => {
		const counts = boardUnreadCounts({
			boards,
			threads,
			entryCounts: { delivery: 9, identity: 3, launch: 3 },
			positionsByThread: {
				delivery: [position("alex", 7), position("maya", 9)],
				identity: [position("alex", 1), position("maya", 3)],
				launch: [position("alex", 3), position("maya", 0)],
			},
			principalId: "alex",
		});

		// platform: (9-7) + (3-1) = 4; campaign: (3-3) = 0.
		expect(counts).toEqual([
			{ boardId: "platform", unread: 4 },
			{ boardId: "campaign", unread: 0 },
		]);
	});

	it("counts the reader's own position, not anybody else's", () => {
		// Maya has read delivery to the end; Alex has not. The same workspace therefore shows
		// two different numbers, which is what makes the badge about the reader.
		const asMaya = boardUnreadCounts({
			boards,
			threads,
			entryCounts: { delivery: 9, identity: 3, launch: 3 },
			positionsByThread: {
				delivery: [position("alex", 7), position("maya", 9)],
				identity: [position("alex", 1), position("maya", 3)],
				launch: [position("alex", 3), position("maya", 0)],
			},
			principalId: "maya",
		});

		expect(asMaya).toEqual([
			{ boardId: "platform", unread: 0 },
			{ boardId: "campaign", unread: 3 },
		]);
	});

	it("gives a board with no threads a zero rather than omitting it", () => {
		const counts = boardUnreadCounts({
			boards: [{ id: "empty" }],
			threads: [],
			entryCounts: {},
			positionsByThread: {},
			principalId: "alex",
		});

		// A rail row has to render, so its count has to exist. Zero is the floor, not absence.
		expect(counts).toEqual([{ boardId: "empty", unread: 0 }]);
	});
});
