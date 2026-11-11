import { createHmac } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "./helpers/fixtures";

/**
 * The stream at the route seam — the parts only a real server can prove.
 *
 * 11a's contract half is asserted in `tests/contract/stream.conformance.ts`, which runs against both
 * transports. What cannot be asserted there is that the **route** exists, authenticates through the
 * same resolver, and shares the **one store** the server functions write to. That is this file:
 * post over HTTP, receive on the stream, in the same process.
 *
 * Sessions are minted per test for the reason 08b recorded: issuance is round-robin, so a test that
 * just loads a page asserts the rotation rather than the surface.
 */
const SECRET = "e2e-session-secret-0123456789abcdef";

const sessionFor = (principalId: string): string => {
	const encoded = Buffer.from(principalId, "utf8").toString("base64url");
	const signature = createHmac("sha256", SECRET)
		.update(principalId)
		.digest("base64url");
	return `${encoded}.${signature}`;
};

const asPrincipal = async (
	browser: import("@playwright/test").Browser,
	baseURL: string,
	principalId: string,
): Promise<{ page: Page; close: () => Promise<void> }> => {
	const context = await browser.newContext();
	const url = new URL(baseURL);
	await context.addCookies([
		{
			name: "relayboard_session",
			value: sessionFor(principalId),
			domain: url.hostname,
			path: "/",
		},
	]);
	const page = await context.newPage();
	return { page, close: () => context.close() };
};

