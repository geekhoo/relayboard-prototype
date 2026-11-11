import type { ReactNode } from "react";
import { BoardRail } from "#/components/BoardRail";
import { PurgeDialog } from "#/components/PurgeDialog";
import { SessionNote } from "#/components/SessionNote";
import { StoreLifetimeNote } from "#/components/StoreLifetimeNote";
import "./WorkspaceFrame.css";

/**
 * The app frame: rail, index pane, conversation.
 *
 * The shell is 01's document and stays untouched; this is the three-column body inside it,
 * which is the thing Relayboard actually looks like (DESIGN.md §130, §186).
 *
 * The pane and the conversation are **labelled placeholders** in this ticket, and they say
 * so in words rather than showing an empty pane: 04b renders the thread list and 05 renders
 * a thread's contents, and until then a blank column would read as "nothing here" rather
 * than "not built yet". They are regions with accessible names, so the layout a later ticket
 * fills in is already the layout a screen reader can describe.
 */
export function WorkspaceFrame({
	activeBoardId,
	actingPrincipalId,
	pane,
	conversation,
}: {
	readonly activeBoardId?: string;
	/** Who the browser is acting as. Shown in the session note, which says what that means. */
	readonly actingPrincipalId: string;
	readonly pane?: ReactNode;
	readonly conversation?: ReactNode;
}) {
	return (
		<div className="workspace-frame">
			<div className="workspace-frame__rail">
				<BoardRail activeBoardId={activeBoardId} />
			</div>
			<section aria-labelledby="pane-heading" className="workspace-frame__pane">
				<h2 id="pane-heading" className="sr-only">
					Board contents
				</h2>
				<StoreLifetimeNote />
				<PurgeDialog />
				<SessionNote boardId={activeBoardId} principalId={actingPrincipalId} />
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
				{conversation ?? (
					<p className="workspace-frame__placeholder">
						Select a thread and its entries will appear here.
					</p>
				)}
			</section>
		</div>
	);
}
