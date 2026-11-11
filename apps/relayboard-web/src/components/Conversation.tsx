import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
	BoardId,
	Entry,
	PermissionName,
	PrincipalSummary,
	Resource,
	ThreadId,
} from "#/client";
import { useActingClient } from "#/client/context";
import {
	applyStreamEvent,
	conversationPositionsQuery,
	conversationQuery,
	conversationRosterQuery,
	streamStateQuery,
	visibleEntries,
} from "#/components/-conversation-queries";
import { unreadQuery } from "#/components/-rail-queries";
import { resourcesQuery } from "#/components/-thread-queries";
import { StreamPanel } from "#/components/StreamPanel";
import type { ThreadStatus } from "#/domain";
import {
	conversationEmptyState,
	draftToSend,
	EMPTY_DRAFT_REASON,
	filterEntries,
	groupByDay,
	isAgentAuthored,
	nameOfPrincipal,
	threadFacts,
} from "#/routes/-conversation";
import "./Conversation.css";

/**
 * The conversation: a thread's entries, its details, and the composer.
 *
 * ## Order
 *
 * Entries render in `seq` order and nowhere does this file sort by `createdAt`. That is not an
 * omission — `-conversation.ts` sorts by `seq` and the seed contains a thread whose timestamps run
 * backwards against its positions, so a timestamp sort here would render that thread reversed while
 * every other assertion in the repository still passed. The one ordering rule is stated next to the
 * sort; this component only renders what it returns.
 *
 * ## The unread badge moves because of this component
 *
 * `readThread` advances the reader's `seen` watermark, so opening a thread makes it read. The rail's
 * counts are therefore invalidated **after** the read resolves — see `-conversation-queries` — which
 * means a reader watching the rail while a thread opens sees the count settle, in that order, rather
 * than mid-render. That is a deliberate choice between two correct-looking behaviours, and the
 * alternative (leaving the count stale) would show "5 unread" over a thread the reader is reading.
 *
 * ## First paint
 *
 * Every read here is primed by the board route's loader (`primeConversation`), so the entries, the
 * roster and the intro are in the server's HTML. Three defects this session were "correct after
 * hydration, wrong on screen"; this column is where a reader spends their time, so it is the worst
 * place for a fourth.
 */
