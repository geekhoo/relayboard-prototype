import { createHmac } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "./helpers/fixtures";

/**
 * The stream panel at the route seam — written **before** the panel existed.
 *
 * 11a left one criterion with a named hole: the pause's *wire* path was asserted by nothing, because a
 * server function cannot be driven under `vitest run` (06c measured that) and 11a built no control for
 * the route seam to click. This ticket builds the control, so this file closes the hole — and it came
 * first, deliberately: a test written after a control is a test shaped by it.
 *
 * ## Two things the first draft of this file got wrong, and both are product facts
 *
 * 1. **A reader always sees its own entries**, paused or not — the store's `readView` says so, and the
 *    prototype does the same (`app.js` L130). So withholding cannot be demonstrated by the reader
 *    posting: it needs an **agent's** commit, which is what `[data-stream-simulate]` produces.
 * 2. **A paused reader is not told the header count rose**, because the count is read from the cached
 *    chronology and nothing refetches it while paused. That is not a defect — it is why the panel's
 *    pending count exists — so the assertions are: view unchanged *and* hopw many are waiting, then
 *    after resuming, the view and the header count agree again.
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

const openThread = async (page: Page) => {
	await page.goto("/boards/platform?view=threads&thread=delivery");
	await expect(page.locator(".entry").first()).toBeVisible();
};

/**
 * A simulated agent commit, **waited for**.
 *
 * The panel's simulate control is guarded by a ref so two overlapping clicks produce one post — the
 * same guard the composer and the decide controls have. Playwright's `click()` resolves when the event
 * is dispatched, not when the async handler finishes, so two clicks in a row would have the second
 * dropped by the guard. Waiting for the pending count to move is what makes the second click a
 * second click; without it the test would assert a number it had prevented.
 */
const simulateAndWait = async (page: Page, expected: number) => {
	await page.locator("[data-stream-simulate]").click();
	await expect(page.locator("[data-stream-pending]")).toHaveText(
		new RegExp(`\\b${expected.toString()}\\b`),
	);
};

