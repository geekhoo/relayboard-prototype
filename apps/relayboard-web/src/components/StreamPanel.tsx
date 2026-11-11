import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { StreamState } from "#/client";
import { useActingClient } from "#/client/context";
import {
	conversationPositionsQuery,
	conversationQuery,
	streamStateQuery,
} from "#/components/-conversation-queries";
import { unreadQuery } from "#/components/-rail-queries";
import "./StreamPanel.css";

/**
 * The message stream panel: Live / Paused, the pending count, and the control that pauses delivery.
 *
 * ## What is the panel's and what is the server's
 *
 * The **affordance and the words** are this component's. The **state** is the store's, reached through
 * `setConnection` — and that split is the whole design, so it is worth stating plainly:
 *
 * A pause that lived only in this component would leave the reader's `cursor` advancing with every
 * commit, so a resume would replay nothing and `pending` would always be zero. Spec L360 and 11a:16-17
 * require the opposite: no server-side queue, a withheld subscriber, and a replay **computed from the
 * difference between the cursor and the thread's last seq**. That difference only exists if the cursor
 * held still, which only happens if the pause is known where the cursor lives.
 *
 * 11b:17 previously required this control to be a no-op; it was amended, and the amendment is right. See
 * the ticket for the reasoning and for the three criteria that would have passed while nothing paused.
 *
 * ## Why the count is derived and never counted
 *
 * `pending` comes back from `setConnection`/`subscribe` as the store's own answer, computed from the
 * cursor. This component never increments a number of its own: a second counter is a second source of
 * truth, and it would disagree with the watermarks the moment a reload or a second tab changed them.
 */
/**
 * The message stream panel: Live / Paused, the pending count, the control that pauses delivery, and
 * the demo's own simulation control.
 *
 * ## The simulation control says it is a simulation
 *
 * 11b:23 and stories 51-52: the control that makes an agent appear to speak must state, where it is,
 * that it is a demonstration rather than another participant. The footnote is not decoration —
 * `simulateIncoming` picks the author **server-side** from the board's agent members (spec L377), so
 * the caller never says who spoke; but nothing about that stops a reader believing an agent is
 * connected, and the panel says so.
 */
