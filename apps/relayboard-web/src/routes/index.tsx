import { createFileRoute } from "@tanstack/react-router";
import { BrandMark } from "../components/BrandMark";

export const Route = createFileRoute("/")({ component: WorkspacePlaceholder });

/**
 * The empty Relayboard frame: no boards, no threads, no conversation yet. The lockup
 * takes Reading Green for identity rather than Working Green, so the action colour stays
 * absent from a view that has no actions in it.
 */
function WorkspacePlaceholder() {
	return (
		<main className="grid min-h-dvh place-items-center px-xxl py-xxl">
			<div className="flex max-w-[46ch] flex-col items-center gap-lg text-center">
				<BrandMark className="text-accent-ink" />
				<h1 className="m-0 text-balance text-display text-ink-strong">
					relayboard<span className="text-accent-ink">.</span>
				</h1>
				<p className="m-0 text-body text-ink-muted">
					This is the workspace frame. Boards, threads and the conversation are
					not here yet.
				</p>
			</div>
		</main>
	);
}