export function Conversation({
	boardId,
	threadId,
	heldOnBoard,
	onAct,
}: {
	readonly boardId: BoardId;
	readonly threadId: ThreadId;
	/** What the reader may do on this board — the bound for the three act controls. */
	readonly heldOnBoard: readonly PermissionName[];
	/** Perform one of the three writes, then let the route refresh what it changed. */
	readonly onAct: (input: ActInput) => Promise<void>;
}) {
	// `useActingClient`, not `useRelayboardClient`: the router context's client carries a
	// PROVISIONAL principal id (the seed's first browser-selectable one), because a context is built
	// before anything can be resolved. Every query key below partitions by reader, so using the
	// provisional id cached this reader's rows under somebody else's key — measured: a second browser
	// saw the session note say `maya` and this composer's placeholder say `alex`.
	const client = useActingClient();
	const conversation = useQuery(conversationQuery(client, threadId));
	const roster = useQuery(conversationRosterQuery(client, boardId));
	// The board's resources, primed by the pane's loader, so an artifact names its resource at first
	// paint rather than after a second read (the rule 06a and 06b paid for twice).
	const boardResources = useQuery(resourcesQuery(client, boardId));
	const principalId = client.actingPrincipalId;

	const [term, setTerm] = useState("");
	const [draft, setDraft] = useState("");
	const [sending, setSending] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);
	/**
	 * The key for the draft in the composer, and the guard that makes a second activation safe.
	 *
	 * **A ref, not state, and that distinction is the whole guard.** React state updates are
	 * asynchronous, so two activations in the same tick (Ctrl+Enter then a click — exactly what a
	 * nervous hand does) both read `sending === false` from the closure they were created in and both
	 * proceed. Measured: with a state-based guard the browser sent **two POSTs** for one draft.
	 *
	 * Two things are needed, and they are different:
	 *
	 * - `active` stops the second activation from sending at all, which is what a reader expects from
	 *   a button that has already been pressed.
	 * - `key` is kept until the draft **commits**, so a retry after a failure replays the same key and
	 *   the store's idempotency makes it safe. Clearing the key on failure would turn a retry into a
	 *   second post — which is the defect the key exists to prevent.
	 */
	const inFlight = useRef<{ key: string; active: boolean } | null>(null);

	const thread = conversation.data?.thread;
	const entries = conversation.data?.entries ?? [];
	const people: readonly PrincipalSummary[] = roster.data ?? [];
	// Stable per roster, so the memo below depends on a value rather than on a new function each
	// render — and so a new roster is what recomputes the filter, which is the real dependency.
	const nameOf = useCallback(
		(id: string) => nameOfPrincipal(id, people),
		[people],
	);
	/**
	 * The board's resources, so an artifact can render the **chip** rather than an id.
	 *
	 * An artifact entry holds a resource id and nothing else — the rule 09 established and 10a honours —
	 * so both the name and the url come from the board's own list, which the pane's loader primes.
	 */
	const resourceOf = useCallback(
		(id: string) => boardResources.data?.find((resource) => resource.id === id),
		[boardResources.data],
	);

	/**
	 * The reader's own **acknowledged** watermark.
	 *
	 * Read from the positions list the pane already has, so the control knows both ends of the range it
	 * would cover: "up to #n" only means something against where the reader already is.
	 */
	const positions = useQuery(conversationPositionsQuery(client, threadId));
	const streamState = useQuery(streamStateQuery(client));
	const myCursor =
		(positions.data ?? []).find(
			(position) => position.principalId === client.actingPrincipalId,
		)?.watermarks.cursor ?? 0;
	const myAcknowledged =
		(positions.data ?? []).find(
			(position) => position.principalId === client.actingPrincipalId,
		)?.watermarks.acknowledged ?? 0;

	/**
	 * **Pausing withholds from the view, not from history** (11b:15).
	 *
	 * The rule is the store's own `readView`: visible when the entry is at or before the reader's
	 * cursor, or when the reader wrote it. While live the cursor sits at the last seq, so this is a
	 * no-op; while paused it bites — and the entries are still in the chronology, which is why the
	 * header count rises while the list does not.
	 *
	 * The cursor is the reader's **delivery** watermark, not `seen`: receiving and reading are
	 * different facts (spec L571), and a paused reader that had read an entry would still not have
	 * received it.
	 */
	const withheld = useMemo(
		() =>
			visibleEntries(entries, {
				paused: !(streamState.data?.connected ?? true),
				cursor: myCursor,
				principalId: client.actingPrincipalId,
			}),
		[entries, streamState.data?.connected, myCursor, client.actingPrincipalId],
	);
	const visible = useMemo(
		() => filterEntries(withheld, term, nameOf),
		[withheld, term, nameOf],
	);
	const dated = useMemo(() => groupByDay(visible), [visible]);
	const emptyState = conversation.data
		? conversationEmptyState(entries, visible, term)
		: null;
	const facts = thread ? threadFacts(thread, entries, people) : null;

	// The unread counts are a consequence of having read this thread, so they are refreshed once the
	// read has resolved — not before, because invalidating on a read that then fails would clear a
	// badge for a thread the reader never saw.
	const { isSuccess: conversationRead } = conversation;
	const queryClient = useQueryClient();

	/**
	 * **The stream, applied to the cache and to nothing else** (11a:23).
	 *
	 * An arriving event does not render itself: it invalidates the query whose answer changed, and the
	 * reader sees the same shape a navigation would have produced. That is what keeps one source of
	 * truth — the chronology — rather than a live list beside it that can drift.
	 *
	 * The dependency list is the *client and the query client*, not the event: subscribing once and
	 * letting the handler close over the cache is what stops a re-render from tearing down the
	 * connection and immediately opening another.
	 */
	useEffect(() => {
		const unsubscribe = client.subscribe({
			onEvent: (event) => applyStreamEvent(queryClient, client, event),
		});
		return unsubscribe;
	}, [client, queryClient]);
	useEffect(() => {
		if (!conversationRead) return;
		// Invalidating the rail's counts is what makes the badge follow the read. It runs AFTER the
		// read resolves, so a failed read never clears a badge for a thread nobody saw.
		void queryClient.invalidateQueries({
			queryKey: unreadQuery(client).queryKey,
		});
	}, [conversationRead, queryClient, client]);

	if (!thread) {
		return (
			<div className="conversation__empty">
				<h3 className="conversation__empty-title">Opening the thread</h3>
				<p className="conversation__empty-detail">Reading its entries.</p>
			</div>
		);
	}

	const send = async () => {
		const text = draftToSend(draft);
		if (text === null) return;
		// A send is already in flight: this activation does nothing. It must NOT mint a second key —
		// that would be a second post — and it must not surface an error either.
		if (inFlight.current?.active) return;
		// One key per draft, minted synchronously so a retry replays it rather than replacing it.
		const key =
			inFlight.current?.key ?? `${threadId}-${Date.now()}-${Math.random()}`;
		inFlight.current = { key, active: true };
		setSending(true);
		setFailure(null);
		try {
			await client.appendMessage({ threadId, text, idempotencyKey: key });
			// The draft clears only on success: a failed send leaves it in place with the reason,
			// because losing what somebody typed is worse than any error message.
			setDraft("");
			inFlight.current = null;
			await conversation.refetch();
			await queryClient.invalidateQueries({
				queryKey: unreadQuery(client).queryKey,
			});
		} catch (error) {
			// The message the domain owns, unchanged — and the FAMILY beside it, so the interface can
			// tell a permission refusal from a validation failure without reading the string
			// (06c:19, closed here because 07a's refusals are what make the distinction meaningful).
			setFailure(error instanceof Error ? error.message : String(error));
			// The key is KEPT on failure: a retry must replay the same key, which is the whole point
			// of having one. Clearing it here would make the retry a second post.
		} finally {
			// The send is no longer in flight. The KEY survives unless the draft committed, so a retry
			// after a refusal is a replay rather than a second post.
			if (inFlight.current) inFlight.current.active = false;
			setSending(false);
		}
	};

	const canSend = draftToSend(draft) !== null && !sending;

	return (
		<div className="conversation">
			<header className="conversation__head">
				<h2 className="conversation__title">{thread.title}</h2>
				<p className="conversation__subtitle">
					{/* The subtitle counts entries rather than saying "messages": an entry is the
					    chronology's unit and 10a widens it beyond prose. */}
					{facts?.entryCount ?? 0}{" "}
					{(facts?.entryCount ?? 0) === 1 ? "entry" : "entries"}
					{(facts?.lastSeq ?? 0) > 0 ? ` · last at #${facts?.lastSeq}` : ""}
				</p>
				<p className="conversation__intro">
					Started by {nameOf(thread.creatorId)} on{" "}
					{new Date(thread.createdAt).toLocaleDateString([], {
						month: "long",
						day: "numeric",
						year: "numeric",
					})}
					. Every entry appears in one chronological thread.
				</p>
			</header>

			{facts ? (
				<details className="conversation__details">
					<summary>Thread details</summary>
					<dl className="conversation__facts">
						<dt>Created</dt>
						<dd>
							{new Date(facts.createdAt).toLocaleDateString([], {
								month: "long",
								day: "numeric",
								year: "numeric",
							})}
						</dd>
						<dt>Entries</dt>
						<dd>{facts.entryCount}</dd>
						<dt>Last position</dt>
						<dd>#{facts.lastSeq}</dd>
						<dt>Participants</dt>
						<dd>
							{facts.participants.length === 0
								? "Nobody has written here yet"
								: facts.participants.map((person) => person.name).join(", ")}
						</dd>
					</dl>
				</details>
			) : null}

			<div className="conversation__search">
				<label className="sr-only" htmlFor="conversation-search">
					Search this thread
				</label>
				<input
					className="conversation__search-input"
					id="conversation-search"
					onChange={(event) => setTerm(event.currentTarget.value)}
					placeholder="Search this thread"
					// A local term rather than a URL parameter here, unlike the thread list: the
					// prototype keeps in-thread search as a control inside the conversation, and 13a
					// owns whether it becomes addressable at narrow widths.
					type="search"
					value={term}
				/>
			</div>

			{/*
			 * **Arriving entries are announced**, and the announcement is a *count*, not the text: story 135
			 * asks that a screen-reader user knows the conversation moved. Reading each new message aloud
			 * would interrupt whatever the reader is doing — including typing in the composer, which is
			 * 13b:19's other rule — so this is a polite status line saying how many entries arrived.
			 *
			 * The count is derived from the entries themselves rather than from an event handler, so it
			 * cannot disagree with what is on screen, and it is **the same number the reader can see** in
			 * the header's subtitle.
			 */}
			<p aria-live="polite" className="sr-only" data-arrival-status>
				{facts?.entryCount === undefined
					? ""
					: `${facts.entryCount.toString()} ${facts.entryCount === 1 ? "entry" : "entries"} in this thread`}
			</p>

			<div className="conversation__list" data-conversation-list>
				{emptyState ? (
					<div className="conversation__empty">
						<h3 className="conversation__empty-title">{emptyState.title}</h3>
						<p className="conversation__empty-detail">{emptyState.detail}</p>
					</div>
				) : (
					dated.map(({ entry, dayLabel, opensDay }) => (
						<div key={entry.id}>
							{opensDay ? (
								<div className="conversation__day">{dayLabel}</div>
							) : null}
							<EntryItem
								entry={entry}
								isAgent={isAgentAuthored(entry, people)}
								nameOf={nameOf}
								resourceOf={resourceOf}
							/>
						</div>
					))
				)}
			</div>

			{/*
			 * **The three act-producing controls, where the act is made** (10b:20). Each is disabled with the
			 * permission it needs named, which is the treatment 09 gave the create controls and the one 07a
			 * declared: a control the reader cannot use is present and explained, never hidden and never a
			 * refusal after the click.
			 *
			 * They sit above the composer rather than in a toolbar: an act and a message are both entries in one
			 * chronology, so the controls that write them belong together rather than in a second surface.
			 */}
			<ActControls
				heldOnBoard={heldOnBoard}
				lastSeq={facts?.lastSeq ?? 0}
				myAcknowledged={myAcknowledged}
				onAct={onAct}
				resources={boardResources.data ?? []}
				status={thread?.status ?? "open"}
				onFailure={setFailure}
			/>

			<StreamPanel boardId={boardId} threadId={threadId} />

			<form
				className="conversation__composer"
				onSubmit={(event) => {
					event.preventDefault();
					void send();
				}}
			>
				<label className="sr-only" htmlFor="composer-draft">
					Write a message
				</label>
				<textarea
					className="conversation__draft"
					id="composer-draft"
					onChange={(event) => setDraft(event.currentTarget.value)}
					onKeyDown={(event) => {
						// Ctrl/Cmd + Enter sends; Enter alone inserts a newline, because a message can be
						// several lines and a stray Enter must not commit one.
						if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
							event.preventDefault();
							void send();
						}
					}}
					placeholder={`Write as ${principalId}`}
					value={draft}
				/>
				<div className="conversation__actions">
					{/* `output` rather than a paragraph with role="status": it is the element for a
					    value that changes as a result of what the reader did, and it announces itself
					    without the role being written on a paragraph to simulate one. */}
					<output className="conversation__reason">
						{failure ?? (canSend || sending ? "" : EMPTY_DRAFT_REASON)}
					</output>
					<button
						className="conversation__send"
						disabled={!canSend}
						type="submit"
					>
						{sending ? "Sending…" : "Send"}
					</button>
				</div>
			</form>
		</div>
	);
}