export function StreamPanel({
	boardId,
	threadId,
}: {
	readonly boardId: string;
	readonly threadId: string;
}) {
	const client = useActingClient();
	const queryClient = useQueryClient();
	const [state, setState] = useState<StreamState>({
		connected: true,
		pending: 0,
	});
	const [log, setLog] = useState<readonly string[]>([]);
	/**
	 * **One toggle per click, synchronously guarded** — the pattern 06c found, 08b applied to decisions
	 * and 09 to creates. Fourth surface, same shape: React state is asynchronous, so two activations in
	 * one tick would both read the old `connected` and send two contradictory pauses.
	 */
	const inFlight = useRef(false);

	const append = useCallback((line: string) => {
		setLog((current) => [line, ...current].slice(0, 8));
	}, []);

	/**
	 * The demo act: commit a line as one of the board's agents.
	 *
	 * The author is chosen server-side, so this button cannot claim to be anybody. What it does do is
	 * exercise the path a real agent would take — a commit, an event, a delivery — which is why the
	 * paused-withholding criterion is asserted through it rather than through the reader posting: a
	 * principal always sees its **own** entries, paused or not (the store's `readView`), so posting as
	 * the reader would prove nothing about withholding.
	 */
	const simulate = useCallback(async () => {
		if (inFlight.current) return;
		inFlight.current = true;
		try {
			const entry = await client.simulateIncoming(threadId);
			append(`Agent committed #${entry.seq.toString()}`);
			await queryClient.invalidateQueries({
				queryKey: unreadQuery(client).queryKey,
			});
		} finally {
			inFlight.current = false;
		}
	}, [append, client, queryClient, threadId]);

	const toggle = useCallback(async () => {
		if (inFlight.current) return;
		inFlight.current = true;
		try {
			const next = await client.setConnection({ connected: !state.connected });
			setState(next);
			// **The atom, not just this component.** The conversation withholds entries while paused and
			// reads the same value; two copies of "am I paused" would be two answers to one question.
			queryClient.setQueryData(streamStateQuery(client).queryKey, next);
			if (next.connected) {
				// **The prototype's wording** (app.js L118), because 15a checks parity against it and the
				// sentence is the product's account of what happened, not an implementation detail.
				append(
					next.pending === 1
						? "Replayed 1 missed message"
						: next.pending > 1
							? `Replayed ${next.pending.toString()} missed messages`
							: "No missed messages to replay",
				);
				// **The replay delivered entries the cache does not have**, so the chronology itself is stale
				// — not only the counts. This is the question 09 raised when a created board left the rail
				// stale, and the answer is the same: name the queries the act changed.
				await queryClient.invalidateQueries({
					queryKey: conversationQuery(client, threadId).queryKey,
				});
				await queryClient.invalidateQueries({
					queryKey: conversationPositionsQuery(client, threadId).queryKey,
				});
				await queryClient.invalidateQueries({
					queryKey: unreadQuery(client).queryKey,
				});
			} else {
				append("Subscription paused");
			}
		} finally {
			inFlight.current = false;
		}
	}, [append, client, queryClient, state.connected, threadId]);

	/**
	 * The stream itself, applied to the cache and to nothing else (11a:23).
	 *
	 * Subscribed here rather than only in `Conversation`, because the panel must know when a delivery
	 * arrives while paused in order to keep its count honest — and the count it keeps is the one the
	 * server sent, not one it computed.
	 */
	useEffect(() => {
		const unsubscribe = client.subscribe({
			onEvent: (event) => {
				if (event.type === "connection-changed") {
					const next = {
						connected: event.connected,
						pending: event.pending,
					};
					setState(next);
					queryClient.setQueryData(streamStateQuery(client).queryKey, next);
					return;
				}
				if (
					event.type === "message-committed" ||
					event.type === "artifact-attached" ||
					event.type === "status-moved" ||
					event.type === "acknowledged"
				) {
					append(`Delivered #${event.entry.seq.toString()}`);
				}
			},
		});
		return unsubscribe;
	}, [append, client, queryClient]);

	// While paused, the count has to follow the store: new commits are withheld, so the difference
	// between the cursor and the last seq grows.
	const pendingQuery = useQuery({
		queryKey: [
			"stream-pending",
			boardId,
			client.actingPrincipalId,
			state.connected,
		] as const,
		queryFn: async () => {
			const answer = await client.setConnection({ connected: state.connected });
			return answer.pending;
		},
		// Polled only while paused, and only for a count. A paused reader is not receiving, so there is
		// nothing to subscribe to; the number is the store's answer to a question, asked again.
		enabled: !state.connected,
		refetchInterval: 1000,
	});

	const pending = state.connected ? 0 : (pendingQuery.data ?? state.pending);

	return (
		<section aria-label="Message stream" className="stream-panel">
			<p className="stream-panel__state">
				<span
					aria-hidden="true"
					className={
						state.connected
							? "stream-panel__dot stream-panel__dot--live"
							: "stream-panel__dot stream-panel__dot--paused"
					}
				/>
				{/* **A colour and a word**, never the colour alone (DESIGN.md §277, §292). */}
				<span data-stream-state>{state.connected ? "Live" : "Paused"}</span>
				{state.connected ? null : (
					<span data-stream-pending>
						{" · "}
						{pending}
					</span>
				)}
			</p>
			<p className="stream-panel__detail">
				{state.connected
					? "New events are delivered as they commit. Every entry stays in durable history."
					: pending === 0
						? "Nothing is waiting to replay. New posts are still committed to history."
						: pending === 1
							? "1 entry is awaiting replay. New posts are still committed to history."
							: pending.toString() +
								" entries are awaiting replay. New posts are still committed to history."}
			</p>
			<button
				className="stream-panel__toggle"
				data-stream-toggle
				type="button"
				onClick={() => void toggle()}
			>
				{state.connected ? "Pause stream" : "Reconnect & replay"}
			</button>
			<button
				className="stream-panel__toggle"
				data-stream-simulate
				type="button"
				onClick={() => void simulate()}
			>
				Simulate agent post
			</button>
			<p className="stream-panel__section">Delivery activity</p>
			<div className="stream-panel__log" data-stream-log>
				{log.length === 0 ? (
					<p className="stream-panel__empty">No activity yet.</p>
				) : (
					log.map((line, index) => (
						<p className="stream-panel__line" key={line + index.toString()}>
							{line}
						</p>
					))
				)}
			</div>
			<p className="stream-panel__note">
				Pausing withholds delivery. Nothing is queued: resuming replays from
				your own read position.
			</p>
			<p className="stream-panel__note" data-stream-simulation-note>
				{/*
				 * The prototype's own footnote (index.html L96), kept because it is the sentence that
				 * keeps the demo honest: no agent is connected. 11b:23 and stories 51-52 require the
				 * simulation control to say so where it is, and the store's own lifetime note is not the
				 * same claim — that one is about persistence, this one is about who is speaking.
				 */}
				Simulation only. No agent is connected: the line above is committed by
				this workspace on an agent's behalf, and every event is delivered by
				this server.
			</p>
		</section>
	);
}
