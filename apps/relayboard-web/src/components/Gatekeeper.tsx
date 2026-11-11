import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { createGateClient, type GateClient } from "#/client/admission";
import type { PermissionName } from "#/domain";
import type {
	DecidedRequest,
	Expiry,
	PendingRequest,
} from "#/server/admissions";
/* eslint-disable */
import "./Gatekeeper.css";

/**
 * The gatekeeper panel: the screen a human decides an admission on.
 *
 * ## Three rules this surface exists to obey
 *
 * 1. **Declared is labelled, and nothing in the declared block is tinted.** The agent's name,
 *    operator and reason are what it *asserted*; the label above them says so at 11px in Ink-muted,
 *    and DESIGN.md §256 forbids the accent and any checkmark in that block. A reader must never
 *    mistake an asserted string for a verified one — 08c derives the values that *are* verified, and
 *    until it does this surface says plainly that there are none rather than showing a placeholder.
 * 2. **Every affordance is bounded by what the decider holds.** The permission choices are the
 *    intersection of what the agent could be given and what this human can hand out (07b's rule), so
 *    the bound is shown as a shorter list rather than as a refusal after the click. A control that
 *    always fails is worse than no control.
 * 3. **A refusal leaves the row where it is.** No permission, insufficient grant to hand out, or an
 *    already-decided request: the row stays with the reason, because closing the surface would lose
 *    the reader's place and tell them nothing.
 *
 * ## Why the open control is here and not on the rail
 *
 * 08b:22 asks for the surface to be reachable from the app frame **without leaving the current
 * board**, and for opening and closing it to preserve the reader's place. So it is a panel over the
 * frame rather than a route: the address does not change, the conversation keeps its scroll, and
 * Escape returns focus to the control that opened it.
 */
export function Gatekeeper({
	boardId,
	canDecide,
	permissionsHeld,
}: {
	readonly boardId: string;
	/** Whether the reader holds `admit:agent` here. Drives the disabled state and its reason. */
	readonly canDecide: boolean;
	/** What the reader may hand out here — the bound, computed by the caller from the grants. */
	readonly permissionsHeld: readonly PermissionName[];
}) {
	const [open, setOpen] = useState(false);
	const opener = useRef<HTMLButtonElement | null>(null);
	const gate: GateClient = createGateClient();

	// Escape closes and returns focus to the control that opened the panel (08b:22). A panel that
	// swallowed Escape would trap a keyboard reader in a surface they cannot leave.
	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			setOpen(false);
			opener.current?.focus();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open]);

	return (
		<>
			<button
				type="button"
				ref={opener}
				onClick={() => setOpen((current) => !current)}
				// Disabled with a stated reason rather than hidden (§221): a principal without the gate
				// should know the surface exists and why they cannot use it.
				aria-disabled={!canDecide}
				aria-expanded={open}
				className="board-pane__filter"
				data-gatekeeper-toggle
			>
				Pending agents
			</button>
			{open ? (
				<GatekeeperPanel
					boardId={boardId}
					canDecide={canDecide}
					gate={gate}
					permissionsHeld={permissionsHeld}
					onClose={() => {
						setOpen(false);
						opener.current?.focus();
					}}
				/>
			) : null}
		</>
	);
}

