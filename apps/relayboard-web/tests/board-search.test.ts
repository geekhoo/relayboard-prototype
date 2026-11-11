import { describe, expect, it } from "vitest";
import {
	BOARD_VIEWS,
	DEFAULT_BOARD_SEARCH,
	MAX_SEARCH_LENGTH,
	parseBoardSearch,
} from "#/routes/-board-search";

/**
 * The board route's search parameters, asserted as a pure function.
 *
 * These four parameters are the app's first user-editable input that is not a form: a
 * link can be pasted with anything in it, so the parse has to be total — every input
 * yields a renderable view rather than throwing. Testing it here, without a DOM, is what
 * makes "a hand-edited URL cannot break rendering" a checked claim rather than an
 * intention; the browser assertion that the page really renders arrives with 04c.
 */

describe("the board route's search parameters", () => {
	it("defaults to the threads view, no search, and no unread filter", () => {
		expect(parseBoardSearch({})).toEqual(DEFAULT_BOARD_SEARCH);
		expect(DEFAULT_BOARD_SEARCH).toEqual({
			view: "threads",
			q: "",
			unread: false,
			thread: "",
		});
	});

	it("accepts the three documented views and normalises any other value to threads", () => {
		expect(BOARD_VIEWS).toEqual(["threads", "resources", "people"]);
		for (const view of BOARD_VIEWS) {
			expect(parseBoardSearch({ view }).view).toBe(view);
		}
		// A stale or hand-edited value is a normalisation, not a crash and not an empty
		// screen: the reader lands on the view that always has something to say.
		for (const view of ["", "thread", "THREADS", "admin", "0", "1"]) {
			expect(parseBoardSearch({ view }).view).toBe("threads");
		}
	});

	it("accepts only the values a filter can mean, and treats everything else as off", () => {
		// The four spellings a real link uses. `true`/false are for the router's own
		// object form; the strings are what appears in an address bar.
		for (const on of [true, "true", "1", "on"]) {
			expect(parseBoardSearch({ unread: on }).unread).toBe(true);
		}
		for (const off of [
			false,
			"false",
			"0",
			"",
			"yes",
			"TRUE ",
			1,
			null,
			undefined,
		]) {
			expect(parseBoardSearch({ unread: off }).unread).toBe(false);
		}
	});

	it("keeps search text, trimmed, and refuses to accept an absurd one", () => {
		expect(parseBoardSearch({ q: "  replay  " }).q).toBe("replay");
		// An absurdly long query is truncated rather than refused: the reader asked for a
		// search, so the view comes back with the search it can actually run.
		const absurd = "x".repeat(MAX_SEARCH_LENGTH + 500);
		expect(parseBoardSearch({ q: absurd }).q).toHaveLength(MAX_SEARCH_LENGTH);
		// A repeated parameter arrives as an array. Taking the first is the only choice that
		// cannot depend on the order a browser serialised them in.
		expect(parseBoardSearch({ q: ["first", "second"] }).q).toBe("first");
		// Anything that is not text is no search at all rather than `"[object Object]"`.
		for (const q of [null, undefined, 42, {}, [], true]) {
			expect(parseBoardSearch({ q }).q).toBe("");
		}
	});

	it("is total: no input to it can throw", () => {
		// Every one of these can arrive from a pasted link. The assertion is that the
		// function returns rather than that it returns something particular.
		const inputs: unknown[] = [
			{},
			{ view: null, q: null, unread: null },
			{ view: {}, q: {}, unread: {} },
			{ view: [], q: [], unread: [] },
			{ view: 1, q: 1, unread: 1 },
			{ view: [1, 2], q: [{}, {}], unread: [true, false] },
			{ extra: "ignored" },
		];
		for (const input of inputs) {
			const parsed = parseBoardSearch(input as Record<string, unknown>);
			expect(BOARD_VIEWS).toContain(parsed.view);
			expect(typeof parsed.q).toBe("string");
			expect(typeof parsed.unread).toBe("boolean");
		}
	});

	it("carries the open thread, so a deep link restores which conversation is open", () => {
		// The thread is a search parameter rather than a path segment (spec L545: the pane and the
		// conversation are two levels of ONE address), so opening a thread is a navigation that
		// changes the search rather than a second route.
		expect(parseBoardSearch({ thread: "delivery" }).thread).toBe("delivery");
		expect(parseBoardSearch({}).thread).toBe("");
		// It survives a hand-edited value without crashing, like every other parameter.
		for (const raw of [null, 42, {}, [], true]) {
			expect(typeof parseBoardSearch({ thread: raw }).thread).toBe("string");
		}
		// A repeated parameter takes the first, matching the rule for `q`.
		expect(parseBoardSearch({ thread: ["delivery", "identity"] }).thread).toBe(
			"delivery",
		);
	});

	it("keeps only the parameters it knows, so a URL cannot smuggle state into the view", () => {
		// The parsed object is what the component receives, so an unknown parameter must not
		// survive into it: a second data source read off the URL would be a state channel
		// nothing validates.
		expect(parseBoardSearch({ view: "people", admin: "true" })).toEqual({
			view: "people",
			q: "",
			unread: false,
			thread: "",
		});
	});
});
