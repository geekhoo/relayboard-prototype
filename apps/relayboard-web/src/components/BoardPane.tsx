import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type {
	BoardId,
	HeldPermissions,
	PrincipalSummary,
	Resource,
} from "#/client";
import { useRelayboardClient } from "#/client/context";
import {
	peopleQuery,
	resourcesQuery,
	threadRowsQuery,
} from "#/components/-thread-queries";
import { CreateAction, type CreateInput } from "#/components/CreateDialog";
import { Gatekeeper } from "#/components/Gatekeeper";
import { ParticipantPanel } from "#/components/ParticipantPanel";
import { ThreadList } from "#/components/ThreadList";
import { BOARD_VIEWS, type BoardView } from "#/routes/-board-search";
import { emptyStateFor, filterThreads } from "#/routes/-thread-list";
import "./BoardPane.css";

/**
 * The index pane: the board's header, its three views, and the controls each one needs.
 *
 * ## Every read here is primed by the route's loader
 *
 * The pane renders real product text on first paint, so a value that arrives after hydration is
 * visible as a *wrong* value first. Two defects in this project came from exactly that — the rail's
 * counts (06a) and the session note (06b) — so the rule is stated once, here: if the pane reads it
 * at first paint, the loader primes it. `primePane` primes all three views, not only the one the
 * URL names, because the tabs are links and a client-side tab switch does not run the loader.
 *
 * ## The thread is a search parameter
 *
 * Spec L543 makes the conversation a second *level* of the same board address rather than a second
 * route. Opening a thread is still a navigation — it changes the URL, which is the criterion — it
 * changes the search rather than the path. A thread id this board does not hold renders the
 * not-found state **inside the frame**, so a stale link is a recoverable place rather than a broken
 * page.
 */
export function BoardPane({
	boardId,
	name,
	description,
	view,
	query,
	unreadOnly,
	thread,
	heldPermissions,
	onCreate,
}: {
	readonly boardId: BoardId;
	readonly name: string;
	readonly description: string;
	readonly view: BoardView;
	readonly query: string;
	readonly unreadOnly: boolean;
	readonly thread: string;
	/** What the acting principal holds on this board — the gate's bound and its affordance. */
	/** What the reader may do on this board, and in the workspace: two lists, two questions. */
	readonly heldPermissions: HeldPermissions;
	/** Create a board, a thread or a resource, then open or list it. */
	readonly onCreate: (input: CreateInput) => Promise<void>;
}) {
	const navigate = useNavigate();
	const search = { view, q: query, unread: unreadOnly, thread };
	const go = (next: Partial<typeof search>) => {
		navigate({
			to: "/boards/$boardId",
			params: { boardId },
			search: { ...search, ...next },
		});
	};

	return (
		<div className="board-pane">
			<header className="board-pane__header">
				<h1 className="board-pane__title">{name}</h1>
				<p className="board-pane__description">{description}</p>
			</header>
			{/*
			 * The gatekeeper, in the frame rather than at a route (08b:22): opening it must not change
			 * the address, because the reader's place is the board they were on.
			 *
			 * `permissionsHeld` is the **bound**: what this reader may hand out here, which 07b's rule
			 * will enforce anyway. Computing it twice — once for the list of choices and once for the
			 * refusal — would let the two disagree, so it is one list and the rule decides at the write.
			 */}
			{/*
			 * The three create actions, each **disabled with the reason** when the grant is missing
			 * (09:21, DESIGN.md §221). This is the affordance 07a declared and could not exercise: the
			 * rule existed and nothing rendered it.
			 */}
			<div className="create-actions">
				<CreateAction
					allowed={heldPermissions.onBoard.includes("create:thread")}
					boardName={name}
					kind="thread"
					onSubmit={onCreate}
					required="create:thread"
				/>
				<CreateAction
					allowed={heldPermissions.onBoard.includes("add:resource")}
					kind="resource"
					onSubmit={onCreate}
					required="add:resource"
				/>
				<CreateAction
					allowed={heldPermissions.workspace.includes("create:board")}
					kind="board"
					onSubmit={onCreate}
					required="create:board"
				/>
			</div>
			<div className="board-pane__gate">
				<Gatekeeper
					boardId={boardId}
					canDecide={
						heldPermissions.onBoard.includes("admit:agent") ||
						heldPermissions.workspace.includes("admit:agent")
					}
					permissionsHeld={heldPermissions.onBoard.filter(
						(name) => name !== "admit:agent" && name !== "revoke:agent",
					)}
				/>
			</div>
			<nav aria-label="Board views" className="board-pane__views">
				{BOARD_VIEWS.map((candidate) => (
					<Link
						key={candidate}
						to="/boards/$boardId"
						params={{ boardId }}
						// A tab is a change of view, not a reset of the reader's place: the search
						// terms, the filter and the open thread all survive it.
						search={{ ...search, view: candidate }}
						aria-current={candidate === view ? "page" : undefined}
						className="board-pane__view"
					>
						{candidate}
					</Link>
				))}
			</nav>
			{view === "threads" ? (
				<ThreadsView
					boardId={boardId}
					query={query}
					unreadOnly={unreadOnly}
					activeThreadId={thread}
					onSearch={(next) => go({ q: next })}
					onToggleUnread={() => go({ unread: !unreadOnly })}
				/>
			) : view === "resources" ? (
				<ResourcesView boardId={boardId} />
			) : (
				<PeopleView boardId={boardId} threadId={thread} />
			)}
		</div>
	);
}