/** The panel itself: pending requests, decisions already made, and the controls for each. */
function GatekeeperPanel({
	boardId,
	canDecide,
	gate,
	permissionsHeld,
	onClose,
}: {
	readonly boardId: string;
	readonly canDecide: boolean;
	readonly gate: GateClient;
	readonly permissionsHeld: readonly PermissionName[];
	readonly onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const pending = useQuery({
		queryKey: ["pending-agents", boardId],
		queryFn: () => gate.listPending(boardId),
		// A permission refusal is not transient, so a reader without the gate learns it at once rather
		// than after three attempts (the same rule the people view needed in 07a).
		retry: false,
		enabled: canDecide,
	});
	const decided = useQuery({
		queryKey: ["decided-agents", boardId],
		queryFn: () => gate.decided(boardId),
		retry: false,
		enabled: canDecide,
	});

	const refresh = async () => {
		await queryClient.invalidateQueries({
			queryKey: ["pending-agents", boardId],
		});
		await queryClient.invalidateQueries({
			queryKey: ["decided-agents", boardId],
		});
	};

	return (
		<aside aria-label="Pending agents" className="gatekeeper" role="dialog">
			<header className="gatekeeper__head">
				<h2 className="gatekeeper__title">Pending agents</h2>
				<button type="button" className="gatekeeper__close" onClick={onClose}>
					Close
				</button>
			</header>
			<div className="gatekeeper__body">
				{!canDecide ? (
					// The refusal as a stated state, not an empty list (§221, §263).
					<div className="gatekeeper__empty">
						<h3 className="gatekeeper__empty-title">
							You cannot decide admissions here
						</h3>
						<p className="gatekeeper__empty-detail">
							Deciding an admission needs the admit:agent permission on this
							board. A gate holder can grant it to a human participant.
						</p>
					</div>
				) : pending.isPending ? (
					<p className="knock-row__when">Reading the pending requests…</p>
				) : pending.error ? (
					<div className="gatekeeper__empty">
						<h3 className="gatekeeper__empty-title">
							The pending requests could not be read
						</h3>
						<p className="gatekeeper__empty-detail">{pending.error.message}</p>
					</div>
				) : (pending.data?.length ?? 0) === 0 ? (
					// Plainly empty, not an empty frame (DESIGN.md §263).
					<div className="gatekeeper__empty">
						<h3 className="gatekeeper__empty-title">No agents are waiting</h3>
						<p className="gatekeeper__empty-detail">
							When an agent asks to join this board, its request appears here
							for you to decide.
						</p>
					</div>
				) : (
					pending.data?.map((request) => (
						<PendingRow
							key={request.requestId}
							gate={gate}
							permissionsHeld={permissionsHeld}
							request={request}
							onDecided={refresh}
						/>
					))
				)}

				{/* What has already been decided, so a denial does not vanish (08b:19). */}
				{(decided.data?.length ?? 0) > 0 ? (
					<section>
						<h3 className="gatekeeper__empty-title">Already decided</h3>
						{decided.data?.map((request) => (
							<DecidedRow key={request.requestId} request={request} />
						))}
					</section>
				) : null}
			</div>
		</aside>
	);
}

/**
 * One pending request: the declared block, the bound permission set, the expiry, and the decision.
 *
 * The controls appear with the row rather than after a second click, because the decision and the
 * set it grants are one act (08b:17): choosing the set first and admitting second would make the set
 * look like a setting rather than part of the decision.
 */
function PendingRow({
	request,
	gate,
	permissionsHeld,
	onDecided,
}: {
	readonly request: PendingRequest;
	readonly gate: GateClient;
	readonly permissionsHeld: readonly PermissionName[];
	readonly onDecided: () => Promise<void>;
}) {
	const [selected, setSelected] = useState<readonly PermissionName[]>([
		"read:board",
	]);
	const [expiry, setExpiry] = useState<string>("168");
	const [denialReason, setDenialReason] = useState("");
	const [refusal, setRefusal] = useState<string | null>(null);
	const inFlight = useRef<{ active: boolean } | null>(null);

	/**
	 * **One decision per click, synchronously guarded.**
	 *
	 * The same defect 06c found live in the composer: React state updates are asynchronous, so two
	 * activations in one tick both read the old `pending` flag and both send. The ref is set before the
	 * await, so a double click makes one request — and admission is a mutation whose repetition would
	 * mint a second credential for a request that can only be collected once.
	 */
	const decide = async (kind: "admit" | "deny") => {
		if (inFlight.current?.active) return;
		inFlight.current = { active: true };
		setRefusal(null);
		try {
			if (kind === "admit") {
				const chosen: Expiry =
					expiry === "never"
						? { kind: "never" }
						: { kind: "bounded", hours: Number(expiry) };
				await gate.admit({
					requestId: request.requestId,
					permissions: selected,
					expiry: chosen,
				});
			} else {
				await gate.deny({
					requestId: request.requestId,
					reason: denialReason.trim() || "No reason given",
				});
			}
			await onDecided();
		} catch (error) {
			// **The row stays.** A refusal is information; closing the surface would lose the reader's
			// place and tell them nothing (08b:23).
			setRefusal(error instanceof Error ? error.message : String(error));
		} finally {
			if (inFlight.current) inFlight.current.active = false;
		}
	};

	return (
		<article className="knock-row" data-knock-row={request.requestId}>
			{/* The declared block, labelled and untinted (DESIGN.md §256). */}
			<p className="knock-row__declared-label">Declared</p>
			<div className="knock-row__declared">
				<strong>{request.declared.name}</strong>
				<span>Operator: {request.declared.operator}</span>
			</div>
			<p className="knock-row__reason">{request.declared.reason}</p>
			<p className="knock-row__when">
				Asked {new Date(request.requestedAt).toLocaleString()}
			</p>
			<p className="knock-row__derived">
				Nothing about this agent has been verified yet: issuer and fingerprint
				appear once the workspace derives them, after admission.
			</p>

			<fieldset className="knock-row__permissions">
				<legend className="knock-row__declared-label">
					Permissions to grant
				</legend>
				{permissionsHeld.length === 0 ? (
					<p className="knock-row__derived">
						You hold no permission on this board to hand out, so you cannot
						admit an agent here.
					</p>
				) : (
					permissionsHeld.map((permission) => (
						<label className="knock-row__permission" key={permission}>
							<input
								type="checkbox"
								checked={selected.includes(permission)}
								onChange={(event) =>
									setSelected((current) =>
										event.currentTarget.checked
											? [...current, permission]
											: current.filter((name) => name !== permission),
									)
								}
							/>
							{permission}
						</label>
					))
				)}
			</fieldset>

			<label className="knock-row__field">
				Admission lasts
				<select
					className="knock-row__select"
					value={expiry}
					onChange={(event) => setExpiry(event.currentTarget.value)}
				>
					{/* A bounded window is the default; never is available and visibly exceptional. */}
					<option value="24">24 hours</option>
					<option value="168">7 days</option>
					<option value="720">30 days</option>
					<option value="never">Never expires</option>
				</select>
			</label>

			{refusal === null ? null : (
				<p className="knock-row__refusal" role="alert">
					{refusal}
				</p>
			)}

			<div className="knock-row__controls">
				<label className="knock-row__field">
					Reason if denied
					<input
						className="knock-row__input"
						value={denialReason}
						onChange={(event) => setDenialReason(event.currentTarget.value)}
						placeholder="Told to the agent"
					/>
				</label>
				<div className="knock-row__actions">
					<button
						type="button"
						className="knock-row__deny"
						onClick={() => void decide("deny")}
					>
						Deny
					</button>
					<button
						type="button"
						className="knock-row__admit"
						onClick={() => void decide("admit")}
					>
						Admit
					</button>
				</div>
			</div>
		</article>
	);
}

/**
 * A decided request, kept as a record.
 *
 * Present because a denial a denyer cannot see afterwards is a decision made and forgotten — the
 * pending list would shrink with no trace of what happened or why (08b:19).
 */
function DecidedRow({ request }: { readonly request: DecidedRequest }) {
	return (
		<article className="knock-row knock-row--decided">
			<p className="knock-row__outcome">
				{request.outcome === "admitted" ? "Admitted" : "Denied"}
			</p>
			<div className="knock-row__declared">
				<strong>{request.declared.name}</strong>
				<span>Operator: {request.declared.operator}</span>
			</div>
			{request.outcome === "denied" && request.denialReason ? (
				<p className="knock-row__reason">
					Reason given: {request.denialReason}
				</p>
			) : null}
			{request.outcome === "admitted" && request.grantedPermissions ? (
				<p className="knock-row__when">
					Granted {request.grantedPermissions.join(", ")}
					{request.expiresAt
						? ` · until ${new Date(request.expiresAt).toLocaleDateString()}`
						: " · never expires"}
				</p>
			) : null}
		</article>
	);
}
