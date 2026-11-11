import { createFileRoute, redirect } from "@tanstack/react-router";
import { DEFAULT_BOARD_SEARCH } from "./-board-search";

/**
 * The workspace: `/`.
 *
 * There is no separate "pick a board" screen in this product — the rail is the picker — so
 * the workspace route opens the first board the reader may see rather than rendering a
 * wall of boards. That is a redirect rather than a state change: the location the browser
 * lands on is always a board's address, which is what makes a reload or a pasted root link
 * reproducible.
 *
 * A workspace with no boards renders the frame with an empty rail and says so, because a
 * redirect with nowhere to go would be a blank page.
 */
export const Route = createFileRoute("/")({
	loader: async ({ context }) => {
		const boards = await context.client.listBoards();
		if (boards.length > 0) {
			throw redirect({
				to: "/boards/$boardId",
				params: { boardId: boards[0]?.id as string },
				// The default view: the address a root link resolves to is a complete location,
				// not one with parameters left implicit.
				search: DEFAULT_BOARD_SEARCH,
			});
		}
		return { empty: true as const };
	},
	component: EmptyWorkspace,
});

function EmptyWorkspace() {
	return (
		<main className="grid min-h-dvh place-items-center px-xxl py-xxl">
			<div className="flex max-w-[46ch] flex-col items-center gap-lg text-center">
				<h1 className="m-0 text-display text-ink-strong">No boards yet</h1>
				<p className="m-0 text-body text-ink-muted">
					This workspace has no boards. Creating one arrives with the board
					dialog.
				</p>
			</div>
		</main>
	);
}
