import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useRelayboardClient } from "#/client/context";
import { boardsQuery, unreadQuery } from "#/components/-rail-queries";
import { BrandMark } from "#/components/BrandMark";
import { DEFAULT_BOARD_SEARCH } from "#/routes/-board-search";
import "./BoardRail.css";

/**
 * The board rail: the dark left column that holds the map of the workspace.
 *
 * It renders from `RelayboardClient` and from nothing else — no store import, no module that
 * reads the seed — so the rail is the same component whatever the transport is (04a's
 * criterion, and the reason a Biome rule forbids the shortcut).
 *
 * Three things it does not do, each visible in the markup:
 *
 * - **It never renders a board's participants.** `listBoards` returns a count and no list
 *   (03), and `read:member` is a permission of its own; a rail that showed faces would be
 *   the leak that permission exists to stop.
 * - **It never counts unread entries itself.** Each badge is the sum of a board's threads'
 *   unread counts, derived from the reader's `seen` watermark, so the rail and the thread
 *   pane cannot disagree.
 * - **It never invents a mark.** The monogram and the hue are the board's own `short` and
 *   `theme` (02c), so the four-hue set stays closed and a fifth hue would be a type error
 *   rather than an unstyled square.
 */
export function BoardRail({
	activeBoardId,
}: {
	readonly activeBoardId?: string;
}) {
	const client = useRelayboardClient();
	// Both are primed by the route's loader, so the first paint is the real rail rather than
	// an empty one that fills in a moment later.
	const boards = useQuery(boardsQuery(client));
	const unread = useQuery(unreadQuery(client));
	const counts = new Map(
		(unread.data ?? []).map((board) => [board.boardId, board.unread]),
	);

	return (
		<nav
			aria-label="Boards"
			// `h-full` is load-bearing, not cosmetic: a block-level child fills its parent's
			// width but not its height, so without it the dark surface stops at the last row and
			// the rest of the column is white — a card rather than the depth DESIGN.md §130 says
			// the rail is. Measured, not assumed: at 1440×900 the nav is 900px tall only because
			// of this class.
			className="flex h-full flex-col gap-hair bg-rail px-sm py-md"
		>
			<div className="flex items-center gap-sm px-xs pb-md">
				<BrandMark className="text-rail-ink" />
				<span className="text-title text-rail-ink">relayboard</span>
			</div>
			<ul className="m-0 flex list-none flex-col gap-hair p-0">
				{(boards.data ?? []).map((board) => {
					const current = board.id === activeBoardId;
					const unreadCount = counts.get(board.id) ?? 0;
					return (
						<li key={board.id}>
							<Link
								// A board is a path segment (spec L542), so the row is a link and opening it
								// is a navigation rather than a state change.
								to="/boards/$boardId"
								params={{ boardId: board.id }}
								// The default view spelled out: the search schema has no optional keys, so a
								// link states the whole location rather than relying on an implicit fallback.
								search={DEFAULT_BOARD_SEARCH}
								aria-current={current ? "page" : undefined}
								className="board-rail__row flex items-center gap-sm rounded-sm px-xs py-sm text-rail-ink-muted no-underline hover:bg-rail-hover hover:text-surface"
							>
								<span
									className="board-mark"
									data-theme={board.theme}
									aria-hidden="true"
								>
									{board.short}
								</span>
								<span className="board-rail__name flex-1 truncate">
									{board.name}
								</span>
								{unreadCount > 0 ? (
									<span className="board-rail__count">
										<span aria-hidden="true">{unreadCount}</span>
										<span className="sr-only"> unread entries</span>
									</span>
								) : null}
							</Link>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
