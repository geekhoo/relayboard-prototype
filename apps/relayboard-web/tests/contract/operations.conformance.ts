import { describe, expect, expectTypeOf, it } from "vitest";
import type {
	AppendMessageInput,
	BoardSummary,
	CreateBoardInput,
	CreateThreadInput,
	DeclaredValues,
	Entry,
	Grant,
	Origin,
	ParticipantRead,
	PermissionName,
	PrincipalId,
	PrincipalPosition,
	PrincipalSummary,
	RelayboardClient,
	Resource,
	StreamState,
	ThreadContents,
	Watermarks,
} from "#/client";
import { clientOperations, operationPermissions } from "#/client";
import type {
	BoardId,
	Board as DomainBoard,
	Principal as DomainPrincipal,
	ResourceId,
	Thread,
	ThreadId,
} from "#/domain";

/**
 * The conformance suite, written against the interface.
 *
 * Everything here goes through `RelayboardClient`, and nothing here names an
 * implementation. 06c points this same file at the HTTP client and it must pass
 * unchanged; 11a's stream file is the other half, and the split exists precisely so
 * 06c can skip the stream without weakening these assertions.
 *
 * Three properties of the file are themselves part of the ticket:
 *
 * 1. **It is a factory, not a test file.** `describeOperationsConformance(subject)`
 *    takes a client factory, so a second transport is a second call rather than a
 *    second suite. `tests/client.test.ts` calls it with the in-memory client; 06c will
 *    call it with the HTTP one.
 * 2. **Every assertion is caller-observable.** No assertion names a store field, a map
 *    key, a `cursors` object or a module path. Where a progress position is needed it is
 *    asked for through `readPositions`.
 * 3. **It asserts the shape as well as the behaviour**, because three of this ticket's
 *    criteria are about what the interface must *not* expose: a member list on a board,
 *    an author in the payload, admission or grant administration.
 */

/**
 * What a transport under conformance must supply.
 *
 * A factory per test, so one test cannot inherit another's posts, plus the identifiers
 * a suite needs in order to be about the workspace it is pointed at.
 */
export interface ConformanceSubject {
	/** What this subject is, for the test names. */
	readonly label: string;
	/** A client acting as `actor`, over its own fresh workspace. */
	readonly makeClient: () => RelayboardClient | Promise<RelayboardClient>;
	/** The principal the client acts as: resolved by the transport, never sent by the caller. */
	readonly actor: PrincipalId;
	/** A board the actor can read, holding threads and entries. */
	readonly boardId: BoardId;
	/** A thread in that board. */
	readonly threadId: ThreadId;
	/** A second thread in that board, for "this thread only" assertions. */
	readonly otherThreadId: ThreadId;
	/** A principal on that board who is not the actor, for "somebody else's progress". */
	readonly otherPrincipalId: PrincipalId;
}

/** `1..n`, which is what a gapless per-thread sequence is. */
const range = (count: number): number[] =>
	Array.from({ length: count }, (_, index) => index + 1);

