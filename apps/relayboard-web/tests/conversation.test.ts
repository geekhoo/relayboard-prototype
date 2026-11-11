import { describe, expect, it } from "vitest";
import type { Entry, PrincipalSummary, Thread } from "#/client";
import type { MessageEntry } from "#/domain";
import {
	conversationEmptyState,
	draftToSend,
	filterEntries,
	groupByDay,
	isAgentAuthored,
	threadFacts,
	threadParticipants,
} from "#/routes/-conversation";

/**
 * The conversation's rules, asserted without a DOM.
 *
 * The ordering test is the important one and it is written to fail if the implementation ever sorts
 * by timestamp: the fixture's timestamps run **backwards** against its `seq`, so a timestamp sort
 * produces a visibly different array while a `seq` sort produces the canonical order. Every other
 * assertion in the repository would pass either way.
 */

const thread: Thread = {
	id: "delivery",
	boardId: "platform",
	title: "Durable message delivery",
	creatorId: "maya",
	createdAt: "2026-11-11T08:00:00.000Z",
	pinned: true,
	status: "open",
	origin: "demo",
};

const entry = (
	seq: number,
	createdAt: string,
	text: string,
	authorId = "maya",
	extra: Omit<Partial<MessageEntry>, "kind"> = {},
): Entry => ({
	id: `entry-${seq}`,
	kind: "message",
	seq,
	authorId,
	createdAt,
	origin: "demo",
	text,
	references: [],
	...extra,
});

/** Positions 1..3 with timestamps that run the wrong way, as the seed's retention thread does. */
const backwards: readonly Entry[] = [
	entry(1, "2026-11-11T12:00:00.000Z", "first, but the latest instant"),
	entry(2, "2026-11-11T09:00:00.000Z", "second, in between"),
	entry(3, "2026-11-11T06:00:00.000Z", "third, and the earliest instant"),
];

const people: readonly PrincipalSummary[] = [
	{ id: "alex", name: "Alex Morgan", kind: "human" },
	{ id: "maya", name: "Maya Chen", kind: "human" },
	{ id: "orion", name: "Orion", kind: "agent" },
];

describe("the canonical order", () => {
	it("orders by seq and never by timestamp", () => {
		const ordered = groupByDay(backwards).map(({ entry: e }) => e.seq);

		expect(ordered).toEqual([1, 2, 3]);
		// The fixture is deliberately adversarial: sorted by createdAt this would be 3, 2, 1. This
		// assertion is what distinguishes a seq sort from a timestamp sort, and nothing else in the
		// repository would notice the difference.
		const byTimestamp = [...backwards]
			.sort(
				(left, right) =>
					new Date(left.createdAt).getTime() -
					new Date(right.createdAt).getTime(),
			)
			.map((e) => e.seq);
		expect(ordered).not.toEqual(byTimestamp);
	});

	it("does not depend on the order it is given", () => {
		const shuffled = [
			backwards[2],
			backwards[0],
			backwards[1],
		] as readonly Entry[];

		expect(groupByDay(shuffled).map(({ entry: e }) => e.seq)).toEqual([
			1, 2, 3,
		]);
	});

	it("leaves the argument untouched", () => {
		const input = [...backwards];
		groupByDay(input);

		// A sort that reordered the caller's array would corrupt whatever else holds it — the cache,
		// for instance, which is the same array the pane counts from.
		expect(input.map((e) => e.seq)).toEqual([1, 2, 3]);
	});
});

describe("day dividers", () => {
	it("marks the first entry of each day and nothing else", () => {
		// Built from LOCAL dates rather than from UTC instants, because the divider groups by the
		// reader's own calendar: fixed UTC strings would put two entries on different local days for
		// some runners and the same day for others, and the test would pass or fail by time zone.
		// (The first version of this fixture did exactly that and failed in UTC+8.)
		const local = (daysAgo: number, hour: number) => {
			const date = new Date();
			date.setDate(date.getDate() - daysAgo);
			date.setHours(hour, 0, 0, 0);
			return date.toISOString();
		};
		const across: readonly Entry[] = [
			entry(1, local(1, 9), "yesterday"),
			entry(2, local(1, 18), "still yesterday"),
			entry(3, local(0, 8), "today"),
		];

		const dated = groupByDay(across);

		expect(dated.map(({ opensDay }) => opensDay)).toEqual([true, false, true]);
		expect(dated[0]?.dayLabel).not.toBe(dated[2]?.dayLabel);
	});

	it("uses the local day, not the UTC day", () => {
		// Two instants that are the same UTC day but can be different local days, or the reverse.
		// The key is derived from the local calendar, so a reader in any zone sees their own days.
		const late: readonly Entry[] = [
			entry(1, "2026-11-11T23:30:00.000Z", "late"),
			entry(2, "2026-11-12T00:30:00.000Z", "just after"),
		];

		const keys = groupByDay(late).map(({ dayKey }) => dayKey);
		const localDays = late.map((e) => {
			const date = new Date(e.createdAt);
			return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
		});
		expect(keys).toEqual(localDays);
	});
});