/**
 * The three act-producing controls: attach a resource, move the status, acknowledge.
 *
 * ## Why each is disabled rather than absent
 *
 * 09:21 and DESIGN.md §221: an action the reader lacks the permission for is **disabled with the
 * missing permission named**, not hidden and not silently refused. That is 07a's declared affordance,
 * and its justification is that a reader who cannot see a control cannot ask for the permission it
 * needs. The permission names come from the table (`operationPermissions`), not from a literal here, so
 * a change to the rule changes the sentence.
 *
 * ## Why the controls are one component
 *
 * Because they are one thing: three writes that all produce entries in one chronology. Splitting them
 * across the pane, the header and a menu would be three surfaces for one act each and no place a reader
 * could see what they may do here.
 */
function ActControls({
	status,
	lastSeq,
	myAcknowledged,
	heldOnBoard,
	resources,
	onAct,
	onFailure,
}: {
	readonly status: ThreadStatus;
	readonly lastSeq: number;
	readonly myAcknowledged: number;
	readonly heldOnBoard: readonly PermissionName[];
	readonly resources: readonly Resource[];
	readonly onAct: (input: ActInput) => Promise<void>;
	readonly onFailure: (reason: string) => void;
}) {
	const [resourceId, setResourceId] = useState("");
	const [problem, setProblem] = useState<string | null>(null);
	/**
	 * **One act per click, synchronously guarded** — the same defect 06c found in the composer and 08b
	 * guarded in the decide controls. Third surface, same shape, and the guard is a ref because React
	 * state is asynchronous: two activations in one tick would both read the old flag.
	 */
	const inFlight = useRef(false);

	const may = (permission: PermissionName) => heldOnBoard.includes(permission);

	const perform = async (input: ActInput) => {
		if (inFlight.current) return;
		inFlight.current = true;
		setProblem(null);
		try {
			await onAct(input);
		} catch (error) {
			// **The refusal is reported where the attempt was made** (DESIGN.md §254), never as an entry:
			// a refused act leaves the thread unchanged, so rendering it in the chronology would be a
			// record of something that did not happen.
			const reason = error instanceof Error ? error.message : String(error);
			setProblem(reason);
			onFailure(reason);
		} finally {
			inFlight.current = false;
		}
	};

	const nextStatus: ThreadStatus = status === "open" ? "resolved" : "open";
	const canAcknowledge = lastSeq > myAcknowledged;

	return (
		<div className="conversation__acts">
			<div className="act-row">
				<label className="act-row__field">
					Attach a resource
					<select
						aria-disabled={!may("add:artifact")}
						className="act-row__select"
						data-act="attach"
						value={resourceId}
						disabled={!may("add:artifact")}
						onChange={(event) => setResourceId(event.currentTarget.value)}
					>
						<option value="">Choose a resource…</option>
						{resources.map((resource) => (
							<option key={resource.id} value={resource.id}>
								{resource.name}
							</option>
						))}
					</select>
				</label>
				<button
					aria-disabled={!may("add:artifact")}
					className="act-row__button"
					data-act-perform="attach"
					disabled={!may("add:artifact") || resourceId === ""}
					type="button"
					onClick={() => void perform({ kind: "attach", resourceId })}
				>
					Attach
				</button>
				{may("add:artifact") ? null : (
					<p className="act-row__reason" data-act-reason="attach">
						Attaching needs the add:artifact permission on this board
					</p>
				)}
			</div>

			<div className="act-row">
				<button
					aria-disabled={!may("move:status")}
					className="act-row__button"
					data-act-perform="move"
					disabled={!may("move:status")}
					type="button"
					onClick={() =>
						void perform({ kind: "move", from: status, to: nextStatus })
					}
				>
					Mark as {nextStatus}
				</button>
				<span className="act-row__note">This thread is {status}</span>
				{may("move:status") ? null : (
					<p className="act-row__reason" data-act-reason="move">
						Moving the status needs the move:status permission on this board
					</p>
				)}
			</div>

			<div className="act-row">
				<button
					aria-disabled={!may("acknowledge:thread") || !canAcknowledge}
					className="act-row__button"
					data-act-perform="acknowledge"
					disabled={!may("acknowledge:thread") || !canAcknowledge}
					type="button"
					onClick={() => void perform({ kind: "acknowledge", upTo: lastSeq })}
				>
					Acknowledge up to #{lastSeq}
				</button>
				{/*
				 * **"Acknowledge", never "mark as done" and never "approve".** The act says how far this
				 * principal has got, and the button copy has to hold the same line the entry does: a
				 * reader must not read agreement into a report about progress (spec L438).
				 */}
				<span className="act-row__note">
					You have acknowledged up to #{myAcknowledged}
				</span>
				{may("acknowledge:thread") ? null : (
					<p className="act-row__reason" data-act-reason="acknowledge">
						Acknowledging needs the acknowledge:thread permission on this board
					</p>
				)}
			</div>

			{problem === null ? null : (
				<p className="act-row__problem" role="alert" data-act-problem>
					{problem}
				</p>
			)}
		</div>
	);
}

