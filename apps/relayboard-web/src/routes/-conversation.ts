import type {
	Entry,
	PrincipalId,
	PrincipalSummary,
	Seq,
	Thread,
} from "#/client";
import { entryText, type Principal } from "#/domain";

/**
 * The conversation's arithmetic: the order entries appear in, the days they fall on, and what a
 * search leaves.
 *
 * Pure, and separate from the component for the same reason `-thread-list` is: these are rules, and
 * a rule inside a render function is a rule no test can name.
 */

/**
 * Entries in canonical order.
 *
 * **This is the one place a timestamp is never a sort key.** The thread pane orders *threads* by
 * their latest entry's `createdAt` — that is 04b's rule, stated there — but *entries within a
 * thread* order by `seq` and by nothing else (AGENTS.md, spec L501). The seed contains a thread
 * whose timestamps run against its `seq` on purpose, so a timestamp sort here renders that thread
 * backwards **while every other test still passes**: the entries would all be present, attributed
 * and countable, and only their order would be a lie.
 *
 * The sort is stable and total because `seq` is: per thread it starts at 1, is gapless, and is
 * immutable once assigned. Nothing here reads `createdAt`, and that absence is the assertion.
 */
export const orderEntries = (entries: readonly Entry[]): readonly Entry[] =>
	[...entries].sort((left, right) => left.seq - right.seq);

/** One entry with the day it falls on, so the list can open a divider when the day changes. */
export interface DatedEntry {
	readonly entry: Entry;
	/** A `YYYY-MM-DD` key in the reader's own time zone. */
	readonly dayKey: string;
	/** The divider's own label, e.g. `November 11, 2026`. */
	readonly dayLabel: string;
	/** True when this entry is the first of its day, so a divider precedes it. */
	readonly opensDay: boolean;
}

const dayKeyOf = (stamp: string): string => {
	const date = new Date(stamp);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
};

const dayLabelOf = (stamp: string): string =>
	new Date(stamp).toLocaleDateString([], {
		month: "long",
		day: "numeric",
		year: "numeric",
	});

/**
 * Entries with their day, in canonical order, each marked if it opens a new day.
 *
 * The prototype does the same thing in `renderConversation` (`app.js` L148): it walks the entries,
 * compares each day key with the previous one's, and pushes a divider when they differ. Doing it
 * here rather than in the render keeps the comparison off the render path and makes "a divider
 * appears between days" a test rather than a screenshot.
 */
export const groupByDay = (
	entries: readonly Entry[],
): readonly DatedEntry[] => {
	let previousDay: string | null = null;
	return orderEntries(entries).map((entry) => {
		const dayKey = dayKeyOf(entry.createdAt);
		const opensDay = dayKey !== previousDay;
		previousDay = dayKey;
		return { entry, dayKey, dayLabel: dayLabelOf(entry.createdAt), opensDay };
	});
};

/**
 * What a search within a thread leaves.
 *
 * Matches the entry's **text** and its **author's name**, which is what the prototype matches
 * (`app.js` L151: `[m.text, principalOf(m.authorId).name]`). Matching a name is deliberate: a
 * reader searching "maya" on a thread is asking who said what, and a search that only looked at
 * message text would return nothing for the question people actually type.
 */
export const filterEntries = (
	entries: readonly Entry[],
	term: string,
	nameOf: (principalId: PrincipalId) => string,
): readonly Entry[] => {
	const needle = term.trim().toLowerCase();
	if (needle === "") return entries;
	// The search reads an entry of **any** kind through `entryText`, so a status move is findable by the
	// word "resolved" and an acknowledgement by its position. Before 10a this read `entry.text`, which
	// worked only because every entry was a message.
	return entries.filter((entry) =>
		`${entryText(entry)} ${nameOf(entry.authorId)}`
			.toLowerCase()
			.includes(needle),
	);
};

/**
 * Which absence a thread is showing, or `null` when it has entries.
 *
 * Three different absences again, and the distinction the criterion asks for: **"no match" is not
 * "empty thread"**. A reader who searched and found nothing needs to be told the thread has entries
 * and their term matched none of them; a reader looking at a thread nobody has written in needs to
 * be told that instead. One message for both would be wrong about the thread in one of the two
 * cases.
 */
