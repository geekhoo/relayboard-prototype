import type { ThreadRow } from "#/routes/-thread-list";
import "./ThreadList.css";

/**
 * The thread list: one row per thread, ordered by most recent activity.
 *
 * A row is a **link**, not a button with a click handler, because opening a thread is a
 * navigation: it changes the URL, so a deep link restores it and the back control works. Rendering
 * the row as an anchor is also what makes it reachable by keyboard for free.
 *
 * The selected row carries `aria-current` **and** the 1px inset edge from the co-located sheet: the
 * state does not rely on colour alone, and `aria-current` is what a screen reader announces.
 */
export function ThreadList({
	rows,
	hrefFor,
	activeThreadId,
	emptyState,
}: {
	readonly rows: readonly ThreadRow[];
	/** The address of one thread within this board, supplied by the route that owns the URL. */
	readonly hrefFor: (threadId: string) => string;
	readonly activeThreadId: string;
	/** The absence to explain when there are no rows; null when there are rows. */
	readonly emptyState: {
		readonly title: string;
		readonly detail: string;
	} | null;
}) {
	if (emptyState) {
		return (
			<div className="thread-list__empty">
				<h3 className="thread-list__empty-title">{emptyState.title}</h3>
				<p className="thread-list__empty-detail">{emptyState.detail}</p>
			</div>
		);
	}

	return (
		<ul aria-label="Threads" className="thread-list">
			{rows.map((row) => {
				const current = row.thread.id === activeThreadId;
				return (
					<li key={row.thread.id}>
						<a
							href={hrefFor(row.thread.id)}
							// aria-current marks the open thread for a screen reader; the inset edge in the
							// stylesheet marks it for everybody else. Both, or the state is colour alone.
							aria-current={current ? "true" : undefined}
							className="thread-row"
						>
							<span aria-hidden="true" className="thread-row__icon">
								#
							</span>
							<span className="thread-row__main">
								<span className="thread-row__top">
									<span className="thread-row__title">{row.thread.title}</span>
									<span className="thread-row__time">
										{formatRelative(
											row.latest?.createdAt ?? row.thread.createdAt,
										)}
									</span>
								</span>
								<span className="thread-row__excerpt">
									{row.latest?.text ??
										"No entries yet. Start the conversation."}
								</span>
								<span className="thread-row__meta">
									{row.thread.pinned ? (
										// A word, not only a glyph: the system requires a status to be a word as well as
										// a mark, and a bare pin icon has no accessible name.
										<span className="thread-row__pin">Pinned</span>
									) : null}
									<span>{row.lastAuthorId ?? "No activity"}</span>
									<span aria-hidden="true" className="thread-row__separator">
										·
									</span>
									<span>
										{row.entryCount}
										{row.entryCount === 1 ? " entry" : " entries"}
									</span>
									{row.unread > 0 ? (
										<span className="thread-row__meta-end">
											<span aria-hidden="true" className="thread-row__unread" />
											<span>{row.unread} unread</span>
										</span>
									) : null}
								</span>
							</span>
						</a>
					</li>
				);
			})}
		</ul>
	);
}

/**
 * A timestamp as a person reads it: minutes, hours, days, then a date.
 *
 * The prototype's relative formatter (app.js L17), which is the only recency formatting the
 * product has ever used. Restated here rather than imported, because the prototype is a reference
 * artefact rather than a module this app depends on.
 */
function formatRelative(stamp: string): string {
	const minutes = Math.max(
		0,
		Math.floor((Date.now() - new Date(stamp).getTime()) / 60000),
	);
	if (minutes < 1) return "now";
	if (minutes < 60) return `${String(minutes)}m`;
	if (minutes < 1440) return `${String(Math.floor(minutes / 60))}h`;
	if (minutes < 10080) return `${String(Math.floor(minutes / 1440))}d`;
	return new Date(stamp).toLocaleDateString([], {
		month: "short",
		day: "numeric",
	});
}
