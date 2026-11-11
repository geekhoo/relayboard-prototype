/**
 * The board route's search parameters, parsed and validated on the way in.
 *
 * The URL is the location (spec L540), so these four values are user-editable input: a
 * link can be pasted with anything in it. The parse is therefore **total** — every input
 * yields a renderable view, and an unknown value is normalised rather than refused — which
 * is what keeps a hand-edited URL from producing a broken screen (spec L544).
 *
 * Pure on purpose. It has no import of the router, the client or React, so it can be
 * tested in Node and so nothing here can start a request.
 */

/** The three board views, in the order the tabs render. */
export const BOARD_VIEWS = ["threads", "resources", "people"] as const;

export type BoardView = (typeof BOARD_VIEWS)[number];

/**
 * How long a search term may be.
 *
 * A link can carry a megabyte of query text, and neither the list filter nor the highlight
 * needs more than this. Truncating keeps the view renderable and keeps an absurd URL from
 * becoming a rendering problem.
 */
export const MAX_SEARCH_LENGTH = 100;

export interface BoardSearch {
	readonly view: BoardView;
	readonly q: string;
	readonly unread: boolean;
	/**
	 * The open thread, or `""` for none.
	 *
	 * In the **search**, not the path, because spec L545 makes the thread a second *level* of the
	 * same board route rather than a second route: at a narrow viewport the pane and the conversation
	 * are two levels of one address, and a thread as its own path would make the back control a
	 * route change instead of a UI affordance. Opening a thread is still a navigation — it changes
	 * the URL — which is 04b's criterion.
	 */
	readonly thread: string;
}

/** The view a reader sees when the URL says nothing, or says something unrecognisable. */
export const DEFAULT_BOARD_SEARCH: BoardSearch = {
	view: "threads",
	q: "",
	unread: false,
	thread: "",
};

const isBoardView = (value: unknown): value is BoardView =>
	typeof value === "string" &&
	(BOARD_VIEWS as readonly string[]).includes(value);

/**
 * One parameter, as a string, or `undefined`.
 *
 * A repeated parameter arrives as an array; the first is taken because any other choice
 * depends on the order a browser happened to serialise them in.
 */
const text = (value: unknown): string | undefined => {
	if (typeof value === "string") return value;
	if (Array.isArray(value)) return text(value[0]);
	return undefined;
};

/**
 * Yes or no, from the spellings a real address bar produces.
 *
 * `true` and `false` are here for the router's own object form; `"1"`/`"0"` and
 * `"on"` are what links in the wild carry. Everything else — including `"yes"`, a
 * number, an object or nothing at all — is off, because a filter that is on by accident
 * hides work.
 */
const flag = (value: unknown): boolean => {
	if (value === true) return true;
	if (Array.isArray(value)) return flag(value[0]);
	const asText = text(value);
	return asText === "true" || asText === "1" || asText === "on";
};

/**
 * The board route's search, from whatever the URL held.
 *
 * Returns a fresh object holding only the three known parameters, so nothing an unknown
 * parameter carried can reach the view as a second, unvalidated state channel.
 */
export const parseBoardSearch = (
	raw: Record<string, unknown> | undefined,
): BoardSearch => {
	const source = raw ?? {};
	const view = source.view;
	const q = text(source.q);
	const thread = text(source.thread);
	return {
		view: isBoardView(view) ? view : DEFAULT_BOARD_SEARCH.view,
		q: (q ?? "").trim().slice(0, MAX_SEARCH_LENGTH),
		unread: flag(source.unread),
		// A thread id is a short opaque string; anything longer than a search term is not one, and
		// truncating an id would silently address a thread that does not exist.
		thread: (thread ?? "").trim().slice(0, MAX_SEARCH_LENGTH),
	};
};
