import { expect, test } from "./helpers/fixtures";

/**
 * The scaffold reconciliation, asserted here so 15a inherits it rather than writing it again.
 *
 * Spec L607 places these at the route seam deliberately: they are not assertions about Relayboard's
 * features but about the *absence* of the starter the app was generated from. A scaffold assertion
 * that only looks at the home page misses the two routes the generator leaves behind, which is why
 * `/about` and `/demo/tanstack-query` are checked as well — a live framework demo reachable in
 * production is the most visible possible way for a scaffold to survive.
 */
test.describe("the app is Relayboard, not the scaffold", () => {
	test("the document is titled Relayboard and carries no starter chrome", async ({
		page,
	}) => {
		await page.goto("/boards/platform");

		// The generator's title is the most reliable marker of an un-reconciled scaffold: it is set
		// once in the root route and nothing else touches it.
		await expect(page).toHaveTitle("Relayboard");
		await expect(page).not.toHaveTitle(/TanStack Start Starter/i);

		// No site header or footer: this product's whole surface is the workspace, so a
		// document-level nav or a footer is scaffold chrome rather than a design choice.
		await expect(page.locator("body > header")).toHaveCount(0);
		await expect(page.locator("body > footer")).toHaveCount(0);
	});

	test("the workspace frame is rendered with its three surfaces", async ({
		page,
	}) => {
		await page.goto("/boards/platform");

		// The three columns are the app's own structure, named so a screen reader can describe them
		// (04a). Asserting them here is what makes "the frame rendered" a fact rather than a
		// title check standing in for one.
		await expect(page.locator(".workspace-frame__rail")).toBeVisible();
		await expect(page.locator(".workspace-frame__pane")).toBeVisible();
		await expect(page.locator(".workspace-frame__conversation")).toBeVisible();

		// The board itself came from the client, not from hard-coded markup.
		await expect(page.getByRole("heading", { level: 1 })).toContainText(
			"Platform workspace",
		);
	});

	test("the starter's two demo routes do not resolve to a starter page", async ({
		page,
	}) => {
		// Both routes ship in the generator's tree. A 404 is fine; a rendered "About" or a live
		// TanStack Query demo is not, because either is reachable in production.
		for (const path of ["/about", "/demo/tanstack-query"]) {
			const response = await page.goto(path);
			const body = (await page.locator("body").textContent()) ?? "";
			const isStarterDemo =
				/TanStack Query|TanStack Start|This is the About page/i.test(body);
			// A served page is either a not-found state or a redirect to the app; what it must not be
			// is a working starter demo.
			expect(
				isStarterDemo,
				`${path} rendered starter content. A demo route left in the scaffold is reachable in production; it must be removed rather than left resolving.`,
			).toBe(false);
			if (response?.status() === 200) {
				// A 200 is acceptable only if the app frame rendered instead — the not-found state is
				// inside the frame (06a), so a 200 with no frame would be a page nothing owns.
				await expect(page.locator(".workspace-frame")).toHaveCount(1);
			}
		}
	});
});
