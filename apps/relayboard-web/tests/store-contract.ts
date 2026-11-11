import { describe, expect, expectTypeOf, it } from "vitest";
import type { Entry } from "#/domain";
import { errorMessageList, errorMessages } from "#/domain";
import type { Store } from "#/server/store";

/**
 * The store's rules, asserted once and run against every workspace it must hold.
 *
 * Written as a function rather than as a `*.test.ts` file so a workspace can supply
 * the identifiers it actually has: 02b runs it against a two-board fixture, 02c runs
 * the same assertions against the demo seed, and "the suite from 02b still passes
 * against the seeded workspace" is then a re-run rather than a second, weaker suite
 * written beside it.
 *
 * Every assertion is caller-observable: operations' results, and the documented error
 * strings. Nothing here names a field of the store's own, a map key or a module file,
 * so the store can be reorganised underneath without this changing.
 */
export interface StoreWorkspace {
	/** What this workspace is, for the test names. */
	readonly label: string;
	/** A fresh store over this workspace. Called once per test, never shared. */
	readonly create: () => Store;
	/** A thread that has entries in this workspace. */
	readonly threadId: string;
	/** A different thread, so a rule about "this thread only" has something to leave alone. */
	readonly otherThreadId: string;
	/** A principal on the first thread's board. */
	readonly memberId: string;
	/** A second principal on that same board, so one principal's progress can be told from another's. */
	readonly coMemberId: string;
	/** A principal that is not on that board. */
	readonly strangerId: string;
}

const seqs = (store: Store, threadId: string): number[] =>
	store.readEntries(threadId).map((entry) => entry.seq);

const lastSeqOf = (store: Store, threadId: string): number =>
	seqs(store, threadId).at(-1) ?? 0;

