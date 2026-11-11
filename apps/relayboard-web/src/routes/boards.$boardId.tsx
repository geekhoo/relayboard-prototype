import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	notFound,
	useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";
import {
	bindClient,
	resolveActingPrincipal,
	useActingClient,
	useActingPrincipalId,
} from "#/client/context";
import {
	conversationPositionsQuery,
	conversationQuery,
	primeConversation,
} from "#/components/-conversation-queries";
import {
	boardsQuery,
	primeRail,
	unreadQuery,
} from "#/components/-rail-queries";
import {
	heldGrantQuery,
	primePane,
	resourcesQuery,
	threadRowsQuery,
} from "#/components/-thread-queries";
import { BoardPane } from "#/components/BoardPane";
import type { ActInput } from "#/components/Conversation";
import { Conversation } from "#/components/Conversation";
import type { CreateInput } from "#/components/CreateDialog";
import { WorkspaceFrame } from "#/components/WorkspaceFrame";
import { type BoardView, parseBoardSearch } from "./-board-search";

/**
 * One board, at `/boards/$boardId`.
 *
 * The board is a **path segment**; the view, the search text, the unread filter and the open thread
 * are search parameters (spec L542-545), so the whole location is in the address: reload, bookmark
 * and paste all land where the reader was, and back/forward walks the views.
 *
 * The search is parsed by `-board-search`, which is total — a hand-edited value is normalised
 * rather than refused — so this route can render whatever the URL holds.
 *
 * ## Two different not-founds, and why they are in different places
 *
 * A **board** id that does not exist is a whole-frame state: there is no board to show a rail-marked
 * pane for, so `notFound()` from the loader lands on `BoardNotFound`, which renders the same three
 * columns with a way back (spec L546).
 *
 * A **thread** id that does not exist is a conversation-column state, *inside* the board that does
 * exist. The board is real, its thread list is real and the reader can pick another thread from it;
 * hiding all of that behind a full-frame error would be a worse place to land than the one they
 * were trying to reach. That is 04b's criterion, and the shape of it — the pane stays usable — is
 * the reason the thread is a search parameter rather than a second route.
 */
/**
 * **The remembered location, and nothing else.**
 *
 * Spec L505: `seen` and `cursor` move to the server, keyed by principal; `localStorage` keeps exactly
 * one thing — where the reader last was — so a reload mid-thread restores that thread instead of
 * dropping to the default board. 11b:19 calls a refresh a data-loss event otherwise, and it is right:
 * a reader who has to re-find their place after every reload loses the trail they were following.
 *
 * **The watermarks are deliberately not here.** Storing a cursor in the browser would be a second
 * source of truth for how far the reader has got, and it would survive a revocation, a renewal and a
 * second tab that read further — each of which the server already knows about.
 */
const REMEMBERED_LOCATION = "relayboard:location";