/**
 * The thread list and its two controls.
 *
 * Both controls write to the URL and read from it; neither keeps state of its own. That is what
 * makes a search survive a reload and keeps one source of truth for it — a local copy would be a
 * second source that can disagree with the address the reader can see.
 */
function ThreadsView({
	boardId,
	query,
	unreadOnly,
	activeThreadId,
	onSearch,
	onToggleUnread,
}: {
	readonly boardId: BoardId;
	readonly query: string;
	readonly unreadOnly: boolean;
	readonly activeThreadId: string;
	readonly onSearch: (next: string) => void;
	readonly onToggleUnread: () => void;
}) {
	const client = useRelayboardClient();
	const rows = useQuery(threadRowsQuery(client, boardId));
	const visible = filterThreads(rows.data ?? [], { query, unreadOnly });
	// An empty state is a claim about the board, so it is only made once the board has been read.
	// Saying "Start a conversation" while the list is still arriving would be a claim about a board
	// nobody has looked at yet — the same false first paint, one layer up.
	const emptyState = rows.data
		? emptyStateFor(visible, { query, unreadOnly })
		: null;

	return (
		<>
			<div className="board-pane__controls">
				<label className="board-pane__search">
					<span className="sr-only">Search threads</span>
					<input
						className="board-pane__search-input"
						type="search"
						// The value comes from the URL, so clearing it restores the full list through the
						// same path every other change takes.
						value={query}
						placeholder="Search titles and latest entries"
						onChange={(event) => onSearch(event.currentTarget.value)}
					/>
				</label>
				<button
					className="board-pane__filter"
					type="button"
					// aria-pressed, not a class: the control is a toggle, and a screen reader must hear
					// whether it is on rather than infer it from a colour.
					aria-pressed={unreadOnly}
					onClick={onToggleUnread}
				>
					Unread only
				</button>
			</div>
			<ThreadList
				rows={visible}
				hrefFor={(threadId) => threadHref(boardId, query, unreadOnly, threadId)}
				activeThreadId={activeThreadId}
				emptyState={emptyState}
			/>
		</>
	);
}

/**
 * The address of one open thread.
 *
 * Built by hand rather than with `Link`, because the anchor is rendered inside `ThreadList` — a
 * component that knows nothing about this route — and a plain `href` is also what makes the row a
 * real link: middle-click, copy-link and the address bar all work, which a click handler would not
 * give.
 */
const threadHref = (
	boardId: BoardId,
	query: string,
	unreadOnly: boolean,
	threadId: string,
): string =>
	"/boards/" +
	encodeURIComponent(boardId) +
	"?view=threads&q=" +
	encodeURIComponent(query) +
	"&unread=" +
	(unreadOnly ? "true" : "false") +
	"&thread=" +
	encodeURIComponent(threadId);

/**
 * The board's resources.
 *
 * Each row is a **canonical reference**: a name, an address and a description, with the address as
 * a link that leaves the app. No entry anywhere carries a copy of a resource's content
 * (PRODUCT.md, AGENTS.md): the content stays in its original home and this is a pointer to it.
 */