export const conversationEmptyState = (
	allEntries: readonly Entry[],
	visibleEntries: readonly Entry[],
	term: string,
): { readonly title: string; readonly detail: string } | null => {
	if (visibleEntries.length > 0) return null;
	if (term.trim() !== "") {
		// The prototype's copy (app.js L154), and the same distinction it draws.
		return {
			title:
				allEntries.length === 0 ? "No messages yet" : "No matching messages",
			detail:
				allEntries.length === 0
					? "Be the first person to write in this thread."
					: "Try a different search term, or clear the filter.",
		};
	}
	return {
		title: "No messages yet",
		detail: "Be the first person to write in this thread.",
	};
};

/**
 * The participants of a thread, derived from its entries.
 *
 * Derived rather than stored, because a thread carries no member list (`Thread` has none on
 * purpose — the grant is the membership). The consequences should be stated where a reader can see
 * them: the **creator** is on this list only if they also wrote something, and a principal added to
 * the board who has never posted does not appear. That is why the details panel shows the creator
 * separately rather than trusting this list to include them.
 */
export const threadParticipants = (
	entries: readonly Entry[],
	principals: readonly PrincipalSummary[],
): readonly PrincipalSummary[] => {
	const seen = new Set<PrincipalId>(entries.map((entry) => entry.authorId));
	return principals.filter((principal) => seen.has(principal.id));
};

/** What the thread-details panel reports. */
export interface ThreadFacts {
	readonly createdAt: string;
	readonly entryCount: number;
	/** The last sequence in the thread, or 0 when nobody has written in it. */
	readonly lastSeq: Seq;
	readonly creator: PrincipalSummary | undefined;
	readonly participants: readonly PrincipalSummary[];
}

/**
 * The facts the details panel states, from what the conversation already holds.
 *
 * `lastSeq` comes from the highest `seq` rather than from `entryCount`: they agree only while the
 * sequence is gapless, and a panel that reported a count where the product reports a position would
 * be right today and wrong the first time a purge leaves a gap (14).
 */
export const threadFacts = (
	thread: Thread,
	entries: readonly Entry[],
	principals: readonly PrincipalSummary[],
): ThreadFacts => ({
	createdAt: thread.createdAt,
	entryCount: entries.length,
	lastSeq: entries.reduce<Seq>((last, entry) => Math.max(last, entry.seq), 0),
	creator: principals.find((principal) => principal.id === thread.creatorId),
	participants: threadParticipants(entries, principals),
});

/**
 * Whether an entry was written by an agent, and therefore carries the marking.
 *
 * Reads the author's `kind` from the roster rather than from the entry, because **an entry does not
 * carry a kind** — it carries an author, and the author is a principal. That indirection is the
 * point: if an entry recorded "written by an agent" a later change of the author's kind would make
 * the entry lie. `kind` is a label, not a capability (AGENTS.md), and this is the only use of it
 * outside the gate rule: it tells a reader who is speaking.
 */
export const isAgentAuthored = (
	entry: Entry,
	principals: readonly PrincipalSummary[],
): boolean =>
	principals.find((principal) => principal.id === entry.authorId)?.kind ===
	"agent";

/** The draft a composer sends, trimmed, or `null` when there is nothing to send. */
export const draftToSend = (draft: string): string | null => {
	const trimmed = draft.trim();
	return trimmed === "" ? null : trimmed;
};

/**
 * Why an empty draft cannot be sent, in the words a reader gets.
 *
 * Stated rather than implied by a disabled button: a disabled Send with no explanation is a control
 * that looks broken, and the criterion asks for whitespace-only input to be "refused with a reason".
 */
export const EMPTY_DRAFT_REASON =
	"A message needs some text before it can be sent.";

/** A principal's name, or their id when the roster has not arrived. */
export const nameOfPrincipal = (
	principalId: PrincipalId,
	principals: readonly PrincipalSummary[],
): string =>
	principals.find((principal) => principal.id === principalId)?.name ??
	principalId;

/** Re-exported so the component does not need a second import for the type it renders. */
export type ConversationPrincipal = Principal;
