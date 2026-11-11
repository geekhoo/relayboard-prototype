import { describe, expect, it } from "vitest";
import {
	type AcknowledgementEntry,
	type ArtifactEntry,
	type Entry,
	entrySentence,
	entryText,
	isThreadStatus,
	type MessageEntry,
	movableTo,
	type StatusMoveEntry,
	THREAD_STATUSES,
} from "#/domain";

/**
 * The domain's answers about an entry of **any** kind.
 *
 * These exist because 10a widened `Entry` to a union, and two questions had to be answered once rather
 * than at each call site: "what does this entry say" (the thread search and the row excerpt) and "which
 * statuses can a thread move to". Both are total functions over the union, so a fifth kind is a compile
 * error rather than a row that renders nothing.
 */
const base = {
	id: "entry-1",
	seq: 1,
	authorId: "alex",
	createdAt: "2026-11-11T10:00:00.000Z",
	origin: "owner",
} as const;

const message: MessageEntry = {
	...base,
	kind: "message",
	text: "A message.",
	references: [],
};
const artifact: ArtifactEntry = {
	...base,
	kind: "artifact",
	resourceId: "res-1",
};
const move: StatusMoveEntry = {
	...base,
	kind: "status-move",
	from: "open",
	to: "resolved",
};
const ack: AcknowledgementEntry = {
	...base,
	kind: "acknowledgement",
	upTo: 7,
	fromUpTo: 2,
};
const all: readonly Entry[] = [message, artifact, move, ack];

describe("entryText", () => {
	it("states every kind, and never returns an empty string", () => {
		// The union is exhaustive by construction; this asserts the *result*, because a branch that
		// returned "" would type-check and render a blank row.
		for (const entry of all) {
			expect(entryText(entry).length).toBeGreaterThan(0);
		}
	});

	it("gives an act a sentence rather than a fragment", () => {
		// Because an act is an *event*: the sentence is how it reads in a list, and a caller that only
		// wanted words for a search does not have to know that.
		expect(entryText(move)).toBe("moved the status from open to resolved");
		expect(entryText(ack)).toBe("acknowledged up to #7");
		// An artifact names the resource by id, because the domain has no board to look it up on.
		expect(entryText(artifact)).toContain("res-1");
	});
});

describe("entrySentence", () => {
	it("names the author, because a rendered act says who did it", () => {
		const lookups = { nameOf: () => "Alex" };
		expect(entrySentence(move, lookups)).toContain("Alex");
		expect(entrySentence(ack, lookups)).toContain("Alex");
		expect(entrySentence(artifact, lookups)).toContain("Alex");
	});

	it("substitutes a resource name when the caller has one, and the id when it does not", () => {
		// Two behaviours in one function, because the caller that has the board passes the lookup and the
		// caller that does not names the id rather than rendering nothing.
		expect(
			entrySentence(artifact, {
				nameOf: () => "Alex",
				resourceNameOf: () => "Architecture notes",
			}),
		).toContain("Architecture notes");
		expect(entrySentence(artifact, { nameOf: () => "Alex" })).toContain(
			"res-1",
		);
	});

	it("says nothing that could read as a verdict for an acknowledgement", () => {
		// spec L438 / DESIGN.md 295: a report about the acknowledger, never agreement.
		const rendered = entrySentence(ack, { nameOf: () => "Alex" });
		for (const verdict of [
			"approved",
			"agreed",
			"done",
			"complete",
			"signed",
		]) {
			expect(rendered.toLowerCase()).not.toContain(verdict);
		}
	});
});

describe("the closed status set", () => {
	it("is exactly two members, and the guard agrees with the list", () => {
		// A list and a guard that disagree is the classic drift: the guard would accept a value the list
		// does not contain, or refuse one it does. Asserted as one loop so they cannot.
		expect([...THREAD_STATUSES]).toEqual(["open", "resolved"]);
		for (const status of THREAD_STATUSES) {
			expect(isThreadStatus(status)).toBe(true);
		}
		for (const other of ["done", "closed", "", "Open", "resolved "]) {
			expect(isThreadStatus(other)).toBe(false);
		}
	});

	it("offers only the statuses a thread is not already in", () => {
		// A move to the status it is already in is not a move, so offering it would produce an entry that
		// records nothing. Computed as the complement so widening the set cannot leave a stale list.
		expect(movableTo("open")).toEqual(["resolved"]);
		expect(movableTo("resolved")).toEqual(["open"]);
		for (const status of THREAD_STATUSES) {
			expect(movableTo(status)).not.toContain(status);
		}
	});
});
