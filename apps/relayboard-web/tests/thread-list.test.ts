import { describe, expect, it } from "vitest";
import type { Entry, Thread } from "#/client";
import { entryText } from "#/domain";
import {
	emptyStateFor,
	filterThreads,
	orderThreads,
} from "#/routes/-thread-list";

/**
 * The thread list's three rules: the order, the filter, and which absence is being shown.
 *
 * The ordering rule is the delicate one. A thread has no `seq`, so "most recent activity first"
 * has to sort by a timestamp — and that is the ONLY timestamp ordering in the product. These tests
 * pin it as an across-thread rule and pin the in-thread rule (`seq`) separately, so a later change
 * cannot quietly make the first look like permission for the second.
 */

const thread = (
	id: string,
	createdAt: string,
	extra: { pinned?: boolean } = {},
): Thread => ({
	id,
	boardId: "platform",
	title: `Thread ${id}`,
	creatorId: "alex",
	createdAt,
	pinned: extra.pinned ?? false,
	status: "open",
	origin: "demo",
});

const entry = (
	threadId: string,
	seq: number,
	createdAt: string,
	text: string,
): Entry => ({
	id: `${threadId}-${seq}`,
	kind: "message",
	seq,
	authorId: "maya",
	createdAt,
	origin: "demo",
	text,
	references: [],
});

/** A board whose threads' own creation times run the OPPOSITE way to their last activity. */
const threads = [
	thread("older-created-newer-active", "2026-11-11T01:00:00.000Z"),
	thread("newer-created-older-active", "2026-11-11T09:00:00.000Z"),
	thread("quiet", "2026-11-11T05:00:00.000Z"),
];

const entries: Record<string, Entry[]> = {
	"older-created-newer-active": [
		entry("older-created-newer-active", 1, "2026-11-11T02:00:00.000Z", "first"),
		entry(
			"older-created-newer-active",
			2,
			"2026-11-11T12:00:00.000Z",
			"latest of all",
		),
	],
	"newer-created-older-active": [
		entry(
			"newer-created-older-active",
			1,
			"2026-11-11T09:30:00.000Z",
			"only one",
		),
	],
	quiet: [],
};
const entriesFor = (id: string) => entries[id] ?? [];
const noUnread = () => 0;

describe("the thread list's order", () => {
	it("puts the most recently active thread first, by its LATEST entry's timestamp", () => {
		const rows = orderThreads(threads, entriesFor, noUnread);

		// The thread created first but written in last comes first: the sort is about activity, not
		// about when the thread was started.
		expect(rows.map((row) => row.thread.id)).toEqual([
			"older-created-newer-active",
			"newer-created-older-active",
			"quiet",
		]);
	});

	it("falls back to the thread's own createdAt when nobody has written in it", () => {
		const rows = orderThreads(threads, entriesFor, noUnread);
		const quietRow = rows.find((row) => row.thread.id === "quiet");

		expect(quietRow?.latest).toBeUndefined();
		expect(quietRow?.entryCount).toBe(0);
		expect(quietRow?.lastAuthorId).toBeUndefined();
		// It still has a position — a thread with no entries is a thread, not a gap in the list.
		expect(rows).toHaveLength(3);
	});

	it("breaks ties by id, so the list does not reshuffle between two reads of the same data", () => {
		const tied = [
			thread("b-thread", "2026-11-11T05:00:00.000Z"),
			thread("a-thread", "2026-11-11T05:00:00.000Z"),
		];

		const once = orderThreads(tied, () => [], noUnread).map((r) => r.thread.id);
		const twice = orderThreads([...tied].reverse(), () => [], noUnread).map(
			(r) => r.thread.id,
		);

		expect(once).toEqual(["a-thread", "b-thread"]);
		// Reversing the input does not reverse the output: a row a reader was about to click cannot
		// move because the data arrived in a different order.
		expect(twice).toEqual(once);
	});

	it("does not order a thread's entries by timestamp — seq decides inside a thread", () => {
		// The one seeded thread whose timestamps run against its seq (02c's retention) proves the
		// distinction: the latest entry is the highest seq, whichever instant it carries.
		const outOfOrder: Entry[] = [
			entry(
				"retention",
				1,
				"2026-11-11T12:00:00.000Z",
				"seq 1 is the newer instant",
			),
			entry(
				"retention",
				2,
				"2026-11-11T09:00:00.000Z",
				"seq 2 is the older instant",
			),
		];
		const [row] = orderThreads(
			[thread("retention", "2026-11-11T08:00:00.000Z")],
			() => outOfOrder,
			noUnread,
		);

		expect(row?.latest?.seq).toBe(2);
		// Read through the domain helper rather than `.text`: since 10a an entry is a union, and the
		// row's excerpt is whatever the latest entry says, of whatever kind.
		expect(row?.latest ? entryText(row.latest) : null).toBe(
			"seq 2 is the older instant",
		);
	});
});

