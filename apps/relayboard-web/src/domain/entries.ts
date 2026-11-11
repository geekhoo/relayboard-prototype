/**
 * Reading an entry of any kind as a line of text.
 *
 * Since 10a an entry is a union of four kinds, and two callers want a *string* out of one: the thread
 * search, and the thread row's one-line excerpt. Both used to read `entry.text` because every entry
 * was a message; keeping that would mean either a cast at each call site or, worse, a `text?` on the
 * base type that every kind would have to pretend to have.
 *
 * So the fact "what does this entry say" lives here once, as a total function over the union. A new
 * kind makes this file fail to compile rather than silently rendering nothing — which is the
 * difference between adding a member and forgetting to handle it.
 */
import type { Entry, PrincipalId, ResourceId, ThreadStatus } from "./types";

/**
 * What an entry says, as prose a reader or a search can use.
 *
 * The three acts get a sentence rather than a fragment, because they are *events* and the sentence is
 * how an event reads in a list: `alex moved the status from open to resolved` is the entry's meaning,
 * and a caller that only wanted the words for a search does not have to know that.
 *
 * *The resource name is not resolvable from an entry* — an artifact holds an id and nothing else, by
 * design (a copy would be the thing 09 forbids) — so an artifact's line names the resource by id and
 * the rendering layer, which holds the board's resources, substitutes the name. Keeping the
 * substitution out of the domain is what keeps the domain free of a read it cannot perform.
 */
export const entryText = (entry: Entry): string => {
	switch (entry.kind) {
		case "message":
			return entry.text;
		case "artifact":
			return `attached the resource ${entry.resourceId}`;
		case "status-move":
			return `moved the status from ${entry.from} to ${entry.to}`;
		case "acknowledgement":
			return `acknowledged up to #${entry.upTo}`;
	}
};

/**
 * What an entry says, with the names a reader needs filled in.
 *
 * The caller supplies the two lookups because both are reads the domain cannot do: a principal's name
 * and a resource's name live in the store and on a board. Passing them in keeps this a pure function
 * and keeps every call site honest about the data it has — a component that has the board's resources
 * passes them, an excerpt that does not names the id.
 */
export const entrySentence = (
	entry: Entry,
	lookups: {
		readonly nameOf: (principalId: PrincipalId) => string;
		readonly resourceNameOf?: (resourceId: ResourceId) => string;
	},
): string => {
	const who = lookups.nameOf(entry.authorId);
	switch (entry.kind) {
		case "message":
			return entry.text;
		case "artifact": {
			const name =
				lookups.resourceNameOf?.(entry.resourceId) ?? entry.resourceId;
			return `${who} attached the resource ${name}`;
		}
		case "status-move":
			return `${who} moved the status from ${entry.from} to ${entry.to}`;
		case "acknowledgement":
			return `${who} acknowledged up to #${entry.upTo}`;
	}
};

/**
 * Which statuses a thread can move to, from where it is.
 *
 * The complement of the closed set, computed rather than listed: a move to the status a thread is
 * already in is not a move, and offering it would produce an entry that records nothing. Written as a
 * function of the set so widening `ThreadStatus` cannot leave a hand-maintained list behind.
 */
export const movableTo = (from: ThreadStatus): readonly ThreadStatus[] =>
	from === "open" ? ["resolved"] : ["open"];

/**
 * Whether a value is a status a thread can be in.
 *
 * The boundary's guard for a closed set that arrives as a string from the wire. It lives beside
 * `movableTo` so that widening the set means changing one union and one array in the same file — the
 * store asks this rather than comparing against a literal, which is what would make a fifth status a
 * silent runtime hole.
 */
export const isThreadStatus = (value: string): value is ThreadStatus =>
	value === "open" || value === "resolved";

/** Every status a thread can be in, in the order the interface offers them. */
export const THREAD_STATUSES = [
	"open",
	"resolved",
] as const satisfies readonly ThreadStatus[];
