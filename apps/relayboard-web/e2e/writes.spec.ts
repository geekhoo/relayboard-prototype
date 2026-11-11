import {
	expect,
	MEMORY_ONLY_REASON,
	SHARED_WORKSPACE,
	test,
} from "./helpers/fixtures";
import { postAs, renderedEntries, whoAmI } from "./helpers/participants";

/**
 * The write operations, over the real transport, from a browser.
 *
 * ## Why this file exists, and why the Node suite cannot do this
 *
 * 06c:17 asks for 03's conformance suite to run unchanged against the HTTP client, with both runs
 * part of `npm test`. **That is not achievable, and the reason is measured rather than assumed.**
 *
 * `createServerFn` does not produce something that can talk over the wire until the plugin's AST
 * transform has replaced the handler with an extracted fetcher carrying a `url`. Under `vitest run`
 * that transform does not run: creating one and inspecting it yields exactly
 * `["method", "__executeServer"]` — no `url`, no `serverFnMeta` — and calling it throws "No Start
 * context found in AsyncLocalStorage". Adding `tanstackStart()` to a probe vitest config changes
 * nothing, because the transformer belongs to the build pipeline rather than to a test runner's
 * transform chain. I tried four variants: the bare client, a probe config with the plugin, a fake
 * `window`, and a patched `fetch`. All four fail at the same line, for the same reason.
 *
 * So the RPC half of a server function **only exists in a build**, and a Node test cannot exercise
 * it short of building first and hand-encoding the seroval frame — which 06a attempted and reported
 * as unreliable, and which the Lead has since ruled out.
 *
 * What that leaves is this file: the same claims, asserted where the transport is real. The browser's
 * client **is** the HTTP one, every call below crosses the wire, and each assertion is the
 * caller-observable behaviour 03's suite asserts through the same interface. It is not the same file;
 * it is the same contract, at the only seam where the contract can be checked end to end.
 *
 * ## Two things no browser test can reach, recorded rather than skipped
 *
 * - **The idempotency key's replay guarantee.** It is asserted in `npm test` at the contract seam
 *   (replay and in-flight) and at the store seam under it. What a browser *can* add is that the
 *   composer sends exactly one keyed POST carrying no author, which is what the first test does.
 * - **A forced refusal.** The composer trims its own draft, so the store's "Message cannot be empty"
 *   is unreachable from the UI, and 07a is what will make a permission refusal reachable. The store's
 *   refusals are asserted at the contract seam, where they are reachable.
 */
test.describe("the writes over the wire", () => {
	test("a posted message is attributed to the resolved principal, and no author is on the wire", async ({
		page,
	}) => {
		test.skip(!SHARED_WORKSPACE, MEMORY_ONLY_REASON);
		await page.goto("/boards/platform?view=threads&thread=delivery");
		const me = await whoAmI(page);

		const payloads: string[] = [];
		page.on("request", (request) => {
			if (
				request.url().includes("/_serverFn/") &&
				request.method() === "POST"
			) {
				payloads.push(request.postData() ?? "");
			}
		});

		const text = `posted as ${me} from the seam`;
		await postAs(page, text);

		// Exactly one POST carried the text, it carried an idempotency key — the composer's own guard
		// for a second click — and it carried **no author**: there is no field for one, and the
		// client builds its body field by field so a forged one cannot be smuggled on.
		const carrying = payloads.filter((body) => body.includes(text));
		expect(carrying).toHaveLength(1);
		expect(carrying[0]).toContain("idempotencyKey");
		expect(carrying[0]).not.toContain("authorId");

		// The composer names the same principal the session note does: one resolution, not two.
		expect(
			await page.getByLabel("Write a message").getAttribute("placeholder"),
		).toContain(me);

		// And the entry is attributed, from the server's resolution rather than the reader's guess.
		const byline = await page
			.locator("[data-entry-seq]", { hasText: text })
			.locator(".entry__author")
			.textContent();
		expect(byline?.trim()).toBeTruthy();
	});

	test("a second activation while the first send is in flight posts once and surfaces no error", async ({
		page,
	}) => {
		// **The guard has to be synchronous, and this is the test that proves it.**
		//
		// The store's idempotency only helps if both calls carry the SAME key, so the composer must
		// mint one key per draft and reuse it. A key held in React state cannot do that: two
		// activations in one tick both read the closure's `null` and mint their own, and two entries
		// land. The first version of this test dispatched the two activations from Playwright, which
		// gave React a render between them — so it passed against the broken implementation too, and
		// proved nothing. This version:
		//
		//   1. delays the POST, so the first send is genuinely in flight;
		//   2. dispatches both activations **inside one task**, so they share a closure;
		//   3. counts the entries and the POSTs that carried the text.
		//
		// Measured both ways: against the ref-based guard one entry, against a state-based guard two.
		test.skip(!SHARED_WORKSPACE, MEMORY_ONLY_REASON);
		let arriving = 0;
		await page.route("**/_serverFn/**", async (route) => {
			if (
				route.request().method() === "POST" &&
				(route.request().postData() ?? "").includes("hurry")
			) {
				arriving += 1;
				await new Promise((resolve) => setTimeout(resolve, 600));
			}
			await route.continue();
		});

		await page.goto("/boards/platform?view=threads&thread=delivery");
		const before = await renderedEntries(page);
		const text = "clicked twice in a hurry";
		await page.getByLabel("Write a message").fill(text);

		// Two activations in one task: the keyboard shortcut and the button, as a nervous hand
		// produces. Both funnel into the same submit handler.
		await page.evaluate(() => {
			const draft = document.querySelector(".conversation__draft");
			const form = document.querySelector(".conversation__composer");
			if (!(draft instanceof HTMLTextAreaElement)) throw new Error("no draft");
			if (!(form instanceof HTMLFormElement)) throw new Error("no composer");
			const keyboard = new KeyboardEvent("keydown", {
				key: "Enter",
				ctrlKey: true,
				bubbles: true,
				cancelable: true,
			});
			draft.dispatchEvent(keyboard);
			form.requestSubmit();
		});

		await expect(page.locator(".entry__text", { hasText: text })).toHaveCount(
			1,
		);
		// One POST carried the text, not two: the second activation reused the in-flight key.
		expect(arriving).toBe(1);

		const after = await renderedEntries(page);
		expect(after.filter((entry) => entry.text === text)).toHaveLength(1);
		expect(after.length).toBe(before.length + 1);
		// No failure surfaced for the second activation, and the draft cleared once.
		await expect(page.getByLabel("Write a message")).toHaveValue("");
		await expect(page.locator(".conversation__reason")).not.toContainText(
			/[Tt]hread not found|unavailable|failed/i,
		);
	});

	test("the composer's placeholder names the server's principal, not the seed's first one", async ({
		page,
	}) => {
		// The defect this covers was found by this suite: with the UI switched to HTTP, the session
		// note said one principal while the composer's placeholder said another, in the same window,
		// because the client carried the router context's **provisional** id and the note carried the
		// server's resolved one. One page load, two answers to "who am I".
		await page.goto("/boards/platform?view=threads&thread=delivery");

		const note = await whoAmI(page);
		const placeholder =
			(await page.getByLabel("Write a message").getAttribute("placeholder")) ??
			"";

		expect(placeholder).toContain(note);
	});
});