const rememberLocation = (path: string, search: string): void => {
	// Guarded because `localStorage` throws in a browser with storage disabled, and losing the restore
	// is a smaller failure than losing the navigation.
	try {
		window.localStorage.setItem(REMEMBERED_LOCATION, path + search);
	} catch {
		// Nothing to do: the reader simply does not get a remembered location.
	}
};
export const Route = createFileRoute("/boards/$boardId")({
	// The search is validated on the way in, before the component sees it: the validator returns the
	// parsed value, so an unknown view or an absurd query is normalised in the address itself rather
	// than only in the render.
	validateSearch: (search: Record<string, unknown>) => parseBoardSearch(search),
	// The open thread is a **reload trigger**: it is part of what the loader's answer depends on, so
	// moving from one thread to another re-runs the loader and resolves the new id against the same
	// board's rows. Declared as a dep rather than read from the raw query string inside the loader,
	// so the loader asks the same parsed question the component asks and cannot disagree with it.
	loaderDeps: ({ search }) => ({ thread: search.thread }),
	loader: async ({ params, context, deps }) => {
		// The loader asks the client rather than the store, so a board that does not exist is known
		// before the component renders and the not-found state is a real route state rather than a
		// flicker of an empty frame.
		// **The board is read after the principal is bound**, not before: `listBoards` is
		// permission-filtered since 07a, so asking it with the *provisional* client would answer as the
		// seed's first browser-selectable principal rather than as the reader. Measured: with the
		// seeded superadmin's session the whole page rendered "Something went wrong", because the
		// provisional principal's boards were looked up and then every other read used the resolved
		// one.
		//
		// Resolving the principal first is also what makes the pane's reads primed under the right
		// query key — the fourth appearance of the defect class, and the reason the binding happens
		// here rather than in a component.
		const acting = await resolveActingPrincipal(context.client);
		const client = bindClient(context.client, acting.id);
		const boards = await client.listBoards();
		const board = boards.find((candidate) => candidate.id === params.boardId);
		// The rail's reads are primed before the answer is decided, so the server's first paint
		// carries the boards and their unread counts. That matters most in the not-found case: the
		// frame's whole promise is that the reader can go somewhere else from a stale link, and a
		// rail that arrived a moment later would leave them looking at a dead end.
		await primeRail(context.queryClient, client);
		if (!board) {
			throw notFound();
		}
		// The pane's three reads are primed for the same reason, and they are primed for **all three
		// views** rather than the one the URL names: the tabs are links, so switching view is a
		// client-side navigation that runs no loader of its own. Without this the resources and
		// people views would render their empty copy on the server and fill in after hydration —
		// the defect 06a and 06b both paid for, in its third costume.
		// **A refusal in one view must not fail the navigation.** `primePane` primes all three views so
		// the tabs switch without a flash, and since 07a one of those reads can be legitimately
		// refused for a principal without `read:member` — a stated state in one column, not a page
		// error. Measured: with the seeded superadmin's session the whole page rendered "Something
		// went wrong", because the refusal escaped the loader. The pane's own views handle their
		// refusals; the loader must not turn one into a navigation failure.
		await primePane(context.queryClient, client, board.id).catch(
			() => undefined,
		);
		// A thread id is resolved against this board's own rows, not against a global thread lookup:
		// naming another board's thread here is the same case as naming one that does not exist, and
		// both must not leak the thread's existence by rendering it.
		const rows = await context.queryClient.ensureQueryData(
			threadRowsQuery(client, board.id),
		);
		// The open thread arrives as a loader dep, so it is the router's own parsed value rather than
		// a second reading of the query string: the loader and the component ask the same question
		// and cannot disagree.
		const threadExists =
			deps.thread === "" || rows.some((row) => row.thread.id === deps.thread);
		// The open thread's own contents are primed too, because the conversation is what a reader
		// came for and its first paint must be the real chronology. This is the fourth time this rule
		// has been paid for — the rail's counts, the session note, the pane's rows — so it is stated
		// once more rather than discovered a fifth time: **if a column reads it at first paint, the
		// loader primes it.** The read is `readThread`, which advances `seen`: the reader's own
		// progress moves as a consequence of opening a link, which is 03's decision and is why the
		// conversation invalidates the rail's counts afterwards.
		if (threadExists && deps.thread !== "") {
			await primeConversation(
				context.queryClient,
				client,
				board.id,
				deps.thread,
			);
		}
		return { board, threadExists };
	},
	component: BoardRoute,
	notFoundComponent: BoardNotFound,
});