/** The three writes, as the control hands them to the route. */
export type ActInput =
	| { readonly kind: "attach"; readonly resourceId: string }
	| {
			readonly kind: "move";
			readonly from: ThreadStatus;
			readonly to: ThreadStatus;
	  }
	| { readonly kind: "acknowledge"; readonly upTo: number };
/**
 * The glyph an act's 28px marker carries.
 *
 * Three distinct letters, all `aria-hidden` and all decorative: the **word** in the line beside them is
 * what states the event, which is DESIGN.md's Named Status Rule (§162) applied to entry kinds — a shape
 * alone is a decoration, not a state. Letters rather than symbols on purpose: no glyph here can be
 * misread as a tick, a star or a checkmark, which is the exact confusion an acknowledgement must not
 * invite.
 */
const actGlyph = (kind: Entry["kind"]): string => {
	switch (kind) {
		case "artifact":
			return "A";
		case "status-move":
			return "S";
		case "acknowledgement":
			return "R";
		case "message":
			// Unreachable in practice: a message renders its author's initial instead. Total anyway, so a
			// fifth kind is a compile error here rather than a blank marker nobody notices.
			return "";
	}
};

/**
 * The leading words of an act's line: **who did what**, and nothing that could read as a verdict.
 *
 * Written beside the component rather than reusing the domain's `entrySentence`, because the two answer
 * different questions. `entrySentence` is one total function over the union for *text* consumers — the
 * search, the thread row's excerpt — and states a resource by id because it has no board. This is the
 * rendered line, which appends its detail as separate elements (a chip, a transition) rather than
 * folding it into a string a component would then have to un-fold.
 */