test.describe("the stream panel", () => {
	test("pausing withholds an agent post from the view, and resuming delivers it", async ({
		browser,
		baseURL,
	}) => {
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			await openThread(page);
			const visibleBefore = await page.locator(".entry").count();

			await page.locator("[data-stream-toggle]").click();
			await expect(page.locator("[data-stream-state]")).toHaveText(/paused/i);

			await simulateAndWait(page, 1);

			// **Withheld**: the view is unchanged, and the entry is not in it.
			await expect(page.locator(".entry")).toHaveCount(visibleBefore);

			// **And withheld from a cache that does contain it.** The line above alone would pass while the
			// conversation cache was simply stale — measured: disabling the withhold filter left this
			// test green, because nothing had refetched the chronology since the agent committed. So the
			// chronology is refetched deliberately (open another thread and come back, which re-primes it)
			// and the entry must *still* be absent: from here, only the filter keeps it out.
			await page.goto("/boards/platform?view=threads&thread=identity");
			await expect(page.locator(".conversation__title")).toHaveText(
				/Agent identity/,
			);
			await page.goto("/boards/platform?view=threads&thread=delivery");
			await expect(page.locator(".conversation__title")).toHaveText(
				/Durable message/,
			);
			await expect(page.locator(".entry")).toHaveCount(visibleBefore);

			// **And it is in history**: resuming delivers it, the view grows by one, and the header count
			// — which reads the chronology — agrees.
			await page.locator("[data-stream-toggle]").click();
			await expect(page.locator("[data-stream-state]")).toHaveText(/live/i);
			await expect(page.locator(".entry")).toHaveCount(visibleBefore + 1);
			await expect(page.locator(".conversation__subtitle")).toContainText(
				new RegExp(`${(visibleBefore + 1).toString()} entries`),
			);
		} finally {
			await close();
		}
	});

	test("a paused reader is told how many entries are waiting, derived from the cursor", async ({
		browser,
		baseURL,
	}) => {
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			await openThread(page);
			await expect(page.locator("[data-stream-pending]")).toHaveCount(0);

			await page.locator("[data-stream-toggle]").click();
			await simulateAndWait(page, 1);
			await simulateAndWait(page, 2);

			// The number is the store's answer, computed from the cursor: two commits past a cursor that
			// held still. Nothing in the panel counts.
			await expect(page.locator("[data-stream-pending]")).toHaveText(/2/);
			await expect(page.locator(".stream-panel__detail")).toContainText(
				/2 entries are awaiting replay/,
			);
		} finally {
			await close();
		}
	});

	test("resuming replays the withheld entries in `seq` order and reports the count", async ({
		browser,
		baseURL,
	}) => {
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			await openThread(page);
			const visibleBefore = await page.locator(".entry").count();
			await page.locator("[data-stream-toggle]").click();
			await simulateAndWait(page, 1);
			await simulateAndWait(page, 2);

			await page.locator("[data-stream-toggle]").click();
			await expect(page.locator("[data-stream-state]")).toHaveText(/live/i);

			// Both entries are in the view, in `seq` order — asserted on the rendered sequence numbers,
			// which is the stronger claim than matching prose.
			await expect(page.locator(".entry")).toHaveCount(visibleBefore + 2);
			const seqs = await page
				.locator("[data-entry-seq]")
				.evaluateAll((nodes) =>
					nodes.map((node) => Number(node.getAttribute("data-entry-seq"))),
				);
			expect(seqs).toEqual(
				Array.from({ length: seqs.length }, (_, index) => index + 1),
			);
			await expect(page.locator("[data-stream-pending]")).toHaveCount(0);

			// The replay is reported in the prototype's wording (app.js L118), because 15a checks parity
			// against that copy.
			await expect(page.locator("[data-stream-log]")).toContainText(
				/Replayed 2 missed messages/,
			);
		} finally {
			await close();
		}
	});

	test("the indicator is a word as well as a colour, and never says Live while paused", async ({
		browser,
		baseURL,
	}) => {
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			await openThread(page);
			const state = page.locator("[data-stream-state]");
			await expect(state).toHaveText(/live/i);
			await expect(page.locator("[data-stream-toggle]")).toHaveText(
				/pause stream/i,
			);

			await page.locator("[data-stream-toggle]").click();
			await expect(state).toHaveText(/paused/i);
			await expect(state).not.toHaveText(/live/i);
			await expect(page.locator("[data-stream-toggle]")).toHaveText(
				/reconnect & replay/i,
			);
		} finally {
			await close();
		}
	});

	test("a reload mid-thread restores the same thread, and only the location is stored", async ({
		browser,
		baseURL,
	}) => {
		// 11b:19. Two halves, and the second is the one worth asserting: the **address** carries the
		// thread, so a reload is already lossless; and `localStorage` holds the address and nothing else,
		// so no watermark has leaked into the browser (spec L505).
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			await page.goto("/boards/platform?view=threads&thread=identity");
			await expect(page.locator(".conversation__title")).toHaveText(
				/Agent identity/,
			);

			await page.reload();
			await expect(page.locator(".conversation__title")).toHaveText(
				/Agent identity/,
			);

			// And the bare root lands back in the workspace the reader was in, rather than dropping to a
			// default that ignores where they were.
			await page.goto("/");
			await expect(page.locator(".board-pane__title")).toContainText(
				/Platform/i,
			);

			// Only the location is stored: no cursor, no seen, no acknowledgement.
			const stored = await page.evaluate(() =>
				Object.keys(window.localStorage).map((key) => ({
					key,
					value: window.localStorage.getItem(key) ?? "",
				})),
			);
			expect(stored.length).toBeGreaterThan(0);
			for (const entry of stored) {
				expect(entry.value).not.toMatch(/cursor|seen|acknowledged|watermark/i);
			}
		} finally {
			await close();
		}
	});

	test("the paused state survives navigating away and back", async ({
		browser,
		baseURL,
	}) => {
		// 11b:21. The first version of this failed, and it found a real defect: subscribing reported
		// `connected: true` unconditionally, so a returning reader was told it was live while the store
		// still had it paused — the panel said Live and the withhold filter stood down.
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			await openThread(page);
			await page.locator("[data-stream-toggle]").click();
			await expect(page.locator("[data-stream-state]")).toHaveText(/paused/i);

			await page.goto("/boards/platform?view=threads&thread=identity");
			await expect(page.locator(".conversation__title")).toHaveText(
				/Agent identity/,
			);
			await page.goto("/boards/platform?view=threads&thread=delivery");

			// Still paused, because the store still holds it — the panel reads the store rather than
			// assuming a fresh connection is a live one.
			await expect(page.locator("[data-stream-state]")).toHaveText(/paused/i);
			await expect(page.locator("[data-stream-toggle]")).toHaveText(
				/reconnect & replay/i,
			);

			// **Or the interface says plainly that it does not.** That is the criterion's own alternative,
			// and this asserts the first branch: it does preserve it.
			await expect(page.locator("[data-stream-pending]")).toBeVisible();
		} finally {
			await close();
		}
	});

	test("the simulation control states that it is a demonstration", async ({
		browser,
		baseURL,
	}) => {
		// 11b:23 and stories 51-52: the control must not read as another participant being connected.
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			await openThread(page);
			await expect(page.locator("[data-stream-simulate]")).toBeVisible();
			await expect(page.locator("[data-stream-simulation-note]")).toContainText(
				/Simulation only/i,
			);
			await expect(page.locator("[data-stream-simulation-note]")).toContainText(
				/No agent is connected/i,
			);
		} finally {
			await close();
		}
	});
});
