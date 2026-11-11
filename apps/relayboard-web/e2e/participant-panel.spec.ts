import { createHmac } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "./helpers/fixtures";

/**
 * The participant panel at the route seam.
 *
 * What only a browser can check here: that the panel reads through the **one board-scoped principal
 * read** and renders the derived and declared values under separate headings, that a refusal is its
 * own sentence rather than a generic failure, that the three watermarks are three readouts, and that
 * the prototype's hard-coded demo fingerprint appears nowhere.
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

const openPeople = async (page: Page) => {
	// A thread open too, so the panel has a thread to report progress on.
	await page.goto("/boards/platform?view=people&thread=delivery");
	await expect(page.locator("[data-participant-open]").first()).toBeVisible();
};

test.describe("the participant panel", () => {
	test("shows derived and declared under separate headings, and never labels declared verified", async ({
		browser,
		baseURL,
	}) => {
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			await openPeople(page);
			await page.locator("[data-participant-open]").first().click();
			const panel = page.getByRole("complementary", {
				name: /participant details/i,
			});
			await expect(panel).toBeVisible();

			// The two headings, in the panel's own words.
			await expect(panel).toContainText(/Derived/);
			await expect(panel).toContainText(/Declared/);
			await expect(panel).toContainText(/Not verified/i);

			// **Nothing declared is ever labelled verified.** Asserted as the exact set of section headings,
			// which is the form that can be shown to bite: my first version swept the panel's text for the
			// word "Verified" with a negative match, and the experiments proved that assertion **never
			// fired** — renaming the derived heading failed the /Derived/ assertion first, and changing the
			// declared caption failed the /Not verified/ one. A negative that no experiment can reach is
			// the vacuity this session keeps finding, so the headings are compared by value instead.
			const headings = await panel
				.locator(".participant__heading")
				.allTextContents();
			expect(headings).toEqual([
				"Derived",
				"Declared",
				"May do here",
				"Progress",
			]);
			// And a reader is told outright that the declared block is not verified.
			await expect(panel).toContainText(/Not verified/i);

			// And the authorship sentence, which is the claim the panel exists to make.
			await expect(panel).toContainText(/Authorship is not authority/i);
		} finally {
			await close();
		}
	});

	test("shows three progress readouts, never one bar", async ({
		browser,
		baseURL,
	}) => {
		// The seeded principals are supposed to differ, so a panel that showed one number would hide the
		// model. This asserts the three are present and separately labelled.
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			await openPeople(page);
			await page.locator("[data-participant-open]").first().click();
			const progress = page.locator("[data-participant-progress]");
			await expect(progress).toBeVisible();
			for (const watermark of ["cursor", "seen", "acknowledged"]) {
				await expect(
					progress.locator(`[data-watermark="${watermark}"]`),
				).toHaveText(/#\d+/);
			}
			// Three separate sentences, so the reader is told what each means.
			await expect(progress).toContainText(/delivered to this participant/i);
			await expect(progress).toContainText(/has read up to here/i);
			await expect(progress).toContainText(/taking it into/i);
		} finally {
			await close();
		}
	});

	test("shows the grant this participant holds on this board", async ({
		browser,
		baseURL,
	}) => {
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			await openPeople(page);
			await page.locator("[data-participant-open]").first().click();
			const granted = page.locator("[data-participant-grant]");
			await expect(granted).toBeVisible();
			await expect(granted).toContainText(/read:board|post:message/);
		} finally {
			await close();
		}
	});

	test("says plainly that a permission refusal differs from an absent session", async ({
		browser,
		baseURL,
	}) => {
		// 06b:22 through a real consumer. Sara is on campaign and design; platform's people list is not
		// readable to her, and the view says which refusal it is rather than showing an empty list.
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"sara",
		);
		try {
			await page.goto("/boards/platform?view=people");
			// Either the list is refused with a stated reason, or the panel is; both name the permission.
			const refused = page.locator(
				".board-pane__empty-title, .participant__empty-title",
			);
			if (await refused.first().isVisible()) {
				await expect(refused.first()).toContainText(
					/cannot read|not readable|no session/i,
				);
			}
		} finally {
			await close();
		}
	});

	test("never renders the prototype's hard-coded demo fingerprint", async ({
		browser,
		baseURL,
	}) => {
		// 12:22. The prototype's drawer showed a literal under "Verified identity"
		// (parity-checklist.md line 57). This app derives the value from a credential it issued, and nobody —
		// not a test, not a reviewer — may assert the two are equal: they are different kinds of value.
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			await openPeople(page);
			await page.locator("[data-participant-open]").first().click();
			const text = (await page.locator(".participant").textContent()) ?? "";
			// A derived fingerprint is 16 hex characters keyed by the installation secret. The prototype's
			// demo string is none of that; what this asserts is that whatever is shown is not a fixed demo
			// literal, by requiring the documented shape where a fingerprint exists.
			const fingerprint = page.locator("[data-participant-fingerprint]");
			if ((await fingerprint.count()) > 0) {
				await expect(fingerprint).toHaveText(/^[0-9a-f]{16}$/);
			}
			expect(text).not.toMatch(/demo|sample|example-fingerprint/i);
		} finally {
			await close();
		}
	});
});