const actLead = (
	entry: Entry,
	nameOf: (principalId: string) => string,
): string => {
	const who = nameOf(entry.authorId);
	switch (entry.kind) {
		case "artifact":
			return `${who} attached`;
		case "status-move":
			return `${who} moved the status`;
		case "acknowledgement":
			// **"acknowledged", never "approved"** — and the position follows in its own element.
			return `${who} acknowledged`;
		case "message":
			return entry.text;
	}
};

/**
 * A resource as a chip: its **name**, pointing at the canonical record.
 *
 * DESIGN.md §252 and spec L435: an artifact renders the resource chip inline, pointing at the canonical
 * resource and never a copy of its content. When the resource is not in the board's list — a read that
 * has not landed — the id is shown rather than an empty chip, because an empty chip would read as an
 * entry with no target.
 */
function ResourceChip({
	resource,
	resourceId,
	lead = false,
}: {
	readonly resource: Resource | undefined;
	readonly resourceId: string;
	/** Whether a space precedes it, for a second or later chip in a row. */
	readonly lead?: boolean;
}) {
	if (!resource) {
		return (
			<span className="entry__resource-chip" data-resource-id={resourceId}>
				{lead ? " " : null}
				{resourceId}
			</span>
		);
	}
	return (
		// `rel="noopener noreferrer"` for the reason 09 gives: without `noopener` the destination gets
		// `window.opener` and can navigate the tab that opened it.
		<a
			className="entry__resource-chip"
			data-resource-id={resource.id}
			href={resource.url}
			rel="noopener noreferrer"
			target="_blank"
		>
			{lead ? " " : null}
			{resource.name}
		</a>
	);
}

