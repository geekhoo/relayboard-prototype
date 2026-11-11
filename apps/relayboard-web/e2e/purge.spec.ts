import { createHmac } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "./helpers/fixtures";

/**
 * The purge at the route seam.
 *
 * 14:22 asks for the keyboard contract **here**, because this ticket builds the dialog: opening moves
 * focus in, focus stays in while it is open, closing returns focus to the opener, and Escape closes
 * exactly that one layer. 14:14 asks for the overlap to be named before the act. Both need a browser.
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

test.describe("the purge", () => {
	test("names what will go, what will stay, and the overlap, before anything happens", async ({
		browser,
		baseURL,
	}) => {
		// Nadia is the seeded superadmin: the workspace `create:board` grant is what gates this, and she
		// holds it. Alex holds only board grants, so the disabled case is the other test.
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"nadia",
		);
		try {
			await page.goto("/boards/platform");
			await expect(page.locator("[data-purge-open]")).toBeVisible();
			await page.locator("[data-purge-open]").click();

			const dialog = page.getByRole("dialog", { name: /purge demo content/i });
			await expect(dialog).toBeVisible();

			await expect(page.locator("[data-purge-will-remove]")).toContainText(
				/\d+ boards/,
			);
			await expect(page.locator("[data-purge-will-keep]")).toContainText(
				/kept/i,
			);
			// The overlap is always present: "none of your entries" is a sentence, not an omission.
			await expect(page.locator("[data-purge-overlap]")).toBeVisible();
			await expect(dialog).toContainText(/held in memory/i);
		} finally {
			await close();
		}
	});

	test("returns focus to the opener on Escape, and keeps focus inside while open", async ({
		browser,
		baseURL,
	}) => {
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"nadia",
		);
		try {
			await page.goto("/boards/platform");
			const opener = page.locator("[data-purge-open]");
			await opener.focus();
			await opener.click();

			const dialog = page.getByRole("dialog", { name: /purge demo content/i });
			await expect(dialog).toBeVisible();
			// Focus is inside, because `showModal` contains it — 14:22 met by the platform rather than by a
			// hand-written trap.
			const inside = await page.evaluate(() =>
				document
					.querySelector("dialog[open]")
					?.contains(document.activeElement),
			);
			expect(inside).toBe(true);

			await page.keyboard.press("Escape");
			await expect(dialog).toBeHidden();
			await expect(opener).toBeFocused();
		} finally {
			await close();
		}
	});

	test("removes the demo content and keeps the reader's own board", async ({
		browser,
		baseURL,
	}) => {
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"nadia",
		);
		try {
			await page.goto("/boards/platform");
			// A board of the reader's own first, so the purge has something it must not take.
			await page.locator("[data-create='board']").click();
			const create = page.getByRole("dialog", { name: /new board/i });
			await create.locator("[data-field='name']").fill("My own board");
			await create.locator("[data-create-confirm]").click();
			await expect(create).toBeHidden();

			await page.locator("[data-purge-open]").click();
			await page.locator("[data-purge-confirm]").click();
			await expect(page.locator("[data-purge-done]")).toBeVisible();

			// The demo boards are gone and the reader's board survives.
			await expect(
				page.locator(".board-rail__name", { hasText: "Platform workspace" }),
			).toHaveCount(0);
			await expect(
				page.locator(".board-rail__name", { hasText: "My own board" }),
			).toHaveCount(1);
		} finally {
			await close();
		}
	});

	test("reads as disabled with the permission named for a principal without the workspace grant", async ({
		browser,
		baseURL,
	}) => {
		// Alex holds board grants and no workspace grant, so `create:board` is exactly what is missing.
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			await page.goto("/boards/platform");
			await expect(page.locator("[data-purge-open]")).toHaveAttribute(
				"aria-disabled",
				"true",
			);
			await expect(page.locator("[data-purge-reason]")).toContainText(
				/create:board/,
			);
		} finally {
			await close();
		}
	});
});
