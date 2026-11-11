import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useActingPrincipalId, useRelayboardClient } from "#/client/context";
import { primeRail, threadsQuery } from "#/components/-rail-queries";
import { WorkspaceFrame } from "#/components/WorkspaceFrame";
import { BOARD_VIEWS, parseBoardSearch } from "./-board-search";

/**
 * One board, at `/boards/$boardId`.
 *
 * The board is a **path segment** and the view, the search text and the unread filter are
 * search parameters (spec L540-542), so the whole location is in the address: reload,
 * bookmark and paste all land where the reader was, and back/forward walks the views.
 *
 * The search is parsed by `-board-search`, which is total — a hand-edited value is
 * normalised rather than refused — so this route can render whatever the URL holds.
 *
 * A board id that does not exist is a **not-found state inside the frame**, not a framework
 * error page (spec L544): `notFound()` from the loader lands on the route's error component,
 * which renders the same three columns with a way back rather than a bare stack trace.
 */
export const Route = createFileRoute("/boards/$boardId")({
	// The search is validated on the way in, before the component sees it: the validator
	// returns the parsed value, so an unknown view or an absurd query is normalised in the
	// address itself rather than only in the render.
	validateSearch: (search: Record<string, unknown>) => parseBoardSearch(search),
	loader: async ({ params, context }) => {
		// The loader asks the client rather than the store, so a board that does not exist is
		// known before the component renders and the not-found state is a real route state
		// rather than a flicker of an empty frame.
		const boards = await context.client.listBoards();
		const board = boards.find((candidate) => candidate.id === params.boardId);
		// The rail's two reads are primed before the answer is decided, so the server's first
		// paint carries the boards and their unread counts. That matters most in the not-found
		// case: the frame's whole promise is that the reader can go somewhere else from a stale
		// link, and a rail that arrived a moment later would leave them looking at a dead end.
		await primeRail(context.queryClient, context.client);
		if (!board) {
			throw notFound();
		}
		// The pane's own read is primed for the same reason. Without this the pane renders its
		// "0 threads" copy on the server and corrects itself on hydration — a flash of text that
		// is simply false about the board the reader is looking at, which the in-memory client
		// happens to hide because its queries resolve in the same tick. Found by measuring the
		// HTTP transport, and worth fixing before the UI is switched to it in 06c.
		await context.queryClient.ensureQueryData(
			threadsQuery(context.client, board.id),
		);
		return { board };
	},
	component: BoardRoute,
	notFoundComponent: BoardNotFound,
});

function BoardRoute() {
	const { board } = Route.useLoaderData();
	const search = Route.useSearch();
	const client = useRelayboardClient();
	const threads = useQuery(threadsQuery(client, board.id));

	return (
		<WorkspaceFrame
			activeBoardId={board.id}
			actingPrincipalId={useActingPrincipalId()}
			pane={
				<BoardPane
					name={board.name}
					description={board.description}
					view={search.view}
					threadCount={threads.data?.length ?? 0}
					unread={search.unread}
					query={search.q}
				/>
			}
		/>
	);
}

/**
 * The index pane's header and its honest state for this ticket.
 *
 * The three views are rendered as tabs so the URL contract is visible and operable before
 * the lists exist; each tab is a link that changes the search parameter, which is what makes
 * back and forward move between views.
 */
function BoardPane({
	name,
	description,
	view,
	threadCount,
	unread,
	query,
}: {
	readonly name: string;
	readonly description: string;
	readonly view: "threads" | "resources" | "people";
	readonly threadCount: number;
	readonly unread: boolean;
	readonly query: string;
}) {
	const { boardId } = Route.useParams();
	return (
		<div className="flex flex-col gap-md px-md py-lg">
			<header className="flex flex-col gap-hair">
				<h1 className="m-0 text-headline text-ink-strong">{name}</h1>
				<p className="m-0 text-body text-ink-muted">{description}</p>
			</header>
			<nav aria-label="Board views" className="flex gap-sm">
				{BOARD_VIEWS.map((candidate) => (
					// A link, not a button: the view is a search parameter, so switching it is a
					// navigation — back and forward move between views and the address is shareable
					// (spec L541).
					<Link
						key={candidate}
						to="/boards/$boardId"
						params={{ boardId }}
						search={{ view: candidate, q: query, unread }}
						aria-current={candidate === view ? "page" : undefined}
						className="text-body capitalize"
					>
						{candidate}
					</Link>
				))}
			</nav>
			<p className="m-0 text-body text-ink-muted">
				{view === "threads"
					? `${threadCount} thread${threadCount === 1 ? "" : "s"} in this board. The thread list lands here next.`
					: view === "resources"
						? "The board's resources land here next."
						: "The board's participants land here next."}
			</p>
		</div>
	);
}

/**
 * A board the URL names that this workspace does not hold.
 *
 * Inside the frame, with a way back: a stale link should read as "that board is gone" rather
 * than as a broken product (story 7). The rail still renders, so the reader can go anywhere
 * else from here.
 */
function BoardNotFound() {
	return (
		<WorkspaceFrame
			actingPrincipalId={useActingPrincipalId()}
			pane={
				<div className="flex flex-col gap-sm px-md py-lg">
					<h1 className="m-0 text-headline text-ink-strong">Board not found</h1>
					<p className="m-0 text-body text-ink-muted">
						This workspace has no board with that address. It may have been
						removed, or the link may be wrong.
					</p>
					<Link className="text-body text-accent-ink underline" to="/">
						Back to the workspace
					</Link>
				</div>
			}
		/>
	);
}
