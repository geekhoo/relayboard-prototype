import { useQuery } from "@tanstack/react-query";
import type {
	BoardId,
	ParticipantRead,
	PrincipalId,
	ThreadId,
	Watermarks,
} from "#/client";
import { useActingClient } from "#/client/context";
import type { RelayboardRequestError } from "#/client/http";
import {
	participantProgressQuery,
	participantQuery,
} from "#/components/-participant-queries";
import "./ParticipantPanel.css";

/**
 * A participant's identity, permissions and progress, as a panel.
 *
 * ## The separation this panel exists to draw
 *
 * `GLOSSARY.md`: a **declared** value is one a principal asserts about itself and is "never verified,
 * never tinted with the accent, never carrying a checkmark"; a **derived** value is one this workspace
 * computed from a credential it issued. 08c made the second real — an HMAC over the principal id, keyed
 * by the installation secret, impossible for a caller to supply — and this is where a reader meets the
 * difference.
 *
 * **Nothing here invites comparison.** The fingerprint is shown as an identifier with its own heading,
 * and one test asserts the panel never contains the prototype's hard-coded demo string: the prototype's
 * drawer showed a literal under "Verified identity" (`parity-checklist.md` line 57), this app derives
 * the value, and the two are different kinds of thing rather than two versions of one (12:22).
 *
 * ## Three watermarks, not one bar
 *
 * Received, read and acknowledged are three rungs with three meanings, and a participant panel that
 * collapsed them into one number would hide the model the product is built on. They are shown as three
 * labelled positions with a sentence each, and the seeded principals are supposed to differ — that
 * difference is the point, not an inconsistency.
 */
export function ParticipantPanel({
	boardId,
	threadId,
	principalId,
	onClose,
}: {
	readonly boardId: BoardId;
	/** The thread the reader has open, which is the one progress can be reported on. */
	readonly threadId: ThreadId | undefined;
	readonly principalId: PrincipalId;
	readonly onClose: () => void;
}) {
	const client = useActingClient();
	/**
	 * **`RelayboardRequestError` as the error type, explicitly.** The query's errors are that class —
	 * every client operation wraps what it throws so a caller can branch on `.family` rather than parse a
	 * message (06b:22, and the split 08b made real) — and typing the query without saying so would widen
	 * it back to `Error` and take the family away exactly where a reader meets it.
	 */
	const read = useQuery<ParticipantRead, RelayboardRequestError>(
		participantQuery(client, boardId, principalId),
	);

	return (
		<aside aria-label="Participant details" className="participant">
			<header className="participant__head">
				<h2 className="participant__title">
					{read.data?.principal.name ?? "Participant"}
				</h2>
				<button
					className="participant__close"
					data-participant-close
					type="button"
					onClick={onClose}
				>
					Close
				</button>
			</header>

			<div className="participant__body">
				{read.isPending ? (
					<p className="participant__note">Reading this participant…</p>
				) : read.isError ? (
					/*
					 * **A refusal is its own sentence**, not a generic failure: 06b:22 asks the client to tell a
					 * permission refusal from an absent session, and this is the surface where a reader meets it.
					 * The family comes from `failureFamily`, so the two never collapse back into one message.
					 */
					<div className="participant__empty">
						<h3 className="participant__empty-title">
							{read.error.family === "denied"
								? "You cannot read this participant here"
								: read.error.family === "unauthenticated"
									? "There is no session to read this as"
									: "This participant could not be read"}
						</h3>
						<p className="participant__empty-detail">
							{read.error.family === "denied"
								? "Reading a participant needs the read:member permission on this board."
								: read.error.family === "unauthenticated"
									? "Start a session and try again."
									: read.error.message}
						</p>
					</div>
				) : read.data === undefined ? (
					<p className="participant__note">Reading this participant…</p>
				) : (
					<ParticipantBody
						boardId={boardId}
						principalId={principalId}
						read={read.data}
						threadId={threadId}
					/>
				)}
			</div>
		</aside>
	);
}