export const describeOperationsConformance = (
	subject: ConformanceSubject,
): void => {
	const { label, makeClient, actor, boardId, threadId, otherThreadId } =
		subject;
	const client = async (): Promise<RelayboardClient> => await makeClient();

	describe(`the interface's shape (${label})`, () => {
		it("declares every operation the model needs, and nothing that changes a grant", () => {
			// The prototype's nine plus the model's: a chronology read, resources, the three
			// authored acts, and each principal's position.
			expect([...clientOperations].sort()).toEqual([
				"acknowledge",
				"addResource",
				"appendMessage",
				"attachResource",
				"createBoard",
				"createThread",
				"listBoards",
				"listMembers",
				"listResources",
				"listThreads",
				"moveStatus",
				"readActingPrincipal",
				"readHeldPermissions",
				"readMessages",
				"readPositions",
				"readPrincipal",
				"readThread",
				"setConnection",
				"simulateIncoming",
				"subscribe",
			]);
			// The two surfaces that are deliberately not here: admission is reached before a
			// caller is a participant, and permission administration is the one thing no
			// ordinary participant's client may reach. Either would make this interface
			// describe two different callers.
			const members: readonly string[] = clientOperations;
			for (const forbidden of [
				"knock",
				"pollAdmission",
				"listPending",
				"admit",
				"deny",
				"revoke",
				"grant",
				"editGrant",
			]) {
				expect(members).not.toContain(forbidden);
			}
		});

		it("declares which grant each operation requires, for every operation", () => {
			// Exhaustive by type in `operationPermissions`; asserted here as data too, so a
			// missing line is a test failure and not only a compiler error.
			expect(Object.keys(operationPermissions).sort()).toEqual(
				[...clientOperations].sort(),
			);
			// Three kinds of requirement, and the two shaped ones are named separately so a reader
			// can tell "a grant you cannot name as one permission" from "no grant at all".
			const shaped = Object.entries(operationPermissions)
				.filter(([, requirement]) => typeof requirement === "object")
				.map(([operation, requirement]) => [
					operation,
					Object.keys(requirement)[0],
				])
				.sort();
			expect(shaped).toEqual([
				// Knowing which principal you are requires nothing: a caller with no session must be
				// able to ask, which is how a client learns it has none.
				["readActingPrincipal", "none"],
				// And knowing what you may do requires nothing beyond holding it, for the same reason:
				// a surface has to be able to ask before it offers a control, and an unreadable answer
				// would be indistinguishable from a missing permission.
				["readHeldPermissions", "none"],
				// Opening the stream, or reporting the connection, needs no particular board: only
				// that the caller may read one (spec L339).
				["setConnection", "atLeastOneBoard"],
				["subscribe", "atLeastOneBoard"],
			]);
			// The reason is stated rather than implied, so a reviewer can disagree with the judgement
			// instead of reconstructing it.
			expect(operationPermissions.readActingPrincipal).toMatchObject({
				none: expect.stringContaining("no session"),
			});
			const names = Object.values(operationPermissions).filter(
				(requirement) => typeof requirement === "string",
			);
			// Every declared requirement is spelled the documented way.
			expect(names.every((name) => /^[a-z]+:[a-z]+$/.test(name))).toBe(true);
			// And each one is a member of the vocabulary, which is what makes the declaration
			// checkable rather than merely well-formatted. Written out here as the literal
			// fifteen, so a permission invented in the table fails this test.
			const vocabulary: readonly PermissionName[] = [
				"read:board",
				"create:board",
				"admit:agent",
				"revoke:agent",
				"grant:permission",
				"update:board",
				"create:thread",
				"add:resource",
				"read:member",
				"read:thread",
				"post:message",
				"move:status",
				"add:artifact",
				"acknowledge:thread",
				"read:resource",
			];
			for (const name of names) expect(vocabulary).toContain(name);
			// The requirements the spec's table fixes, asserted literally.
			expect(operationPermissions.appendMessage).toBe("post:message");
			expect(operationPermissions.createThread).toBe("create:thread");
			expect(operationPermissions.createBoard).toBe("create:board");
			expect(operationPermissions.addResource).toBe("add:resource");
			expect(operationPermissions.attachResource).toBe("add:artifact");
			expect(operationPermissions.moveStatus).toBe("move:status");
			expect(operationPermissions.acknowledge).toBe("acknowledge:thread");
			expect(operationPermissions.readPositions).toBe("read:thread");
			expect(operationPermissions.listMembers).toBe("read:member");
			expect(operationPermissions.readPrincipal).toBe("read:member");
			expect(operationPermissions.listResources).toBe("read:resource");
		});

		it("answers which principal this is, through the transport rather than a guess", async () => {
			const api = await client();
			const acting = await api.readActingPrincipal();

			// The interface carries the question so the frame has one rule for every transport: over
			// HTTP the server resolved it from the session cookie, in memory from the principal the
			// client was built with. Both must agree with what an append records.
			expect(acting.id).toBe(actor);
			const entry = await api.appendMessage({
				threadId,
				text: "Authored by whoever this client says it is.",
			});
			expect(entry.authorId).toBe(acting.id);
		});

		it("asks no caller for an author, so a browser cannot post as somebody else", async () => {
			const api = await client();
			const append: AppendMessageInput = {
				threadId,
				text: "An entry with no author on it.",
			};

			expect(Object.keys(append).sort()).toEqual(["text", "threadId"]);
			const entry = await api.appendMessage(append);
			// The author that comes back is the acting principal, resolved by the transport.
			expect(entry.authorId).toBe(actor);
		});
	});

	describe(`reading boards and threads (${label})`, () => {
		it("lists every board with a member count and never a member list", async () => {
			const api = await client();
			const boards = await api.listBoards();

			expect(boards.length).toBeGreaterThan(0);
			expect(boards.some((board) => board.id === boardId)).toBe(true);
			const [board] = boards;
			expect(board).toBeDefined();
			// The count is a number beside the record, and the record carries no member list:
			// exempting the board payload is exactly what `read:member` exists to prevent.
			// Asserted at the type level on the interface's own return type, so the shape is
			// pinned whether or not this particular workspace has a first board.
			expectTypeOf<
				Awaited<ReturnType<RelayboardClient["listBoards"]>>[number]
			>().toEqualTypeOf<BoardSummary>();
			expectTypeOf<BoardSummary>().toEqualTypeOf<
				DomainBoard & { readonly memberCount: number }
			>();
			expect(typeof board?.memberCount).toBe("number");
			expect(Object.keys(board ?? {})).not.toContain("members");
			// The domain record did not grow the count: the addition lives in the
			// interface's return type, not on the record a purge or a grant would touch.
			expectTypeOf<DomainBoard>().not.toHaveProperty("memberCount");
		});

		it("lists a board's threads", async () => {
			const api = await client();
			const threads = await api.listThreads(boardId);

			expect(threads.some((thread) => thread.id === threadId)).toBe(true);
			type Listed = Awaited<ReturnType<RelayboardClient["listThreads"]>>;
			expectTypeOf<Listed[number]>().toEqualTypeOf<Thread>();
		});

		it("reads a thread as a chronology, in canonical order", async () => {
			const api = await client();
			const contents = await api.readThread(threadId);

			expectTypeOf<
				Awaited<ReturnType<RelayboardClient["readThread"]>>
			>().toEqualTypeOf<ThreadContents>();
			expect(contents.thread.id).toBe(threadId);
			const sequences = contents.entries.map((entry) => entry.seq);
			expect(sequences.length).toBeGreaterThan(0);
			// Ordered by seq and gapless from 1: the order is the contract, not an accident
			// of how the implementation happens to hold it.
			expect(sequences).toEqual(range(sequences.length));
			// Contents are entries, not messages: the union the later ticket widens.
			expectTypeOf<ThreadContents["entries"][number]>().toEqualTypeOf<Entry>();
		});

		it("reads the whole thread, and only what is after a position when asked", async () => {
			const api = await client();
			const all = await api.readMessages(threadId);
			const afterFirst = await api.readMessages(threadId, { after: 1 });

			// No paging: opening a conversation never silently truncates its history.
			expect(all.map((entry) => entry.seq)).toEqual(
				range((await api.readThread(threadId)).entries.length),
			);
			expect(afterFirst.length).toBe(all.length - 1);
			expect(afterFirst.every((entry) => entry.seq > 1)).toBe(true);
		});

		it("lists a board's resources as canonical records", async () => {
			const api = await client();
			const resources = await api.listResources(boardId);

			type ListedResources = Awaited<
				ReturnType<RelayboardClient["listResources"]>
			>;
			expectTypeOf<ListedResources>().toEqualTypeOf<ReadonlyArray<Resource>>();
			expect(resources.length).toBeGreaterThan(0);
			for (const resource of resources) {
				expect(resource.boardId).toBe(boardId);
				// A resource holds the content; an entry holds only its id.
				expect(Object.keys(resource).sort()).toEqual([
					"boardId",
					"description",
					"id",
					"name",
					"origin",
					"type",
					"url",
				]);
			}
		});
	});

	describe(`the two participant reads (${label})`, () => {
		it("lists a board's participants as summaries, without their declared values", async () => {
			const api = await client();
			const members = await api.listMembers(boardId);

			expect(members.length).toBeGreaterThan(0);
			type ListedMembers = Awaited<ReturnType<RelayboardClient["listMembers"]>>;
			expectTypeOf<ListedMembers[number]>().toEqualTypeOf<PrincipalSummary>();
			// An id, a name and a kind: enough to attribute what they wrote, and nothing that
			// would hand over what the participant read is entitled by `read:member`.
			for (const member of members) {
				expect(Object.keys(member).sort()).toEqual(["id", "kind", "name"]);
			}
			expect(members.some((member) => member.id === actor)).toBe(true);
		});

		it("reads one participant with the grant it holds on one board", async () => {
			const api = await client();
			const read = await api.readPrincipal({ principalId: actor, boardId });

			// The record, the grant on THAT board, and the declared values kept apart. A read
			// taking only an id could not answer "what may this participant do here".
			type Read = Awaited<ReturnType<RelayboardClient["readPrincipal"]>>;
			expectTypeOf<Read>().toEqualTypeOf<ParticipantRead>();
			// The three parts asserted as a shape: a transport that merged the declared
			// strings into the principal record, or returned a grant without a principal,
			// would fail here rather than at 12.
			expectTypeOf<ParticipantRead>().toEqualTypeOf<{
				readonly principal: DomainPrincipal;
				readonly grant: Grant;
				readonly declared: DeclaredValues;
			}>();
			// The three parts, asserted as the shape rather than as a description: a
			// transport that merged the declared strings into the principal record, or
			// returned the grant without the principal, would fail here.
			expectTypeOf<ParticipantRead>().toEqualTypeOf<{
				readonly principal: DomainPrincipal;
				readonly grant: Grant;
				readonly declared: DeclaredValues;
			}>();
			expect(read.principal.id).toBe(actor);
			expect(Object.keys(read).sort()).toEqual([
				"declared",
				"grant",
				"principal",
			]);
			// The grant is board-scoped: bounded by the board that was asked about, not
			// workspace-wide, because a workspace-wide answer to a board question is the leak.
			expect(read.grant.scope).toBe("board");
			expect(Array.isArray(read.grant.permissions)).toBe(true);
			// Declared values are their own bag of strings, so a client can label them.
			expect(typeof read.declared.description).toBe("string");
			// The record's own origin and the declared strings are not the same thing.
			expect(read.principal.origin).toMatch(/^(demo|owner)$/);
		});
	});

	describe(`posting (${label})`, () => {
		it("appends an entry at the thread's next position and returns it", async () => {
			const api = await client();
			const before = await api.readThread(threadId);

			const entry = await api.appendMessage({
				threadId,
				text: "  Trimmed and committed.  ",
			});

			expect(entry.seq).toBe(before.entries.length + 1);
			expect(entry.text).toBe("Trimmed and committed.");
			expect(entry.authorId).toBe(actor);
			expect(entry.origin).toBe<Origin>("owner");
			const after = await api.readThread(threadId);
			expect(after.entries).toHaveLength(before.entries.length + 1);
			expect(after.entries.at(-1)?.id).toBe(entry.id);
		});

		it("refuses an empty message and an unknown thread with the documented strings", async () => {
			const api = await client();
			const before = await api.readThread(threadId);

			await expect(
				api.appendMessage({ threadId, text: "   \n " }),
			).rejects.toThrow("Message cannot be empty");
			await expect(
				api.appendMessage({ threadId: "no-such-thread", text: "Hi" }),
			).rejects.toThrow("Thread not found");

			const after = await api.readThread(threadId);
			expect(after.entries).toHaveLength(before.entries.length);
		});

		it("treats a replayed idempotency key as the same commit", async () => {
			const api = await client();
			const input: AppendMessageInput = {
				threadId,
				text: "Posted once, retried twice.",
				idempotencyKey: `${label}-conformance-key`,
			};

			const first = await api.appendMessage(input);
			const replay = await api.appendMessage(input);

			expect(replay.id).toBe(first.id);
			expect(replay.seq).toBe(first.seq);
			// Counted, not trusted: the thread holds the words exactly once.
			const after = await api.readThread(threadId);
			expect(
				after.entries.filter((entry) => entry.text === input.text),
			).toHaveLength(1);
		});

		it("appends exactly one entry when two calls are in flight with the same key", async () => {
			// The other guard, and 05's criteria list them separately because one sentence cannot
			// describe both. A **retry** replays a key deliberately, after a failure the caller
			// noticed; a **double submit** is two calls that are both in flight before either
			// resolves — a nervous second click, or a slow connection. An implementation can have
			// either without the other, and the idempotency check being *before* validation (02b) is
			// what makes the concurrent case work rather than racing.
			//
			// The key is supplied here because it is what the composer will supply: one key per draft,
			// minted when the draft becomes sendable, so a second click sends the same key rather than
			// a second intent. The route seam asserts the click; this asserts the mechanism under it.
			const api = await client();
			const before = await api.readThread(threadId);
			const text = "Submitted once, clicked twice.";
			const idempotencyKey = `${label}-in-flight-key`;

			const [first, second] = await Promise.all([
				api.appendMessage({ threadId, text, idempotencyKey }),
				api.appendMessage({ threadId, text, idempotencyKey }),
			]);

			// Both callers get the same commit, not one commit and one error: a second click on a
			// send that is already in flight must not surface a failure to the reader.
			expect(second.id).toBe(first.id);
			expect(second.seq).toBe(first.seq);
			const after = await api.readThread(threadId);
			expect(after.entries.length - before.entries.length).toBe(1);
			expect(after.entries.filter((entry) => entry.text === text)).toHaveLength(
				1,
			);
		});

		it("simulates an incoming entry from an agent on the board, at a real position", async () => {
			const api = await client();
			const before = await api.readThread(threadId);

			const entry = await api.simulateIncoming(threadId);

			expect(entry.seq).toBe(before.entries.length + 1);
			// The author is chosen server-side from the board's agent members: the caller
			// cannot say which agent speaks, so authorship never becomes the caller's claim.
			expect(entry.authorId).not.toBe(actor);
			const members = await api.listMembers(boardId);
			expect(members.find((member) => member.id === entry.authorId)?.kind).toBe(
				"agent",
			);
		});
	});

	describe(`creating boards, threads and resources (${label})`, () => {
		it("creates a board that opens empty and carries a mark of its own", async () => {
			const api = await client();
			const created = await api.createBoard({
				name: "Customer portal",
				description: "What belongs in this board?",
			} satisfies CreateBoardInput);

			expect(created.name).toBe("Customer portal");
			// The prototype derives the mark from the name and defaults the hue (app.js L116),
			// so a board made through the app renders like a seeded one.
			expect(created.short).toBe("C");
			expect(["sage", "ochre", "lavender", "blue"]).toContain(created.theme);
			// A newly created board opens immediately with an empty state rather than a blank.
			expect(await api.listThreads(created.id)).toEqual([]);
		});

		it("creates a thread ready to post into", async () => {
			const api = await client();
			const created = await api.createThread({
				boardId,
				title: "API versioning decisions",
				description: "A short reason for starting this conversation",
			} satisfies CreateThreadInput);

			expect(created.title).toBe("API versioning decisions");
			expect(created.boardId).toBe(boardId);
			expect(
				(await api.listThreads(boardId)).some(
					(thread) => thread.id === created.id,
				),
			).toBe(true);
			// Creating and writing are one continuous act, so the thread exists before it has
			// contents rather than appearing on first post.
			expect(await api.readThread(created.id)).toEqual({
				thread: created,
				entries: [],
			});
		});

		it("adds a resource to a board without copying its content into any thread", async () => {
			const api = await client();
			const created = await api.addResource({
				boardId,
				name: "Architecture notes",
				url: "https://example.com/document",
				description: "What is this resource for?",
			});

			expect(created.boardId).toBe(boardId);
			expect(created.url).toBe("https://example.com/document");
			expect(
				(await api.listResources(boardId)).some(
					(resource) => resource.id === created.id,
				),
			).toBe(true);
			// Every entry in every thread still holds a resource id and never a copy of its
			// heading, description or url.
			const contents = await api.readThread(threadId);
			for (const entry of contents.entries) {
				for (const reference of entry.references) {
					expect(Object.keys(reference)).toEqual(["resourceId"]);
				}
			}
		});
	});

	describe(`the acts this build cannot write yet (${label})`, () => {
		// These three are on the interface because establishing its shape is this ticket's
		// job; the entry-writing path reaches 10a. The rule is 06a's: an absent feature must
		// fail loudly rather than read as a pass, so the suite asserts the failure and names
		// the ticket. When 10a lands these become success-path assertions — the intended
		// alarm, not an inconvenience.
		it("fails loudly on attachResource, moveStatus and acknowledge until 10a", async () => {
			const api = await client();

			await expect(
				api.attachResource({
					threadId,
					resourceId: (await api.listResources(boardId))[0]?.id as ResourceId,
				}),
			).rejects.toThrow(/10a/);
			await expect(
				api.moveStatus({ threadId, from: "open", to: "resolved" }),
			).rejects.toThrow(/10a/);
			await expect(api.acknowledge({ threadId, upTo: 1 })).rejects.toThrow(
				/10a/,
			);
		});
	});

	describe(`positions (${label})`, () => {
		it("reads each principal's position, on three watermarks", async () => {
			const api = await client();
			const positions = await api.readPositions(threadId);

			expect(positions.length).toBeGreaterThan(0);
			expect(positions.some((position) => position.principalId === actor)).toBe(
				true,
			);
			expectTypeOf<
				PrincipalPosition["watermarks"]
			>().toEqualTypeOf<Watermarks>();
			for (const position of positions) {
				expect(Object.keys(position.watermarks).sort()).toEqual([
					"acknowledged",
					"cursor",
					"seen",
				]);
			}
			// Every thread has a position for every principal, and a second thread's are its
			// own: reading one thread does not mark another as caught up.
			const other = await api.readPositions(otherThreadId);
			expect(other.map((position) => position.principalId)).toEqual(
				positions.map((position) => position.principalId),
			);
		});

		it("advances the reader's own seen watermark when it reads, and nobody else's", async () => {
			const api = await client();
			const before = await api.readPositions(threadId);
			const otherBefore = before.find(
				(position) => position.principalId === subject.otherPrincipalId,
			);

			await api.readThread(threadId);

			const after = await api.readPositions(threadId);
			const mine = after.find((position) => position.principalId === actor);
			expect(mine?.watermarks.seen).toBe(
				(await api.readThread(threadId)).entries.length,
			);
			// The other principal is where it was: neither can advance the other's position.
			expect(
				after.find(
					(position) => position.principalId === subject.otherPrincipalId,
				),
			).toEqual(otherBefore);
		});
	});

	describe(`the connection (${label})`, () => {
		it("reports a stream state derived from the cursor, and pauses nothing on the server", async () => {
			const api = await client();
			const live = await api.setConnection({ connected: true });

			expectTypeOf<
				Awaited<ReturnType<RelayboardClient["setConnection"]>>
			>().toEqualTypeOf<StreamState>();
			expect(live.connected).toBe(true);
			expect(live.pending).toBe(0);
			// `setConnection` is a no-op over the transport: pause is the reader's own state
			// and delivery belongs to the stream (11b:17), so the call is always answerable
			// and changes nothing a participant could observe.
			expect(await api.setConnection({ connected: false })).toEqual(live);
		});
	});
};