function BoardRoute() {
	const { board, threadExists } = Route.useLoaderData();
	const search = Route.useSearch();
	const actingPrincipalId = useActingPrincipalId();
	// The reader's grant on this board, primed by the loader. It drives the gatekeeper's controls —
	// the bound is shown as a shorter list of choices rather than as a refusal after the click — and
	// `[]` while it is absent is the honest answer: no permissions offered beats permissions offered
	// and then refused.
	const actingClient = useActingClient();
	const queryClient = useQueryClient();
	/**
	 * Remember the place whenever the address changes, including a thread change within a board.
	 *
	 * An effect rather than a click handler: the remembered location must follow every route change
	 * (a board switch, a thread open, a tab switch), and a handler per control would be a place to
	 * forget one.
	 */
	// **`window.location`, read after a navigation, not the router's route object.** The router's own
	// `location` field is not on this component's props, and a `useRouterState` subscription here would
	// re-render the whole board route on every scroll restoration tick; the address is the fact wanted
	// and it is already written by the time an effect runs.
	useEffect(() => {
		rememberLocation(window.location.pathname, window.location.search);
	}, []);
	const heldGrant = useQuery(heldGrantQuery(actingClient, board.id));
	const heldPermissions = heldGrant.data ?? { onBoard: [], workspace: [] };
	const navigate = useNavigate();

	/**
	 * Create, then **open what was created** (09:14-15): a board or thread that then has to be found is a
	 * create that did not finish. The navigation is what makes creating and using one continuous act,
	 * and it is why this is here rather than in the dialog: the dialog does not know the address.
	 */
	/**
	 * Perform one of the three acts, then refresh exactly what it changed.
	 *
	 * **Which query an act invalidates is the interesting part** — the same question 09 raised when
	 * creating a board left the rail stale. An act appends an entry, so the conversation is stale; a
	 * status move also changes the thread record and therefore the thread list; an acknowledgement
	 * changes the reader's own watermark and therefore the unread counts. Refetching everything would
	 * hide the mistake rather than answer the question, so each act names its own consequences.
	 */
	const onAct = async (input: ActInput) => {
		if (input.kind === "attach") {
			await actingClient.attachResource({
				threadId: search.thread,
				resourceId: input.resourceId,
			});
		} else if (input.kind === "move") {
			await actingClient.moveStatus({
				threadId: search.thread,
				from: input.from,
				to: input.to,
			});
			await queryClient.invalidateQueries({
				queryKey: threadRowsQuery(actingClient, board.id).queryKey,
			});
		} else {
			await actingClient.acknowledge({
				threadId: search.thread,
				upTo: input.upTo,
			});
			await queryClient.invalidateQueries({
				queryKey: unreadQuery(actingClient).queryKey,
			});
		}
		// The chronology itself, and the positions the acknowledgement control reads.
		await queryClient.invalidateQueries({
			queryKey: conversationQuery(actingClient, search.thread).queryKey,
		});
		await queryClient.invalidateQueries({
			queryKey: conversationPositionsQuery(actingClient, search.thread)
				.queryKey,
		});
	};

	const onCreate = async (input: CreateInput) => {
		if (input.kind === "board") {
			const board = await actingClient.createBoard({
				name: input.form.name,
				description: input.form.description,
			});
			// **The rail is a cached read and must be told.** Navigating re-runs the loader, but
			// `ensureQueryData` returns the cached boards when they are already there — so a newly
			// created board would not appear in the rail until a full reload. Measured: the double-click
			// test found the board created and the rail still showing three. Invalidating is the fix;
			// the alternative (a loader that always refetches) would defeat the first-paint priming the
			// rail depends on.
			await queryClient.invalidateQueries({
				queryKey: boardsQuery(actingClient).queryKey,
			});
			await navigate({
				to: "/boards/$boardId",
				params: { boardId: board.id },
				search: { view: "threads", q: "", unread: false, thread: "" },
			});
			return;
		}
		if (input.kind === "thread") {
			const thread = await actingClient.createThread({
				boardId: board.id,
				title: input.form.title,
				description: input.form.description,
			});
			await queryClient.invalidateQueries({
				queryKey: threadRowsQuery(actingClient, board.id).queryKey,
			});
			await navigate({
				to: "/boards/$boardId",
				params: { boardId: board.id },
				search: { view: "threads", q: "", unread: false, thread: thread.id },
			});
			return;
		}
		await actingClient.addResource({
			boardId: board.id,
			name: input.form.name,
			url: input.form.url,
			type: input.form.type,
			description: input.form.description,
		});
		await queryClient.invalidateQueries({
			queryKey: resourcesQuery(actingClient, board.id).queryKey,
		});
		await navigate({
			to: "/boards/$boardId",
			params: { boardId: board.id },
			search: { view: "resources", q: "", unread: false, thread: "" },
		});
	};

	return (
		<WorkspaceFrame
			actingPrincipalId={actingPrincipalId}
			activeBoardId={board.id}
			// **The phone's second level**, decided from the address the way everything else here is:
			// "open" when a thread is, "list" when none is, which is what the stylesheet's two rules read.
			backTo={{
				boardId: board.id,
				search: { ...search, thread: "" },
			}}
			threadOpen={threadExists && search.thread !== ""}
			pane={
				<BoardPane
					boardId={board.id}
					description={board.description}
					name={board.name}
					query={search.q}
					thread={search.thread}
					unreadOnly={search.unread}
					view={search.view}
					heldPermissions={heldPermissions}
					onCreate={onCreate}
				/>
			}
			conversation={
				threadExists ? (
					search.thread === "" ? undefined : (
						<Conversation
							boardId={board.id}
							heldOnBoard={heldPermissions.onBoard}
							onAct={onAct}
							threadId={search.thread}
						/>
					)
				) : (
					<ThreadNotFound
						boardId={board.id}
						search={search}
						threadId={search.thread}
					/>
				)
			}
		/>
	);
}

/**
 * A thread the URL names that this board does not hold.
 *
 * Inside the frame and beside a working thread list: the reader can pick another thread without
 * leaving, which is the whole point of putting this in the conversation column rather than
 * replacing the board. The sentence names the id so a hand-edited or truncated link is obvious.
 */
function ThreadNotFound({
	boardId,
	search,
	threadId,
}: {
	readonly boardId: string;
	readonly search: {
		readonly view: BoardView;
		readonly q: string;
		readonly unread: boolean;
		readonly thread: string;
	};
	readonly threadId: string;
}) {
	return (
		<div className="flex flex-col gap-sm px-md py-lg">
			<h1 className="m-0 text-headline text-ink-strong">Thread not found</h1>
			<p className="m-0 text-body text-ink-muted">
				This board has no thread with the address “{threadId}”. It may have been
				removed, or the link may belong to another board.
			</p>
			<Link
				className="text-body text-accent-ink underline"
				params={{ boardId }}
				// Back to the board's thread list with everything else as the reader left it: clearing
				// the thread is the whole repair, and resetting their search as well would lose work
				// they did to get here.
				search={{ ...search, thread: "" }}
				to="/boards/$boardId"
			>
				Choose a thread from the list
			</Link>
		</div>
	);
}

/**
 * A board the URL names that this workspace does not hold.
 *
 * Inside the frame, with a way back: a stale link should read as "that board is gone" rather than
 * as a broken product (story 7). The rail still renders, so the reader can go anywhere else.
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