/** Everything the panel states once the read has landed. */
function ParticipantBody({
	boardId,
	principalId,
	read,
	threadId,
}: {
	readonly boardId: BoardId;
	readonly principalId: PrincipalId;
	readonly read: ParticipantRead;
	readonly threadId: ThreadId | undefined;
}) {
	const client = useActingClient();
	// No open thread means no progress to report, and the query is not issued at all rather than
	// issued for a thread that does not exist.
	const progress = useQuery({
		...participantProgressQuery(client, threadId ?? ""),
		enabled: threadId !== undefined,
	});
	void boardId;
	const position = (progress.data ?? []).find(
		(candidate) => candidate.principalId === principalId,
	);

	return (
		<>
			<p className="participant__kind">
				{read.principal.kind === "agent" ? "Agent" : "Human"}
				{/*
				 * **A label, not a rank** (AGENTS.md): the word says who is speaking, and holding more
				 * permissions would not make an agent more of an authority.
				 */}
			</p>

			<section className="participant__section">
				<h3 className="participant__heading">Derived</h3>
				<p className="participant__caption">
					Computed by this workspace from the admission it issued.
				</p>
				{read.derived === undefined ? (
					<p className="participant__note" data-participant-derived="none">
						This participant was not admitted here, so there is nothing derived
						about it. Its record and the permissions below are the workspace's
						own.
					</p>
				) : (
					<dl className="participant__facts" data-participant-derived="present">
						<dt>Issuer</dt>
						<dd data-participant-issuer>{read.derived.issuer}</dd>
						<dt>Fingerprint</dt>
						<dd data-participant-fingerprint>{read.derived.fingerprint}</dd>
					</dl>
				)}
			</section>

			<section className="participant__section">
				<h3 className="participant__heading">Declared</h3>
				<p className="participant__caption">
					What this participant says about itself. Not verified.
				</p>
				<dl className="participant__facts" data-participant-declared>
					<dt>Description</dt>
					<dd>{read.declared.description}</dd>
					{read.declared.operator === undefined ? null : (
						<>
							<dt>Operator</dt>
							<dd>{read.declared.operator}</dd>
						</>
					)}
				</dl>
			</section>

			<section className="participant__section">
				<h3 className="participant__heading">May do here</h3>
				<p className="participant__caption">
					The permissions this participant holds on this board.
				</p>
				{read.grant.permissions.length === 0 ? (
					<p className="participant__note">
						None. Holding no permission here is not a bug: a grant is the
						membership.
					</p>
				) : (
					<ul className="participant__permissions" data-participant-grant>
						{read.grant.permissions.map((permission) => (
							<li key={permission}>{permission}</li>
						))}
					</ul>
				)}
			</section>

			<section className="participant__section">
				<h3 className="participant__heading">Progress</h3>
				<p className="participant__caption">
					{/*
					 * **Three rungs with three meanings**, never one bar: received is the
					 * transport, read is the reader, acknowledged is a deliberate report. A
					 * principal can be caught up on one and behind on another, and the seeded
					 * principals are meant to differ.
					 */}
					Where this participant has got on the thread you have open.
				</p>
				{position === undefined ? (
					<p className="participant__note">
						No position yet: this participant has not been sent anything in an
						open thread.
					</p>
				) : (
					<Progress watermarks={position.watermarks} />
				)}
			</section>

			<p className="participant__note participant__note--authorship">
				{/*
				 * 12:19, and the second meaning of AGENTS.md's own rule: authorship is not
				 * authority, and being admitted is not either. A reader must not infer that
				 * an entry is correct, agreed with or binding from who wrote it.
				 */}
				Authorship is not authority. Who wrote an entry says who spoke, not
				whether the entry is right, agreed with, or binding on anyone.
			</p>
		</>
	);
}

/** The three watermarks, each with what it means in the reader's words. */
function Progress({ watermarks }: { readonly watermarks: Watermarks }) {
	return (
		<dl className="participant__progress" data-participant-progress>
			<dt>Received</dt>
			<dd data-watermark="cursor">
				#{watermarks.cursor} — delivered to this participant
			</dd>
			<dt>Read</dt>
			<dd data-watermark="seen">
				#{watermarks.seen} — this participant has read up to here
			</dd>
			<dt>Acknowledged</dt>
			<dd data-watermark="acknowledged">
				#{watermarks.acknowledged} — this participant reported taking it into
				account
			</dd>
		</dl>
	);
}
