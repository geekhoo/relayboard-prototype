import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { BoardId, PrincipalSummary, Resource } from "#/client";
import { useRelayboardClient } from "#/client/context";
import {
	peopleQuery,
	resourcesQuery,
	threadRowsQuery,
} from "#/components/-thread-queries";
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
}: {
	readonly boardId: BoardId;
	readonly name: string;
	readonly description: string;
	readonly view: BoardView;
	readonly query: string;
	readonly unreadOnly: boolean;
	readonly thread: string;
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
				<PeopleView boardId={boardId} />
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
			<div className="board-pane__empty">
				<h3 className="board-pane__empty-title">No resources yet</h3>
				<p className="board-pane__empty-detail">
					Links to useful material live here. The content stays in its original
					home.
				</p>
			</div>
		);
	}

	return (
		<ul aria-label="Resources" className="board-pane__list">
			{items.map((resource) => (
				<li className="resource-row" key={resource.id}>
					<strong className="resource-row__name">{resource.name}</strong>
					<a
						className="resource-row__url"
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
function PeopleView({ boardId }: { readonly boardId: BoardId }) {
	const client = useRelayboardClient();
	const members = useQuery(peopleQuery(client, boardId));
	const people: readonly PrincipalSummary[] = members.data ?? [];

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
		<ul aria-label="Participants" className="board-pane__list">
			{people.map((person) => (
				<li className="person-row" key={person.id}>
					<span className="person-row__name">{person.name}</span>
					{person.kind === "agent" ? (
						<span className="person-row__kind">Agent</span>
					) : null}
				</li>
			))}
		</ul>
	);
}