export const describeStoreRules = (workspace: StoreWorkspace): void => {
	const { create, threadId, otherThreadId, memberId, coMemberId, strangerId } =
		workspace;

	const positionOf = (store: Store, thread: string, principal: string) => {
		const position = store
			.readPositions(thread)
			.find((candidate) => candidate.principalId === principal);
		if (!position) throw new Error(`no position for ${principal}`);
		return position.watermarks;
	};

	describe(`the per-thread sequence (${workspace.label})`, () => {
		it("starts each thread at 1 and appends its own gapless sequence", () => {
			const store = create();
			const beforeOther = lastSeqOf(store, otherThreadId);

			const onOther = store.appendMessage({
				threadId: otherThreadId,
				authorId: memberId,
				text: "One number per thread.",
			});
			const onThread = store.appendMessage({
				threadId,
				authorId: memberId,
				text: "And this thread counts on its own.",
			});

			expect(onOther.seq).toBe(beforeOther + 1);
			expect(onThread.seq).toBe(lastSeqOf(store, threadId));
			// Gapless from 1, with no repeat and no gap.
			expect(seqs(store, threadId)).toEqual(
				seqs(store, threadId).map((_, index) => index + 1),
			);
			expect(seqs(store, otherThreadId)).toEqual(
				seqs(store, otherThreadId).map((_, index) => index + 1),
			);
		});

		it("never rewrites a number, and a caller cannot reassign one it was given", () => {
			const store = create();
			const first = store.readEntries(threadId)[0];
			const lastBefore = lastSeqOf(store, threadId);

			store.appendMessage({
				threadId,
				authorId: memberId,
				text: "A later entry.",
			});

			// The entry handed out before the append is the same record afterwards, at the
			// same position: an assigned number is not re-derived on read.
			expect(store.readEntries(threadId)[0]).toBe(first);
			expect(first?.seq).toBe(1);
			expect(() => {
				(first as { seq: number }).seq = 99;
			}).toThrow();
			expect(seqs(store, threadId)).toEqual(
				Array.from({ length: lastBefore + 1 }, (_, index) => index + 1),
			);
		});
	});

	describe(`an append the store refuses (${workspace.label})`, () => {
		// Every case carries an empty text on purpose: each must fail on the rule before
		// the last one, which is what makes the documented order observable.
		const rejections = [
			{
				name: "an unknown thread",
				append: { threadId: "no-such-thread", authorId: strangerId, text: "" },
			},
			{
				name: "a principal who is not on the thread's board",
				append: { threadId, authorId: strangerId, text: "" },
			},
			{
				name: "text that is empty once trimmed",
				append: { threadId, authorId: memberId, text: "   \n\t " },
			},
		];

		it("rejects each with the documented string, in the documented order", () => {
			const store = create();

			const thrown = rejections.map((rejection) => {
				try {
					store.appendMessage(rejection.append);
					return null;
				} catch (error) {
					return (error as Error).message;
				}
			});

			// The domain's own list, so "one place in the domain" is checkable from outside
			// rather than asserted about the source layout.
			expect(thrown).toEqual([...errorMessageList]);
		});

		it("leaves the store unchanged and consumes no seq", () => {
			const store = create();
			const before = seqs(store, threadId);

			for (const rejection of rejections) {
				expect(
					() => store.appendMessage(rejection.append),
					rejection.name,
				).toThrow();
			}

			expect(seqs(store, threadId)).toEqual(before);
			const accepted = store.appendMessage({
				threadId,
				authorId: memberId,
				text: "Accepted, and it lands on the number the refusals did not take.",
			});
			// Exactly the next number, not the fourth one: the three refusals took none.
			expect(accepted.seq).toBe((before.at(-1) ?? 0) + 1);
			expect(seqs(store, threadId)).toEqual([...before, accepted.seq]);
		});

		it("trims the text it stores, so the stored words are the words that matter", () => {
			const store = create();

			const entry = store.appendMessage({
				threadId,
				authorId: memberId,
				text: "  Padded on purpose.  ",
			});

			expect(entry.kind).toBe("message");
			if (entry.kind !== "message") throw new Error("expected a message");
			expect(entry.text).toBe("Padded on purpose.");
		});
	});

	describe(`an append replayed under its key (${workspace.label})`, () => {
		it("returns the identical entry and appends nothing", () => {
			const store = create();
			const before = seqs(store, threadId);
			const input = {
				threadId,
				authorId: memberId,
				text: "Send once.",
				idempotencyKey: `${workspace.label}-replay`,
			};

			const first = store.appendMessage(input);
			const replay = store.appendMessage(input);

			expect(replay).toBe(first);
			expect(seqs(store, threadId)).toEqual([...before, first.seq]);
		});

		it("is checked before validation, so a replay of a stored key returns the entry even if the text would now be rejected", () => {
			const store = create();
			const first = store.appendMessage({
				threadId,
				authorId: memberId,
				text: "Send once.",
				idempotencyKey: `${workspace.label}-replay-before-validation`,
			});
			const before = seqs(store, threadId);

			// The retry carries the same key and a text that is now empty. If validation ran
			// first it would fail with "Message cannot be empty"; a retry must be safe, so
			// the stored entry comes back instead. Only that ordering makes both true.
			const replay = store.appendMessage({
				threadId,
				authorId: memberId,
				text: "   ",
				idempotencyKey: `${workspace.label}-replay-before-validation`,
			});

			expect(replay).toBe(first);
			expect(seqs(store, threadId)).toEqual(before);
			const last = store.readEntries(threadId).at(-1);
			expect(last?.kind === "message" && last.text).toBe("Send once.");
		});
	});

	describe(`the watermarks (${workspace.label})`, () => {
		it("advances neither while the principal is paused", () => {
			const store = create();
			const before = positionOf(store, threadId, memberId);
			store.setConnection(memberId, false);

			store.appendMessage({
				threadId,
				authorId: coMemberId,
				text: "Committed while the first principal had the stream paused.",
			});

			expect(positionOf(store, threadId, memberId)).toEqual(before);
			// The entry is in history regardless: pausing withholds, it does not lose.
			expect(lastSeqOf(store, threadId)).toBe((before.cursor || 0) + 1);
		});

		it("advances cursor only on resume, and never seen", () => {
			const store = create();
			store.setConnection(memberId, false);
			const before = positionOf(store, threadId, memberId);
			store.appendMessage({
				threadId,
				authorId: coMemberId,
				text: "Withheld while paused.",
			});

			store.setConnection(memberId, true);

			// Resuming replays what was withheld, so delivery catches up to the thread's last
			// position. Reading did not happen, so `seen` did not move.
			expect(positionOf(store, threadId, memberId)).toEqual({
				cursor: lastSeqOf(store, threadId),
				seen: before.seen,
				acknowledged: before.acknowledged,
			});
		});

		it("advances seen only when the principal reads, and leaves cursor where it was", () => {
			const store = create();
			const before = positionOf(store, threadId, memberId);

			store.markRead(memberId, threadId);

			expect(positionOf(store, threadId, memberId)).toEqual({
				cursor: before.cursor,
				seen: lastSeqOf(store, threadId),
				acknowledged: before.acknowledged,
			});
		});

		it("is per principal and per thread, so one principal's progress moves nobody else's", () => {
			const store = create();
			// Read as they are rather than from a zero baseline: a seeded workspace starts
			// some principals part-way through a thread, and "this principal only" has to
			// hold whether the others sit at 0 or at 9.
			const untouched = {
				samePrincipalOtherThread: positionOf(store, otherThreadId, memberId),
				otherPrincipalSameThread: positionOf(store, threadId, coMemberId),
			};

			store.markRead(memberId, threadId);

			expect(positionOf(store, threadId, memberId).seen).toBe(
				lastSeqOf(store, threadId),
			);
			expect(positionOf(store, otherThreadId, memberId)).toEqual(
				untouched.samePrincipalOtherThread,
			);
			expect(positionOf(store, threadId, coMemberId)).toEqual(
				untouched.otherPrincipalSameThread,
			);
		});

		it("withholds a paused principal's entries from its view and leaves them in history", () => {
			const store = create();
			const viewBefore = store.readView(threadId, memberId);
			const lastBeforePause = viewBefore.at(-1);
			store.setConnection(memberId, false);

			store.appendMessage({
				threadId,
				authorId: coMemberId,
				text: "First while paused.",
			});
			store.appendMessage({
				threadId,
				authorId: coMemberId,
				text: "Second while paused.",
			});

			const view = store.readView(threadId, memberId);
			// The view did not move: it still ends where it ended before the pause.
			expect(view).toEqual(viewBefore);
			expect(view.at(-1)).toBe(lastBeforePause);
			// Meanwhile the thread grew by two, and both entries are readable history.
			expect(store.readEntries(threadId)).toHaveLength(viewBefore.length + 2);
			const last = store.readEntries(threadId).at(-1);
			expect(last?.kind === "message" && last.text).toBe(
				"Second while paused.",
			);
		});

		it("keeps the principal's own entries in its view while paused", () => {
			const store = create();
			store.setConnection(memberId, false);

			const own = store.appendMessage({
				threadId,
				authorId: memberId,
				text: "Written while the stream was paused.",
			});

			expect(store.readView(threadId, memberId)).toContainEqual(own);
		});
	});

	describe(`an act the store refuses (${workspace.label})`, () => {
		// **The four rules of a refused write, one per act.** 02b asserts them for an append; since 10a
		// an act takes a `seq` from the same counter, so a refused act has to leave the chronology
		// exactly as an append does — unchanged, contiguous, and with nothing half-recorded.
		//
		// Written here rather than in the conformance suite because that suite always acts as one
		// principal: it has no stranger to refuse. An earlier version of this assertion lived there and
		// passed with the store's permission check **deleted**, which is the finding that moved it.
		const resourceOnBoard = (store: Store) =>
			store.listResources(store.readThread(threadId)?.boardId ?? "")[0]?.id ??
			"";

		it("leaves the thread unchanged and consumes no seq, for each of the three acts", () => {
			const store = create();
			const before = seqs(store, threadId);
			const resourceId = resourceOnBoard(store);

			// A principal outside the board's grant: the same stranger 02b uses for the append.
			expect(() =>
				store.attachResource({
					threadId,
					resourceId,
					authorId: strangerId,
				}),
			).toThrow(errorMessages.notABoardMember);
			expect(() =>
				store.moveStatus({
					threadId,
					from: "open",
					to: "resolved",
					authorId: strangerId,
				}),
			).toThrow(errorMessages.notABoardMember);
			expect(() =>
				store.acknowledge({
					threadId,
					upTo: 1,
					authorId: strangerId,
				}),
			).toThrow(errorMessages.notABoardMember);

			// Unchanged, gapless, and the stranger's own watermark untouched.
			expect(seqs(store, threadId)).toEqual(before);
			expect(positionOf(store, threadId, strangerId).acknowledged).toBe(0);
		});

		it("refuses a move from a status the thread is not in, and writes nothing", () => {
			const store = create();
			const before = seqs(store, threadId);

			// The member holding the permission, moving from a status that is not the thread's.
			expect(() =>
				store.moveStatus({
					threadId,
					from: "resolved",
					to: "open",
					authorId: memberId,
				}),
			).toThrow(errorMessages.statusChanged);

			expect(seqs(store, threadId)).toEqual(before);
			expect(store.readThread(threadId)?.status).toBe("open");
		});

		it("refuses a move to the status the thread is already in", () => {
			// Not an error a reader would see often, but it is the difference between an event and a
			// no-op: an entry saying open → open records a transition that did not happen.
			const store = create();
			const before = seqs(store, threadId);

			expect(() =>
				store.moveStatus({
					threadId,
					from: "open",
					to: "open",
					authorId: memberId,
				}),
			).toThrow(errorMessages.statusUnchanged);

			expect(seqs(store, threadId)).toEqual(before);
		});

		it("refuses an acknowledgement past the thread's last position", () => {
			const store = create();
			const before = seqs(store, threadId);

			expect(() =>
				store.acknowledge({
					threadId,
					upTo: lastSeqOf(store, threadId) + 5,
					authorId: memberId,
				}),
			).toThrow(errorMessages.acknowledgementAhead);

			expect(seqs(store, threadId)).toEqual(before);
			expect(positionOf(store, threadId, memberId).acknowledged).toBe(0);
		});

		it("refuses an artifact pointing at a resource on another board", () => {
			// A resource is board-scoped, so an artifact that named another board's resource would be a
			// reference the thread's readers could not resolve — or, worse, one that leaked a name across
			// a boundary the grant model keeps.
			const store = create();
			const elsewhere = store
				.listBoards()
				.filter((board) => board.id !== store.readThread(threadId)?.boardId)
				.flatMap((board) => store.listResources(board.id))[0];
			if (!elsewhere) return;

			const before = seqs(store, threadId);
			expect(() =>
				store.attachResource({
					threadId,
					resourceId: elsewhere.id,
					authorId: memberId,
				}),
			).toThrow(errorMessages.resourceNotFound);

			expect(seqs(store, threadId)).toEqual(before);
		});
	});

	describe(`origin (${workspace.label})`, () => {
		it("is recorded on every entry: seeded records keep theirs, a new one is the owner's", () => {
			const store = create();
			const seeded = store.readEntries(threadId).map((entry) => entry.origin);

			const appended = store.appendMessage({
				threadId,
				authorId: memberId,
				text: "Mine, made here.",
			});

			expect(seeded.every((origin) => origin === "demo")).toBe(true);
			expect(appended.origin).toBe("owner");
			expect(store.readEntries(threadId).map((entry) => entry.origin)).toEqual([
				...seeded,
				"owner",
			]);
		});

		it("changes nothing about what an operation will do, because it is provenance and not permission", () => {
			const store = create();
			const before = store.readThread(threadId);

			store.appendMessage({
				threadId,
				authorId: memberId,
				text: "An owner entry on a demo thread.",
			});

			// Nothing was refused or rewritten on account of origin.
			expect(store.readThread(threadId)).toBe(before);
			expect(before?.origin).toBe("demo");
			expect(store.readEntries(threadId)[0]?.origin).toBe("demo");
		});
	});

	describe(`the append's synchronous step (${workspace.label})`, () => {
		it("returns an entry rather than a promise, because there is nothing to interleave with", () => {
			const store = create();

			const entry = store.appendMessage({
				threadId,
				authorId: memberId,
				text: "Synchronous.",
			});

			// Asserted so a later move to an asynchronous store cannot happen quietly: an
			// `async` append changes this type and this test, which is the moment the "no
			// await between computing the next seq and appending" rule has to be revisited.
			expectTypeOf(store.appendMessage).returns.toEqualTypeOf<Entry>();
			expect(entry).not.toBeInstanceOf(Promise);
			expect(store.readEntries(threadId).at(-1)).toBe(entry);
		});
	});
};
