import { createFileRoute } from "@tanstack/react-router";
import { actingPrincipal } from "#/server/session";
import { getStore } from "#/server/store/instance";
import {
	connectionChanged,
	cursorFromHeader,
	entryCommitted,
	frameOf,
} from "#/server/stream";

/**
 * The stream: `text/event-stream` on the same origin as the server functions.
 *
 * ## Why a server route and not a server function
 *
 * Spec L357: a server function returns one response and closes, so a subscription cannot be one. This is
 * the ticket that makes the distinction real — `subscribe` has thrown naming 11a since 03, and it now
 * has somewhere to connect to.
 *
 * ## Why the same resolver
 *
 * `actingPrincipal()` is called here exactly as every handler calls it. 06b built it as a plain function
 * rather than as request middleware **precisely so a server route could use it** — its own comment says
 * so — and 11a:13 asks for no second mechanism. The consequence worth stating: this route issues a
 * session to a browser that has none, which is the same act a page load performs.
 *
 * ## It keeps no queue
 *
 * A paused subscriber's events are withheld rather than buffered (11a:16), and a reconnect replays from
 * the subscriber's **cursor** — the store's watermark, which is the one source of truth for what a
 * reader has missed. A queue here would be a second source, and 11b derives the pending count from the
 * cursor.
 *
 * ## What the store cannot tell it, and what was added
 *
 * The commit listener carries a workspace-wide `delivered` flag: false when *any* principal is paused.
 * A stream serving one reader needs **that reader's** answer, so `store.isPaused` was added. The
 * alternative — one listener per principal — is a queue by another name.
 */
/**
 * The route id must be a **string literal** for the router's codegen: a template literal of a constant
 * is rejected ("expected route id to be a string literal"), measured. So the literal is written here
 * and the parity with `STREAM_PATH` — which the HTTP client and the harness both use — is asserted by
 * `tests/stream-contract.test.ts` rather than by sharing the value. A second copy that nothing compares
 * would be the defect; a second copy with an assertion is the constraint the framework imposes.
 */
