import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { PurgeImpact } from "#/client";
import { useActingClient } from "#/client/context";
import type { RelayboardRequestError } from "#/client/http";
import { purgeImpactQuery } from "#/components/-purge-queries";
import { heldPermissionsQuery } from "#/components/-thread-queries";
import "./PurgeDialog.css";

/**
 * The purge confirmation: a destructive action that names what it will remove before it removes it.
 *
 * ## Why it is heavier than the content around it
 *
 * DESIGN.md §259 allows exactly one surface to be heavier than what surrounds it, and this is it,
 * because unclear consequences are worse than a heavier dialog. So: the counts, in this order — what
 * will be removed, what will be kept, and the overlap stated as a count.
 *
 * ## The overlap is the sentence that earns the dialog
 *
 * 14:14: *\"3 of your entries are in demo boards and will be removed with them.\"* A purge that took the
 * reader's work silently would be worse than no purge; the count is computed by the **same predicate**
 * the purge uses, so what the dialog says and what the purge does cannot disagree.
 *
 * ## Gate
 *
 * 14:10 and 14:21: the control is gated by the **workspace `create:board` grant** — no `purge:*` verb is
 * added, because 07a's vocabulary test asserts the fifteen names literally. A reader without it sees the
 * control disabled with the permission named, and the operation itself is refused at the boundary.
 */
export function PurgeDialog() {
	const client = useActingClient();
	const queryClient = useQueryClient();
	const dialog = useRef<HTMLDialogElement | null>(null);
	const opener = useRef<HTMLButtonElement | null>(null);
	const [problem, setProblem] = useState<string | null>(null);
	const [done, setDone] = useState<PurgeImpact | null>(null);
	/** The pattern this session has applied four times: one activation per click, guarded synchronously. */
	const inFlight = useRef(false);

	/**
	 * **The gate, read from the workspace-scoped grant.** A board-scoped answer would be the wrong
	 * question: `create:board` is a workspace permission, and 09's finding was exactly a workspace-scoped
	 * permission read as a board-scoped list.
	 */
	const held = useQuery(heldPermissionsQuery(client));
	const mayPurge = (held.data?.workspace ?? []).includes("create:board");

	const impact = useQuery<PurgeImpact, RelayboardRequestError>({
		...purgeImpactQuery(client),
		enabled: mayPurge,
	});

	// Escape closes and returns focus to the control that opened it (14:22, 13b's standard).
	useEffect(() => {
		if (!dialog.current?.open) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			// **Exactly one layer.** Escape closes the dialog and does nothing else; the conversation's own
			// handlers do not see it because the event is consumed here.
			event.preventDefault();
			dialog.current?.close();
			opener.current?.focus();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	const run = async () => {
		if (inFlight.current) return;
		inFlight.current = true;
		setProblem(null);
		try {
			const result = await client.purgeDemoContent({ confirmed: true });
			setDone(result);
			// Everything the workspace holds, refetched: a purge changes the boards, the threads, the
			// counts and the conversations at once. Named as one call rather than five, because the answer
			// to \"which query did this invalidate\" is genuinely all of them.
			await queryClient.invalidateQueries();
			dialog.current?.close();
			opener.current?.focus();
		} catch (error) {
			// A refusal stays in the dialog with its reason, for the reason 09 gives: closing would lose
			// the reader's place and tell them nothing.
			setProblem(error instanceof Error ? error.message : String(error));
		} finally {
			inFlight.current = false;
		}
	};

	const restore = async () => {
		if (inFlight.current) return;
		inFlight.current = true;
		try {
			await client.restoreDemoContent();
			setDone(null);
			await queryClient.invalidateQueries();
		} finally {
			inFlight.current = false;
		}
	};

	return (
		<>
			<button
				aria-disabled={!mayPurge}
				className="purge-control"
				data-purge-open
				ref={opener}
				type="button"
				onClick={() => {
					if (!mayPurge) return;
					setProblem(null);
					setDone(null);
					dialog.current?.showModal();
				}}
			>
				Purge demo content
			</button>
			{mayPurge ? null : (
				<p className="purge-control__reason" data-purge-reason>
					Purging needs the create:board permission in this workspace
				</p>
			)}

			<dialog
				aria-labelledby="purge-title"
				className="purge-dialog"
				ref={dialog}
			>
				<div className="purge-dialog__head">
					<h2 className="purge-dialog__title" id="purge-title">
						Purge demo content?
					</h2>
				</div>
				<div className="purge-dialog__body">
					{/* **What will be removed**, first, because that is the question. */}
					<p className="purge-dialog__line" data-purge-will-remove>
						{impact.data === undefined
							? "Reading what a purge would remove…"
							: `${impact.data.boards} ${impact.data.boards === 1 ? "board" : "boards"}, ${impact.data.threads} ${impact.data.threads === 1 ? "thread" : "threads"}, ${impact.data.entries} ${impact.data.entries === 1 ? "entry" : "entries"} and ${impact.data.resources} ${impact.data.resources === 1 ? "resource" : "resources"} that this workspace seeded will be removed.`}
					</p>
					<p className="purge-dialog__line" data-purge-will-keep>
						Boards, threads, entries and resources you made are kept, and so is
						your participant record and every permission you hold.
					</p>
					{/*
					 * **The overlap, as a count and in the draft's own words.** 14:14 and DESIGN.md §259: when
					 * it is non-zero this is the only line that takes a warning tone, and it is never red —
					 * the action is reversible by restore, and a red alarm for a reversible action trains
					 * people to ignore red.
					 */}
					{impact.data === undefined ? null : (
						<p
							className={
								impact.data.ownEntriesOnDemoBoards > 0
									? "purge-dialog__overlap purge-dialog__overlap--warned"
									: "purge-dialog__overlap"
							}
							data-purge-overlap={impact.data.ownEntriesOnDemoBoards}
						>
							{impact.data.ownEntriesOnDemoBoards === 0
								? "None of your entries are in demo boards, so nothing of yours is affected."
								: `${impact.data.ownEntriesOnDemoBoards} of your ${impact.data.ownEntriesOnDemoBoards === 1 ? "entries is" : "entries are"} in demo boards and will be removed with them.`}
						</p>
					)}

					{/* The durability claim, said where a destructive act is confirmed (14:18). */}
					<p className="purge-dialog__note">
						This workspace is held in memory. A restart clears it too, so a
						purge is not a durability promise: restore brings the demo back.
					</p>

					{problem === null ? null : (
						<p
							className="purge-dialog__problem"
							data-purge-problem
							role="alert"
						>
							{problem}
						</p>
					)}
				</div>
				<div className="purge-dialog__actions">
					{/* **Cancel first**, and it is the primary-looking control until the overlap has been read
					    (DESIGN.md §259). */}
					<button
						className="purge-dialog__cancel"
						data-purge-cancel
						type="button"
						onClick={() => {
							dialog.current?.close();
							opener.current?.focus();
						}}
					>
						Cancel
					</button>
					<button
						className="purge-dialog__confirm"
						data-purge-confirm
						type="button"
						onClick={() => void run()}
					>
						{/* **Names the action**, never "OK" (DESIGN.md §259). */}
						Purge demo content
					</button>
				</div>
			</dialog>

			{done === null ? null : (
				<div className="purge-done" data-purge-done>
					<p className="purge-done__line">
						Purged {done.boards} boards and {done.entries} entries. Your own
						work is untouched.
					</p>
					<button
						className="purge-control"
						data-purge-restore
						type="button"
						onClick={() => void restore()}
					>
						Restore demo content
					</button>
				</div>
			)}
		</>
	);
}