describe("the thread list's filter", () => {
	const rows = () =>
		orderThreads(threads, entriesFor, (id) => (id === "quiet" ? 3 : 0));

	it("keeps everything when there is no search and no unread filter", () => {
		expect(
			filterThreads(rows(), { query: "", unreadOnly: false }),
		).toHaveLength(3);
	});

	it("matches the title, case-insensitively", () => {
		const filtered = filterThreads(rows(), {
			query: "QUIET",
			unreadOnly: false,
		});

		expect(filtered.map((row) => row.thread.id)).toEqual(["quiet"]);
	});

	it("matches the latest entry's text, which is the text the row shows", () => {
		const filtered = filterThreads(rows(), {
			query: "latest of all",
			unreadOnly: false,
		});

		expect(filtered.map((row) => row.thread.id)).toEqual([
			"older-created-newer-active",
		]);
	});

	it("ignores text the row does not show, so a result always has a visible reason", () => {
		// "first" is an earlier entry in that thread and never appears in its row.
		expect(
			filterThreads(rows(), { query: "first", unreadOnly: false }),
		).toHaveLength(0);
	});

	it("narrows to threads the reader is behind on, from the watermark not a counter", () => {
		const filtered = filterThreads(rows(), { query: "", unreadOnly: true });

		expect(filtered.map((row) => row.thread.id)).toEqual(["quiet"]);
	});

	it("applies both at once", () => {
		expect(
			filterThreads(rows(), { query: "quiet", unreadOnly: true }),
		).toHaveLength(1);
		// A matching search does not rescue a thread that is read when the filter is on.
		expect(
			filterThreads(rows(), { query: "latest", unreadOnly: true }),
		).toHaveLength(0);
	});

	it("trims the search, so a space is not a search for nothing", () => {
		expect(
			filterThreads(rows(), { query: "   ", unreadOnly: false }),
		).toHaveLength(3);
	});
});

describe("which absence the list is showing", () => {
	const filter = { query: "", unreadOnly: false };

	it("says nothing when there are rows", () => {
		const rows = orderThreads(threads, entriesFor, noUnread);

		expect(emptyStateFor(rows, filter)).toBeNull();
	});

	it("distinguishes no search result from a caught-up reader from an empty board", () => {
		// Three absences with three different things to say. The prototype's copy for each
		// (app.js L142) is the source; one generic "nothing here" would tell a reader nothing about
		// which of the three they are looking at.
		expect(emptyStateFor([], { query: "zzz", unreadOnly: false })).toEqual({
			title: "No matching threads",
			detail: "Try a different search term.",
		});
		expect(emptyStateFor([], { query: "", unreadOnly: true })).toEqual({
			title: "All caught up",
			detail: "You have no unread messages here.",
		});
		expect(emptyStateFor([], { query: "", unreadOnly: false })).toEqual({
			title: "Start a conversation",
			detail: "Create the first thread in this board.",
		});
	});

	it("prefers the search message when a search is what emptied the list", () => {
		// Both filters on and nothing left: the search is the reason the reader can act on, so it
		// is the reason stated.
		expect(emptyStateFor([], { query: "zzz", unreadOnly: true })?.title).toBe(
			"No matching threads",
		);
	});
});