function ResourcesView({ boardId }: { readonly boardId: BoardId }) {
	const client = useRelayboardClient();
	const resources = useQuery(resourcesQuery(client, boardId));
	const items: readonly Resource[] = resources.data ?? [];

	if (items.length === 0) {
		return (
			// A newly created board opens here (09:14), and an empty frame would tell its creator
			// nothing about what to do next — so the state names the action.
			<div className="board-pane__empty">
				<h3 className="board-pane__empty-title">No resources yet</h3>
				<p className="board-pane__empty-detail">
					Links to useful material live here. The content stays in its original
					home — use Add resource above to share one.
				</p>
			</div>
		);
	}

	return (
		<ul aria-label="Resources" className="board-pane__list">
			{items.map((resource) => (
				<li className="resource-row" key={resource.id}>
					<strong className="resource-row__name">{resource.name}</strong>
					{/*
					 * **`rel="noopener noreferrer"` is load-bearing, not decoration.** Without
					 * `noopener`, the opened page gets `window.opener` and can navigate this app's tab —
					 * a destination controlling the session that opened it, which 09:19 forbids. `noreferrer`
					 * also keeps this app's address out of the destination's logs. The URL itself is
					 * already http(s)-only, enforced at the boundary, so this is the second half of one
					 * rule.
					 */}
					<a
						className="resource-row__url"
						data-resource-url={resource.id}
						href={resource.url}
						rel="noopener noreferrer"
						target="_blank"
					>
						{resource.url}
					</a>
					<p className="resource-row__description">{resource.description}</p>
				</li>
			))}
		</ul>
	);
}

/**
 * The board's participants.
 *
 * ## The members-read gap, and why this is a stated refusal rather than an empty list
 *
 * `listMembers` is entitled by `read:member` on the board, and this build has no grant check yet
 * (07a). Rather than render a list the caller may not be entitled to — or an empty list, which
 * reads as "this board has nobody on it" — the view states what it needs. An empty list would be a
 * false claim about the board; a refusal is a true claim about the build.
 *
 * When the read *does* answer it renders the people, and says which of them are agents: `kind` is a
 * label, and being an agent grants nothing (AGENTS.md), so the word is here so a reader knows who
 * is speaking rather than to mark authority.
 */
function PeopleView({
	boardId,
	threadId,
}: {
	readonly boardId: BoardId;
	readonly threadId: string;
}) {
	const client = useRelayboardClient();
	const members = useQuery(peopleQuery(client, boardId));
	const people: readonly PrincipalSummary[] = members.data ?? [];
	/**
	 * **Which participant is open**, held here rather than in the panel so the row can be the control.
	 *
	 * 12 owns the panel and the drawer 05 renders into; this is the list that opens it. It closes with
	 * Escape as well as the button, because a panel that traps a keyboard reader is the failure 13b will
	 * look for.
	 */
	const [openId, setOpenId] = useState<string | null>(null);

	useEffect(() => {
		if (openId === null) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpenId(null);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [openId]);

	// **Three states, not two, because only one of them means "there are no participants".** A
	// refused read and a read still in flight both leave `data` undefined, and rendering an empty
	// list for either would be a claim that the board has nobody on it — which the test at the route
	// seam catches, and which is exactly the "silent empty list" 04b recorded as unobservable.
	if (members.isPending) {
		return (
			<div className="board-pane__empty">
				<h3 className="board-pane__empty-title">Reading the participants</h3>
				<p className="board-pane__empty-detail">
					The people on this board are being read.
				</p>
			</div>
		);
	}

	if (members.error || members.data === undefined) {
		return (
			<div className="board-pane__empty">
				<h3 className="board-pane__empty-title">
					Participants are not readable here
				</h3>
				<p className="board-pane__empty-detail">
					Reading the participants on a board needs the members permission. This
					build does not check grants yet, so it cannot tell you whether you
					hold it.
				</p>
			</div>
		);
	}

	return (
		<>
			<ul aria-label="Participants" className="board-pane__list">
				{people.map((person) => (
					<li key={person.id}>
						<button
							aria-expanded={openId === person.id}
							className="person-row"
							data-participant-open={person.id}
							type="button"
							onClick={() => setOpenId(person.id)}
						>
							<span className="person-row__name">{person.name}</span>
							{person.kind === "agent" ? (
								<span className="person-row__kind">Agent</span>
							) : null}
						</button>
					</li>
				))}
			</ul>
			{openId === null ? null : (
				<ParticipantPanel
					boardId={boardId}
					onClose={() => setOpenId(null)}
					principalId={openId}
					threadId={threadId === "" ? undefined : threadId}
				/>
			)}
		</>
	);
}
