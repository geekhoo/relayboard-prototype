import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardId, Entry, PrincipalSummary, ThreadId } from "#/client";
import { useActingClient } from "#/client/context";
import {
	conversationQuery,
	conversationRosterQuery,
} from "#/components/-conversation-queries";
import { unreadQuery } from "#/components/-rail-queries";
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
}: {
	readonly boardId: BoardId;
	readonly threadId: ThreadId;
}) {
	// `useActingClient`, not `useRelayboardClient`: the router context's client carries a
	// PROVISIONAL principal id (the seed's first browser-selectable one), because a context is built
	// before anything can be resolved. Every query key below partitions by reader, so using the
	// provisional id cached this reader's rows under somebody else's key — measured: a second browser
	// saw the session note say `maya` and this composer's placeholder say `alex`.
	const client = useActingClient();
	const conversation = useQuery(conversationQuery(client, threadId));
	const roster = useQuery(conversationRosterQuery(client, boardId));
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

	const visible = useMemo(
		() => filterEntries(entries, term, nameOf),
		[entries, term, nameOf],
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
							/>
						</div>
					))
				)}
			</div>

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
}: {
	readonly entry: Entry;
	readonly isAgent: boolean;
	readonly nameOf: (principalId: string) => string;
}) {
	return (
		<article
			className="entry"
			data-entry-id={entry.id}
			data-entry-seq={entry.seq}
		>
			<span aria-hidden="true" className="entry__avatar">
				{nameOf(entry.authorId).slice(0, 1)}
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
				<p className="entry__text">{entry.text}</p>
				{entry.relation ? (
					<p className="entry__relation">
						{entry.relation.type}{" "}
						<a href={`#entry-${entry.relation.entryId}`}>
							#{entry.relation.entryId}
						</a>
					</p>
				) : null}
			</div>
		</article>
	);
}
