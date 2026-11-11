import { createFileRoute, redirect } from "@tanstack/react-router";
import { DEFAULT_BOARD_SEARCH } from "./-board-search";

/**
 * The workspace: `/`.
 *
 * There is no separate "pick a board" screen in this product — the rail is the picker — so the
 * workspace route opens the board the reader was last looking at, or the first one they may see.
 * That is a redirect rather than a state change: the location the browser lands on is always a
 * board's address, which is what makes a reload or a pasted root link reproducible.
 *
 * ## Where "last looking at" comes from
 *
 * `localStorage`, holding **one string: the address** (spec L505). Everything else about the reader's
 * position — `cursor`, `seen`, `acknowledged` — is the server's, keyed by principal, and storing any of
 * it here would be a second source of truth that survives a revocation and disagrees with a second tab.
 *
 * 11b:19: a reload mid-thread restores the same thread, so a refresh is not a data-loss event. A
 * reload of a thread URL already does that, because the thread is in the address — this is the other
 * half: arriving at the bare root, which is what a reader does by typing the origin or following a
 * link home, lands them back where they were.
 */
const REMEMBERED_LOCATION = "relayboard:location";

/**
 * The remembered address, if it names a board this workspace still has.
 *
 * Parsed rather than trusted: `localStorage` is the reader's to edit, and a remembered board that has
 * since been removed would turn the root into a not-found. Falling back to the first board is the
 * honest behaviour — the reader asked for the workspace, and the workspace exists.
 */
const rememberedBoard = (boardIds: readonly string[]): string | undefined => {
	if (typeof window === "undefined") return undefined;
	try {
		const remembered = window.localStorage.getItem(REMEMBERED_LOCATION);
		if (remembered === null) return undefined;
		const match = remembered.match(/^\/boards\/([^/?#]+)/);
		const candidate = match?.[1];
		return candidate !== undefined && boardIds.includes(candidate)
			? candidate
			: undefined;
	} catch {
		// A browser with storage disabled: the reader simply lands on the first board.
		return undefined;
	}
};

export const Route = createFileRoute("/")({
	loader: async ({ context }) => {
		const boards = await context.client.listBoards();
		if (boards.length > 0) {
			throw redirect({
				to: "/boards/$boardId",
				params: {
					boardId:
						rememberedBoard(boards.map((board) => board.id)) ??
						(boards[0]?.id as string),
				},
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
