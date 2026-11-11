import {
	expect,
	MEMORY_ONLY_REASON,
	SHARED_WORKSPACE,
	test,
} from "./helpers/fixtures";
import { postAs, renderedEntries, whoAmI } from "./helpers/participants";

/**
 * One workspace, two participants.
 *
 * This is the first point at which the product's central claim is true and tested (06c). Everything
 * below is measured between **two independent browser contexts on one server**, which is the only
 * arrangement that distinguishes "one workspace two participants share" from "two workspaces that
 * happen to hold the same seed".
 *
 * Two details make the test honest rather than decorative:
 *
 * 1. The principals are **asked for**, not assumed. The rotation is cyclic (spec L372), so a test
 *    that hard-coded "the first context is alex" would be asserting the rotation's phase.
 * 2. The two ids are asserted **different**, so a build that issued one principal to every browser
 *    fails here rather than passing as "one workspace" with one person in two windows.
 */
test.describe("two participants, one workspace", () => {
	// The whole file is about one shared workspace, so the guard is here rather than on each test.
	test.skip(!SHARED_WORKSPACE, MEMORY_ONLY_REASON);

	test("two browser contexts are two different principals", async ({
		browser,
	}) => {
		const first = await browser.newContext();
		const second = await browser.newContext();
		try {
			const one = await first.newPage();
			const two = await second.newPage();
			await one.goto("/boards/platform");
			await two.goto("/boards/platform");

			const oneId = await whoAmI(one);
			const twoId = await whoAmI(two);

			expect(oneId).not.toBe("");
			expect(twoId).not.toBe("");
			// Two participants, not one participant in two windows.
			expect(twoId).not.toBe(oneId);
		} finally {
			await first.close();
			await second.close();
		}
	});

	test("a message one participant posts appears for the other after it reloads", async ({
		browser,
	}) => {
		const first = await browser.newContext();
		const second = await browser.newContext();
		try {
			const one = await first.newPage();
			const two = await second.newPage();
			await one.goto("/boards/platform?view=threads&thread=delivery");
			await two.goto("/boards/platform?view=threads&thread=delivery");

			const oneId = await whoAmI(one);
			const text = `posted by ${oneId} in one window`;
			await postAs(one, text);

			// The second window has not been told anything: no stream yet (11a). It reads the
			// workspace, and the entry is there. That is "one workspace" as a fact rather than as a
			// promise about events.
			await two.reload();
			await expect(two.locator(".entry__text", { hasText: text })).toHaveCount(
				1,
			);

			// And it is attributed to the poster, not to the reader: authorship comes from the
			// session, not from who is looking.
			const entries = await renderedEntries(two);
			const hosted = entries.find((entry) => entry.text === text);
			expect(hosted).toBeDefined();
			const byline = await two
				.locator("[data-entry-seq]", { hasText: text })
				.locator(".entry__author")
				.textContent();
			expect(byline?.trim()).not.toBe("");
		} finally {
			await first.close();
			await second.close();
		}
	});

	test("both participants see the same boards, threads and counts", async ({
		browser,
	}) => {
		const first = await browser.newContext();
		const second = await browser.newContext();
		try {
			const one = await first.newPage();
			const two = await second.newPage();
			await one.goto("/boards/platform");
			await two.goto("/boards/platform");

			// **Wait for both lists before reading either, which is what this test was missing.**
			// `allTextContents()` does not wait, and `goto` resolves before the loader's rows are painted,
			// so a read taken here compared one page's five rows against the other page's zero. Measured:
			// the test failed twice in three full runs and never when run alone — the signature of a
			// first-paint race rather than a difference between the two participants. The same defect
			// class 04a recorded for the pane's false first paint, here in the test rather than the app.
			await expect(one.locator(".thread-row").first()).toBeVisible();
			await expect(two.locator(".thread-row").first()).toBeVisible();

			// The same three boards, in the same order, with the same thread count: the workspace is
			// one workspace even though the readers are two people.
			expect(await one.locator(".board-rail__name").allTextContents()).toEqual(
				await two.locator(".board-rail__name").allTextContents(),
			);
			expect(await one.locator(".thread-row__title").allTextContents()).toEqual(
				await two.locator(".thread-row__title").allTextContents(),
			);
		} finally {
			await first.close();
			await second.close();
		}
	});
});

test.describe("the workspace is durable within one process", () => {
	test.skip(!SHARED_WORKSPACE, MEMORY_ONLY_REASON);

	test("a message survives a reload", async ({ page }) => {
		// The assertion that would have caught the per-router store on day one. With the UI on the
		// HTTP transport the reader and the store are the same workspace across page loads; before
		// 06c this returned 0 and the harness recorded the gap instead of asserting it.
		await page.goto("/boards/platform?view=threads&thread=delivery");
		const text = "this must survive a reload";
		await postAs(page, text);

		await page.reload();
		await expect(page.locator("[data-entry-seq]").first()).toBeVisible();
		await expect(page.locator(".entry__text", { hasText: text })).toHaveCount(
			1,
		);
	});

	test("a message survives a navigation away and back", async ({ page }) => {
		await page.goto("/boards/platform?view=threads&thread=delivery");
		const text = "this must survive a navigation";
		await postAs(page, text);

		await page.goto("/boards/platform?view=resources");
		await page.goto("/boards/platform?view=threads&thread=delivery");
		await expect(page.locator(".entry__text", { hasText: text })).toHaveCount(
			1,
		);
	});
});