describe("searching within a thread", () => {
	const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? id;
	const entries: readonly Entry[] = [
		entry(
			1,
			"2026-11-11T06:00:00.000Z",
			"The outbox pattern needs a relay.",
			"maya",
		),
		entry(
			2,
			"2026-11-11T07:00:00.000Z",
			"Agreed, and a durable cursor.",
			"alex",
		),
		entry(3, "2026-11-11T08:00:00.000Z", "I will check the ordering.", "orion"),
	];

	it("matches the entry's text", () => {
		expect(filterEntries(entries, "outbox", nameOf).map((e) => e.seq)).toEqual([
			1,
		]);
	});

	it("matches the author's name, because that is the question people type", () => {
		// The prototype matches both (app.js L151), and a search for a person is a real query: "what
		// did Orion say" is the reason someone types a name.
		expect(filterEntries(entries, "orion", nameOf).map((e) => e.seq)).toEqual([
			3,
		]);
	});

	it("keeps everything when the term is empty or only spaces", () => {
		expect(filterEntries(entries, "", nameOf)).toHaveLength(3);
		expect(filterEntries(entries, "   ", nameOf)).toHaveLength(3);
	});

	it("is case-insensitive and trims the term", () => {
		expect(
			filterEntries(entries, "  OUTBOX  ", nameOf).map((e) => e.seq),
		).toEqual([1]);
	});

	it("distinguishes no match from an empty thread", () => {
		// The criterion's distinction, and the reason this is a function rather than a ternary in the
		// render: the two absences mean different things and say different words.
		const noMatch = conversationEmptyState(entries, [], "zzz");
		const emptyThread = conversationEmptyState([], [], "");

		expect(noMatch?.title).toBe("No matching messages");
		expect(noMatch?.detail).toBe(
			"Try a different search term, or clear the filter.",
		);
		expect(emptyThread?.title).toBe("No messages yet");
		expect(emptyThread?.detail).toBe(
			"Be the first person to write in this thread.",
		);
		expect(noMatch?.title).not.toBe(emptyThread?.title);
	});

	it("says 'no messages yet' for a search that matched an empty thread", () => {
		// Both filters at once: the thread is empty AND a term is set. Telling the reader their term
		// matched nothing would imply there was something to match.
		expect(conversationEmptyState([], [], "zzz")?.title).toBe(
			"No messages yet",
		);
	});

	it("says nothing when there are entries to show", () => {
		expect(conversationEmptyState(entries, entries, "")).toBeNull();
	});
});

describe("the thread's facts", () => {
	it("reports the last seq from the entries, not from the count", () => {
		// A gapless sequence makes these agree; a purge that leaves a gap (14) does not. Reporting the
		// count where the product reports a position would be right today and wrong then.
		const gapped: readonly Entry[] = [
			entry(1, "2026-11-11T06:00:00.000Z", "one"),
			entry(4, "2026-11-11T07:00:00.000Z", "four"),
		];

		const facts = threadFacts(thread, gapped, people);

		expect(facts.entryCount).toBe(2);
		expect(facts.lastSeq).toBe(4);
	});

	it("names the creator from the roster, and reports zero for a thread nobody has written in", () => {
		const facts = threadFacts(thread, [], people);

		expect(facts.creator?.name).toBe("Maya Chen");
		expect(facts.entryCount).toBe(0);
		expect(facts.lastSeq).toBe(0);
		expect(facts.participants).toEqual([]);
	});

	it("derives participants from authorship, and does not invent the creator", () => {
		// A thread carries no member list, so this list is who wrote — which means the creator is on it
		// only if they also posted. The panel shows the creator separately for that reason.
		const facts = threadFacts(thread, backwards, people);

		expect(facts.participants.map((p) => p.id)).toEqual(["maya"]);
		expect(threadParticipants(backwards, people)).toHaveLength(1);
	});

	it("includes a principal once however many entries they wrote", () => {
		const many: readonly Entry[] = [
			entry(1, "2026-11-11T06:00:00.000Z", "one", "orion"),
			entry(2, "2026-11-11T07:00:00.000Z", "two", "orion"),
			entry(3, "2026-11-11T08:00:00.000Z", "three", "alex"),
		];

		expect(threadParticipants(many, people).map((p) => p.id)).toEqual([
			"alex",
			"orion",
		]);
	});
});

describe("marking agent authorship", () => {
	it("reads the author's kind from the roster, not from the entry", () => {
		// An entry carries an author, not a kind: recording "written by an agent" on the entry would
		// let a later change to the author's kind leave the entry lying.
		const byAgent = entry(1, "2026-11-11T06:00:00.000Z", "hello", "orion");
		const byHuman = entry(2, "2026-11-11T07:00:00.000Z", "hello", "alex");

		expect(isAgentAuthored(byAgent, people)).toBe(true);
		expect(isAgentAuthored(byHuman, people)).toBe(false);
	});

	it("does not claim anything about an author the roster has not arrived for", () => {
		const unknown = entry(1, "2026-11-11T06:00:00.000Z", "hello", "someone");

		expect(isAgentAuthored(unknown, [])).toBe(false);
	});
});

describe("the draft", () => {
	it("trims surrounding whitespace", () => {
		expect(draftToSend("  hello  ")).toBe("hello");
	});

	it("refuses whitespace-only input, with a reason", () => {
		expect(draftToSend("")).toBeNull();
		expect(draftToSend("   \n\t ")).toBeNull();
	});
});