export const Route = createFileRoute("/api/stream")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const store = getStore();
				const principal = actingPrincipal();
				// A reconnect carries the last `id` the browser saw; a fresh one carries nothing. Either way
				// the cursor comes from the header or from zero, never from an assumption.
				// Two ways to name a cursor, and both are needed. `Last-Event-ID` is what the browser
				// sends when **it** reconnects a connection that dropped (11a:18); `?after=` is what the
				// client sends when it opens a **new** `EventSource` after a transport failure, because a
				// new instance does not inherit the header. Measured: without the parameter, a re-open
				// replayed the whole thread.
				const from = Math.max(
					cursorFromHeader(request.headers.get("last-event-id")),
					cursorFromHeader(new URL(request.url).searchParams.get("after")),
				);

				const encoder = new TextEncoder();
				let unsubscribe: (() => void) | undefined;
				/** The workspace-change listener's own unsubscribe, so `close` leaves no listener behind. */
				let stopForWorkspace: (() => void) | undefined;
				let closed = false;

				const close = () => {
					closed = true;
					unsubscribe?.();
					unsubscribe = undefined;
					stopForWorkspace?.();
					stopForWorkspace = undefined;
				};

				const body = new ReadableStream<Uint8Array>({
					start(controller) {
						const send = (chunk: string) => {
							if (closed) return;
							try {
								controller.enqueue(encoder.encode(chunk));
							} catch {
								// The stream is already gone. Marking it closed stops the listener loop rather than
								// letting it throw once per commit for the life of the process.
								close();
							}
						};

						// **The open-time check**, because a connection can be opened after the ending: a reader
						// that reloads with a revoked credential must be told, not handed a stream that then
						// closes as if the transport failed.
						const endedAtOpen = store.accessEndedFor(principal.id);
						if (endedAtOpen !== undefined) {
							send(frameOf(connectionChanged(false, 0, endedAtOpen)));
							close();
							try {
								controller.close();
							} catch {
								// Already closed.
							}
							return;
						}

						// **Replay first, then report the count.** The entries past the client's cursor are
						// exactly what it missed, and the count is reported in `connection-changed` with
						// `pending` always present — including zero (11a:17).
						let pending = 0;
						for (const board of store.listBoards()) {
							for (const thread of store.listThreads(board.id)) {
								for (const entry of store.readEntries(thread.id)) {
									if (entry.seq <= from) continue;
									// The reader's own entries are not a replay of something it missed.
									pending += 1;
									send(
										frameOf(entryCommitted(thread.id, entry, true), entry.seq),
									);
								}
							}
						}
						// **The reader's actual state, not an assumption.** This reported `connected: true`
						// unconditionally until 11b:21's test caught it: a reader who paused, navigated to
						// another thread and came back was told it was live while the store still had it
						// paused — so the panel said "Live" and the withhold filter stood down, and the
						// withheld entry appeared. The store is the authority; this reads it.
						send(
							frameOf(
								connectionChanged(!store.isPaused(principal.id), pending),
							),
						);

						/**
						 * **A closed stream is announced before it is closed** (11c:14).
						 *
						 * The `access-ended` frame is not one of the eight wire events: the wire vocabulary is fixed
						 * by spec L358 and a ninth name would break 11a's own literal-set assertion. So the ending
						 * travels as a `connection-changed` with `connected: false`, and the **cause rides in the
						 * same payload** — which is what lets the client tell "your access ended" from "the
						 * connection dropped", and therefore whether to retry.
						 */
						const stopForCause = store.onAccessEnded((event) => {
							if (event.principalId !== principal.id) return;
							send(frameOf(connectionChanged(false, 0, event.cause)));
							// The stream ends. Closing it is the point: a revoked principal must not hold a live
							// connection it may no longer read, and leaving it open would keep the listener and
							// the response alive for a reader that will be refused on every other request.
							close();
							try {
								controller.close();
							} catch {
								// Already closed by the client.
							}
						});

						/**
						 * **A wholesale change to the workspace, announced rather than inferred** (14:17).
						 *
						 * A purge removes records every open connection's cursor and cached chronology describe, so a
						 * subscriber that is not told has to deduce it from a thread that stopped existing — which is the
						 * "failure from silence" the criterion forbids. This listener existed from 14 and had **no
						 * subscriber anywhere**, which made `announceWorkspaceChange` a call whose effect was nil.
						 *
						 * The frame is the existing `connection-changed` with a `reason` inside it, not a ninth wire name:
						 * 11c's decision, argued at L130 above, applied again. What changed *is* what this connection can
						 * still deliver, so it is a connection-relevant fact rather than new vocabulary.
						 *
						 * **A paused reader is not disturbed**, exactly as for a commit — and withholding is safe here for
						 * the same reason it is safe there: resuming re-reads the chronology, so a reader who was paused
						 * learns the workspace changed when they come back rather than being woken for it.
						 */
						stopForWorkspace = store.onWorkspaceChange(() => {
							// **A paused reader is not disturbed**, and this early return is what makes the frame
							// below honestly say `connected: true`: it is only ever sent to a reader the store
							// says is connected. Withholding is safe here for the reason it is safe for a commit
							// — resuming re-reads the chronology — so a paused reader learns the workspace
							// changed when they come back rather than being woken for it.
							if (store.isPaused(principal.id)) return;
							send(
								frameOf(
									connectionChanged(true, 0, undefined, "workspace-changed"),
								),
							);
						});

						unsubscribe = store.onCommit((commit) => {
							// **Withheld, not queued.** A paused principal receives nothing and its cursor does
							// not advance, so a resume replays exactly these entries from the cursor. The
							// per-principal question is asked rather than the commit's workspace-wide flag.
							if (store.isPaused(principal.id)) return;
							send(
								frameOf(
									entryCommitted(commit.threadId, commit.entry, true),
									commit.entry.seq,
								),
							);
						});

						// A reader that navigates away must not leave a listener in the store. The abort signal
						// is the only notification of that.
						request.signal.addEventListener("abort", () => {
							stopForCause();
							// `close()` stops the commit listener and the workspace-change listener together, so an
							// aborted request leaves neither behind.
							close();
						});
					},
					cancel() {
						// Both the abort listener and the stream's own cancellation can fire; closing twice is
						// harmless because the store's set delete is idempotent, and doing it in both is what
						// guarantees no listener survives a connection.
						close();
					},
				});

				return new Response(body, {
					headers: {
						"content-type": "text/event-stream; charset=utf-8",
						"cache-control": "no-cache, no-transform",
						connection: "keep-alive",
						// A proxy that buffers turns a stream into a delayed response; this is the standard way
						// to ask it not to.
						"x-accel-buffering": "no",
					},
				});
			},
		},
	},
});