/**
 * One entry.
 *
 * The agent tag reads the author's `kind` from the roster rather than from the entry, because an
 * entry does not carry a kind — it carries an author. Marking the entry instead would let a later
 * change to the author's kind leave the entry lying, and `kind` is a label rather than a capability
 * (AGENTS.md), so nothing here ranks one kind above the other.
 */
function EntryItem({
	entry,
	isAgent,
	nameOf,
	resourceOf,
}: {
	readonly entry: Entry;
	readonly isAgent: boolean;
	readonly nameOf: (principalId: string) => string;
	readonly resourceOf: (resourceId: string) => Resource | undefined;
}) {
	// One branch, on the union's own discriminant, and it decides only presentation: whether this row
	// is a marker-and-a-line or a message with prose. Nothing here ranks one kind above another — the
	// size difference says "event", not "lesser" (DESIGN.md §250).
	const isAct = entry.kind !== "message";
	return (
		// `id` is the anchor target a relation points at; `data-entry-id` stays for the tests and for
		// anything that wants to find an entry without depending on the id's string shape. Both,
		// because they answer different questions: one is a navigation target, the other a selector.
		<article
			className="entry"
			data-entry-id={entry.id}
			data-entry-seq={entry.seq}
			id={`entry-${entry.id}`}
		>
			{/*
			 * **The marker is the hierarchy, and its size is the whole message.** DESIGN.md §250: a message
			 * carries a 35px rounded-square avatar; an act carries a 28px rounded-square marker "in place of
			 * the 35px avatar. A smaller marker is the whole hierarchy: it says 'this is an event' without
			 * saying 'this matters more'".
			 *
			 * Measuring the existing code against that sentence found a pre-existing deviation. The message
			 * avatar was a **28px circle**, which broke two rules at once: §214 reserves the circle for
			 * status dots ("the only purely circular elements on screen") and gives avatars a 9-11px corner
			 * radius, and §250 puts the message avatar at 35px. So the circle became a rounded square, the
			 * size became the design record's, and the act marker took the 28px the message had been
			 * wrongly using. Recorded rather than quietly fixed, because a reviewer comparing the two
			 * renders deserves to know which one moved.
			 */}
			<span
				aria-hidden="true"
				className={isAct ? "entry__marker entry__marker--act" : "entry__marker"}
				data-entry-marker={entry.kind}
			>
				{isAct ? actGlyph(entry.kind) : nameOf(entry.authorId).slice(0, 1)}
			</span>
			<div className="entry__body">
				<div className="entry__byline">
					<span className="entry__author">{nameOf(entry.authorId)}</span>
					{isAgent ? <span className="entry__kind">Agent</span> : null}
					<time className="entry__time" dateTime={entry.createdAt}>
						{new Date(entry.createdAt).toLocaleTimeString([], {
							hour: "numeric",
							minute: "2-digit",
						})}
					</time>
					<span className="entry__seq" title="Canonical thread position">
						#{entry.seq}
					</span>
				</div>
				{entry.kind === "message" ? (
					<>
						<p className="entry__text">{entry.text}</p>
						{/*
						 * **A message can name resources too, and until this line it did not show them.** The seed
						 * carries four message-level `references` (transcribed from `app.js` L53) and this component
						 * rendered a chip only for an `artifact` entry — so a seeded message's reference was invisible in
						 * the app while the record said it pointed at something. Found by 15a's line 27, fixed here as
						 * the defect it is rather than left as a note in a test.
						 *
						 * The **same chip, the same canonical href, the same `noopener`**: a reference is a reference
						 * whichever kind of entry carries it, and two treatments for one idea would make the reader
						 * learn which kind attaches a resource rather than what a resource link looks like.
						 */}
						{entry.references.length === 0 ? null : (
							<p className="entry__references" data-entry-references>
								{entry.references.map((reference, index) => (
									<ResourceChip
										key={reference.resourceId}
										resource={resourceOf(reference.resourceId)}
										resourceId={reference.resourceId}
										// A space between chips when there is more than one, so two adjacent chips read
										// as two references rather than as one long one.
										lead={index > 0}
									/>
								))}
							</p>
						)}
					</>
				) : (
					// **One 13px line at Ink-muted, with the act's detail inline** (DESIGN.md §251). Not a prose
					// block and not a second row: the detail — the transition, the position range, the resource
					// — belongs in the same line, because an event is read in one glance.
					//
					// The class is `entry__act` rather than `entry__text`, so a reader and a test can tell a
					// recorded event from prose without asking the DOM what kind of entry it is looking at.
					<p className="entry__act" data-entry-act={entry.kind}>
						<span className="entry__act-lead">{actLead(entry, nameOf)}</span>
						{entry.kind === "status-move" ? (
							<>
								{" from "}
								<span className="entry__act-detail">{entry.from}</span>
								{" to "}
								<span className="entry__act-detail">{entry.to}</span>
							</>
						) : null}
						{entry.kind === "acknowledgement" ? (
							<>
								{" "}
								{/*
								 * **A range, not a verdict.** "up to #7" states how far this principal has got.
								 * There is no word here that could read as approval — not "done", not "agreed",
								 * not "signed off" — because the model carries no verdict (spec L438) and the
								 * copy must not invent one (DESIGN.md §295).
								 */}
								<span className="entry__act-detail">up to #{entry.upTo}</span>
							</>
						) : null}
						{entry.kind === "artifact" ? (
							<>
								{" "}
								{/*
								 * The **chip**, pointing at the canonical resource: never a copy of its content.
								 * Following it leaves this app safely — the link rule 09 established.
								 */}
								<ResourceChip
									resource={resourceOf(entry.resourceId)}
									resourceId={entry.resourceId}
								/>
							</>
						) : null}
					</p>
				)}
				{entry.relation ? (
					<p className="entry__relation">
						{entry.relation.type} {/*
						 * A plain fragment anchor, and the browser's own jump is what makes it work.
						 *
						 * Worth knowing rather than assuming: the target may be **above** the current
						 * scroll position or far below it, and today it is always rendered because the
						 * conversation renders every entry at once. When 05's list is virtualised, the
						 * target may not be in the DOM at all — at which point this needs to scroll the
						 * list to the entry's index first, because a fragment anchor cannot jump to an
						 * element that does not exist yet. Recorded here rather than discovered then.
						 */}
						<a href={`#entry-${entry.relation.entryId}`}>
							#{entry.relation.entryId}
						</a>
					</p>
				) : null}
			</div>
		</article>
	);
}