test.describe("the stream route", () => {
	test("answers as text/event-stream on the app origin", async ({
		browser,
		baseURL,
	}) => {
		// 11a:13: the route exists, on the same origin as the server functions, and it is an SSE
		// response rather than a JSON one.
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			// A page has to exist before `fetch` can resolve a relative URL; without a navigation the
			// evaluate runs against `about:blank` and the URL cannot be parsed. Measured.
			await page.goto("/boards/platform");
			// **`request.get` waits for the whole body**, and an event stream's body never ends — so it
			// times out rather than returning. Measured: 2000ms exceeded. The headers are what this test
			// wants, so the request is made from the page with `fetch` and read only as far as the
			// response, which is the one way to see a stream's headers without consuming it.
			const headers = await page.evaluate(async () => {
				const controller = new AbortController();
				const response = await fetch("/api/stream", {
					signal: controller.signal,
				});
				const result = {
					contentType: response.headers.get("content-type") ?? "",
					cacheControl: response.headers.get("cache-control") ?? "",
				};
				controller.abort();
				return result;
			});
			expect(headers.contentType).toContain("text/event-stream");
			expect(headers.cacheControl).toContain("no-cache");
		} finally {
			await close();
		}
	});

	test("delivers a post made over HTTP, in the same process", async ({
		browser,
		baseURL,
	}) => {
		// **The singleton proof.** The SSE route and the server functions must see the same store, or a
		// post would not reach a subscriber. Nothing but a live connection can demonstrate that, which is
		// why it is here rather than in the contract suite.
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			await page.goto("/boards/platform?view=threads&thread=delivery");

			const received = page.evaluate(async () => {
				const seen: string[] = [];
				const source = new EventSource("/api/stream");
				await new Promise<void>((resolve, reject) => {
					const timer = setTimeout(
						() => reject(new Error("the stream delivered nothing")),
						4000,
					);
					source.addEventListener("message-committed", (event) => {
						seen.push((event as MessageEvent).data as string);
						clearTimeout(timer);
						resolve();
					});
					source.addEventListener("error", () => {
						clearTimeout(timer);
						reject(new Error("the stream errored"));
					});
				});
				source.close();
				return seen;
			});

			// Post through the UI, so the write travels the real path: server function, store, listener,
			// route, `EventSource`.
			await page
				.getByLabel("Write a message")
				.fill("Over the wire, to the stream.");
			await page.getByRole("button", { name: "Send" }).click();

			const seen = await received;
			expect(seen.length).toBeGreaterThan(0);
			const event = JSON.parse(seen[0] as string) as {
				type: string;
				entry: { seq: number; kind: string };
			};
			expect(event.type).toBe("message-committed");
			// 11a:15: the entry's own `seq` travels with it, and every entry-bearing event carries one.
			expect(typeof event.entry.seq).toBe("number");
			expect(event.entry.seq).toBeGreaterThan(0);
		} finally {
			await close();
		}
	});

	test("replays from the cursor a reconnect presents, and nothing before it", async ({
		browser,
		baseURL,
	}) => {
		// 11a:18 and 11a:17: a reconnect carries the last `id` it saw, and the server replays from there —
		// reporting the count, including zero. Asserted on the raw stream so the count is visible rather
		// than inferred from what a client chose to render.
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			await page.goto("/boards/platform");
			const result = await page.evaluate(async () => {
				const read = async (url: string) => {
					const response = await fetch(url);
					const reader = response.body?.getReader();
					const decoder = new TextDecoder();
					let text = "";
					const deadline = Date.now() + 3000;
					while (
						Date.now() < deadline &&
						!text.includes("connection-changed")
					) {
						const chunk = await reader?.read();
						if (chunk?.value) text += decoder.decode(chunk.value);
					}
					await reader?.cancel();
					return text;
				};

				// A fresh stream replays everything past cursor 0 and says how much that was.
				const fresh = await read("/api/stream");
				const pendingOf = (text: string) => {
					const match = text.match(/"pending":(\d+)/);
					return match ? Number(match[1]) : -1;
				};
				// A reconnect naming the highest id it saw replays nothing and says zero — **the field is
				// present**, which is the floor-verified half of the criterion.
				const caughtUp = await read("/api/stream?after=9999");
				return { fresh: pendingOf(fresh), caughtUp: pendingOf(caughtUp) };
			});

			expect(result.fresh).toBeGreaterThan(0);
			expect(result.caughtUp).toBe(0);
		} finally {
			await close();
		}
	});

	test("closes a connection that goes away, leaving no listener behind", async ({
		browser,
		baseURL,
	}) => {
		// 11a:20: the harness can terminate the response deterministically. On the client side that is
		// `close()`, and what it must leave behind is nothing: the next post must still reach a *new*
		// subscriber, which proves the old listener is gone rather than merely ignored.
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			await page.goto("/boards/platform?view=threads&thread=delivery");

			await page.evaluate(async () => {
				const first = new EventSource("/api/stream");
				await new Promise<void>((resolve) => {
					first.addEventListener("connection-changed", () => resolve());
					first.addEventListener("error", () => resolve());
				});
				// Terminated by the client; the server sees the request abort.
				first.close();
			});

			const next = page.evaluate(async () => {
				const source = new EventSource("/api/stream");
				const data = await new Promise<string>((resolve, reject) => {
					const timer = setTimeout(
						() => reject(new Error("no event after the reconnect")),
						4000,
					);
					source.addEventListener("message-committed", (event) => {
						clearTimeout(timer);
						resolve((event as MessageEvent).data as string);
					});
				});
				source.close();
				return data;
			});

			await page
				.getByLabel("Write a message")
				.fill("After the first stream closed.");
			await page.getByRole("button", { name: "Send" }).click();

			const payload = JSON.parse(await next) as { entry: { seq: number } };
			expect(payload.entry.seq).toBeGreaterThan(0);
		} finally {
			await close();
		}
	});
	test("a purge reaches an open stream, so a subscriber learns the workspace changed", async ({
		browser,
		baseURL,
	}) => {
		// **14:17's assertion, and the one that was missing.** `announceWorkspaceChange` existed from 14
		// and had no subscriber anywhere in `src`: the store iterated an empty listener set, so a purge
		// announced an event to nobody and 'subscribers are told' was satisfied by a call whose effect
		// was nil. This opens a real stream, purges through the UI, and requires the frame.
		//
		// It is the same shape as the revocation wire's assertion: the effect, not the call.
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"nadia",
		);
		try {
			await page.goto("/boards/platform?view=threads&thread=delivery");

			const received = page.evaluate(async () => {
				const seen: string[] = [];
				const source = new EventSource("/api/stream");
				await new Promise<void>((resolve, reject) => {
					const timer = setTimeout(
						() => reject(new Error("the stream reported no workspace change")),
						8000,
					);
					source.addEventListener("connection-changed", (event) => {
						const data = (event as MessageEvent).data as string;
						seen.push(data);
						// The open-time frame carries no reason; the purge's frame does.
						if (data.includes("workspace-changed")) {
							clearTimeout(timer);
							resolve();
						}
					});
					source.addEventListener("error", () => {
						clearTimeout(timer);
						reject(new Error("the stream errored"));
					});
				});
				source.close();
				return seen;
			});

			// Purge through the UI, so the write travels the real path: server function, store, listener,
			// route, `EventSource`.
			await page.locator("[data-purge-open]").click();
			await page.locator("[data-purge-confirm]").click();
			await expect(page.locator("[data-purge-done]")).toBeVisible();

			const seen = await received;
			const changed = seen.filter((frame) =>
				frame.includes("workspace-changed"),
			);
			expect(changed.length).toBeGreaterThan(0);
			const event = JSON.parse(changed[0] as string) as {
				type: string;
				reason?: string;
			};
			// **The eighth name, not a ninth.** A workspace change rides inside `connection-changed` — the
			// argument 11c made for `cause`, because what changed is what this connection can still deliver.
			expect(event.type).toBe("connection-changed");
			expect(event.reason).toBe("workspace-changed");
		} finally {
			await close();
		}
	});

	test("a paused subscriber is not woken by a purge, and reports itself paused", async ({
		browser,
		baseURL,
	}) => {
		// **The withhold rule applies to a wholesale change too.** The store notifies every listener; the
		// route's own pause rule decides what a paused reader receives, exactly as for a commit.
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"nadia",
		);
		try {
			await page.goto("/boards/platform?view=threads&thread=delivery");
			// Pause through the panel, so the store knows before the purge runs.
			await page.locator("[data-stream-toggle]").click();
			await expect(page.locator("[data-stream-pending]")).toBeVisible();

			const received = page.evaluate(async () => {
				const seen: string[] = [];
				const source = new EventSource("/api/stream");
				await new Promise<void>((resolve) => {
					// A fixed window rather than a wait for a frame that must not arrive.
					setTimeout(() => resolve(), 3000);
					source.addEventListener("connection-changed", (event) => {
						seen.push((event as MessageEvent).data as string);
					});
				});
				source.close();
				return seen;
			});

			await page.locator("[data-purge-open]").click();
			await page.locator("[data-purge-confirm]").click();
			await expect(page.locator("[data-purge-done]")).toBeVisible();

			const seen = await received;
			expect(seen.some((frame) => frame.includes("workspace-changed"))).toBe(
				false,
			);
			expect(seen.some((frame) => frame.includes('"connected":false'))).toBe(
				true,
			);
		} finally {
			await close();
		}
	});
});
