import { Link } from "@tanstack/react-router";
import { type ReactNode, useRef, useState } from "react";
import { useKeyboardLayer } from "#/components/-keyboard";
import { BoardRail } from "#/components/BoardRail";
import { PurgeDialog } from "#/components/PurgeDialog";
import { SessionNote } from "#/components/SessionNote";
import { StoreLifetimeNote } from "#/components/StoreLifetimeNote";
import "./WorkspaceFrame.css";

/**
 * The app frame: rail, index pane, conversation.
 *
 * The shell is 01's document and stays untouched; this is the three-column body inside it, which is the
 * thing Relayboard actually looks like (DESIGN.md §130, §186).
 *
 * ## The two navigation gaps 04a measured, closed here
 *
 * 04a shipped an honest interim: between 980 and 681 the rail kept a real column and the pane sat above
 * the conversation, and **below 681 the rail was parked off-canvas with `visibility: hidden` and no way to
 * bring it back** — a navigation dead end, said so in its own comment. 13a closes both:
 *
 * - **At and below 980px** the rail becomes an **overlay drawer** with a scrim, opened by a toggle in the
 *   pane's header and closed by the toggle, the scrim, or Escape. A drawer nobody can open is the dead end
 *   that existed, so the toggle is the part that matters.
 * - **At and below 680px** the pane is the first screen and the conversation is a **second level of the
 *   same route**, with a visible back control. The address does not change (spec L545): the thread is a
 *   search parameter, so opening and closing it is a navigation with a history entry rather than a
 *   second path.
 *
 * Both breakpoints are expressed in the stylesheet, and this component only owns the two pieces of state
 * the CSS cannot: whether the drawer is open, and which escape hatch is currently available.
 */
export function WorkspaceFrame({
	activeBoardId,
	actingPrincipalId,
	pane,
	conversation,
	/** Whether a thread is open, which is what makes the conversation the phone's second level. */
	threadOpen = false,
	/** Where the back control goes: the same board with no thread. */
	backTo,
}: {
	readonly activeBoardId?: string;
	/** Who the browser is acting as. Shown in the session note, which says what that means. */
	readonly actingPrincipalId: string;
	readonly pane?: ReactNode;
	readonly conversation?: ReactNode;
	readonly threadOpen?: boolean;
	readonly backTo?: {
		readonly boardId: string;
		readonly search: {
			readonly view: "threads" | "resources" | "people";
			readonly q: string;
			readonly unread: boolean;
			readonly thread: string;
		};
	};
}) {
	const [railOpen, setRailOpen] = useState(false);
	const railToggle = useRef<HTMLButtonElement | null>(null);

	/**
	 * **The global keyboard layer** (`/`, `Ctrl/Cmd + K`, and Escape for this drawer).
	 *
	 * The shortcuts live in `-keyboard.ts` and the guard is the prototype's own (`app.js` L222): `/` is
	 * suppressed while typing so it cannot jump a reader out of the composer, and while a dialog is open
	 * so it cannot reach behind one. Escape is handled here only for the drawer, because one press must
	 * close exactly one layer and a dialog handles its own.
	 */
	const searchField = () =>
		document.querySelector<HTMLElement>("[data-thread-search]");
	useKeyboardLayer({
		searchField,
		railOpen: () => railOpen,
		setRailOpen,
		railToggle: () => railToggle.current,
	});

	// Escape is the keyboard layer's (see `useKeyboardLayer` above), not a second listener here: two
	// handlers for one key is two chances for the drawer to close twice or not at all.

	return (
		<div
			className="workspace-frame"
			data-conversation-level={threadOpen ? "open" : "list"}
		>
			{/*
			 * **The drawer's toggle, in the frame rather than in the pane.**
			 *
			 * It started in the pane's header, and the phone layout proved that wrong: at ≤680px the pane is
			 * hidden when no thread is open and hidden again when one is, so a toggle inside either column is
			 * unreachable in exactly one of the two states — which is the dead end this ticket exists to
			 * close. Frame-level navigation belongs in the frame.
			 */}
			<button
				aria-expanded={railOpen}
				className="workspace-frame__rail-toggle"
				data-rail-toggle
				type="button"
				ref={railToggle}
				onClick={() => setRailOpen((open) => !open)}
			>
				Boards
			</button>
			<div className="workspace-frame__rail" data-open={railOpen}>
				<BoardRail activeBoardId={activeBoardId} />
			</div>
			{railOpen ? (
				<button
					aria-label="Close boards"
					className="workspace-frame__scrim"
					data-rail-scrim
					type="button"
					onClick={() => setRailOpen(false)}
				/>
			) : null}
			<section aria-labelledby="pane-heading" className="workspace-frame__pane">
				<h2 id="pane-heading" className="sr-only">
					Board contents
				</h2>
				<StoreLifetimeNote />
				<SessionNote boardId={activeBoardId} principalId={actingPrincipalId} />
				<PurgeDialog />
				{pane ?? (
					<p className="workspace-frame__placeholder">
						The thread list lands here next.
					</p>
				)}
			</section>
			<section
				aria-labelledby="conversation-heading"
				className="workspace-frame__conversation"
			>
				<h2 id="conversation-heading" className="sr-only">
					Conversation
				</h2>
				{/* **The phone's back control**, visible only when the conversation is the second level. */}
				{backTo === undefined ? null : (
					<Link
						className="workspace-frame__back"
						data-conversation-back
						params={{ boardId: backTo.boardId }}
						search={backTo.search}
						to="/boards/$boardId"
					>
						Back to threads
					</Link>
				)}
				{conversation ?? (
					<p className="workspace-frame__placeholder">
						Select a thread and its entries will appear here.
					</p>
				)}
			</section>
		</div>
	);
}
