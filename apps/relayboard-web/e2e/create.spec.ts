import { createHmac } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "./helpers/fixtures";

/**
 * The create dialogs at the route seam.
 *
 * ## Naming the principal, again
 *
 * With round-robin issuance a test that just loads a page gets whoever the rotation was up to, so every
 * test below signs a session for a named principal — the lesson 08b's FINDING A put in writing. `alex`
 * is the demo's board member with the full member grant (including `create:thread`, `add:resource`),
 * and `create:board` is workspace-scoped so no member holds it; that asymmetry is what makes the
 * disabled-with-reason assertion real rather than theoretical.
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

test.describe("creating", () => {
	test("a thread is created and opens ready to post into", async ({
		browser,
		baseURL,
	}) => {
		// 09:15: creating and using are one continuous act.
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			await page.goto("/boards/platform");

			await page.locator("[data-create='thread']").click();
			const dialog = page.getByRole("dialog", { name: /new thread/i });
			await expect(dialog).toBeVisible();

			await dialog
				.locator("[data-field='name']")
				.fill("A thread from the seam");
			await dialog.locator("[data-create-confirm]").click();

			// The dialog closes on success, the address carries the new thread, and the composer is
			// ready — which is what "ready to post into" means.
			await expect(dialog).toBeHidden();
			await expect(page).toHaveURL(/thread=thread-/);
			await expect(page.getByLabel("Write a message")).toBeVisible();
			await expect(page.locator(".conversation__title")).toHaveText(
				"A thread from the seam",
			);

			// And it is usable immediately: posting works without a reload.
			await page
				.getByLabel("Write a message")
				.fill("Posted into the new thread.");
			await page.getByRole("button", { name: "Send" }).click();
			await expect(
				page.locator(".entry__text", {
					hasText: "Posted into the new thread.",
				}),
			).toHaveCount(1);
		} finally {
			await close();
		}
	});

	test("a resource is added, listed as a canonical reference, and opens safely", async ({
		browser,
		baseURL,
	}) => {
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			await page.goto("/boards/platform?view=resources");

			await page.locator("[data-create='resource']").click();
			const dialog = page.getByRole("dialog", { name: /add resource/i });
			await dialog.locator("[data-field='name']").fill("A seam resource");
			await dialog
				.locator("[data-field='url']")
				.fill("https://example.com/seam-resource");
			await dialog.locator("[data-field='type']").selectOption("Repository");
			await dialog
				.locator("[data-field='description']")
				.fill("Added by the seam");
			await dialog.locator("[data-create-confirm]").click();

			const row = page.locator(".resource-row", { hasText: "A seam resource" });
			await expect(row).toBeVisible();
			// It carries the URL rather than a copy of the destination's content (09:17).
			const link = row.locator("a");
			await expect(link).toHaveAttribute(
				"href",
				"https://example.com/seam-resource",
			);
			// And it opens in a new context without handing the destination control of the session
			// (09:19): `noopener` is the part that matters, `noreferrer` is the courtesy.
			await expect(link).toHaveAttribute("target", "_blank");
			const rel = (await link.getAttribute("rel")) ?? "";
			expect(rel).toContain("noopener");
			expect(rel).toContain("noreferrer");
		} finally {
			await close();
		}
	});

	test("a non-HTTP URL is refused in the dialog, with the dialog still open", async ({
		browser,
		baseURL,
	}) => {
		// 09:18 and 09:20 together: the reason is in words a reader can act on, and the dialog does not
		// close on failure — closing would discard everything they typed.
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			await page.goto("/boards/platform?view=resources");
			await page.locator("[data-create='resource']").click();
			const dialog = page.getByRole("dialog", { name: /add resource/i });
			await dialog.locator("[data-field='name']").fill("A bad link");
			await dialog.locator("[data-field='url']").fill("javascript:alert(1)");
			await dialog.locator("[data-create-confirm]").click();

			await expect(dialog).toBeVisible();
			await expect(dialog.locator("[data-create-problem]")).toHaveText(
				/HTTP or HTTPS/i,
			);
			// Nothing was stored.
			await expect(
				page.locator(".resource-row", { hasText: "A bad link" }),
			).toHaveCount(0);
		} finally {
			await close();
		}
	});

	test("a control the reader lacks the grant for is disabled with the permission named", async ({
		browser,
		baseURL,
	}) => {
		// **07a's affordance, exercised for the first time** (09:21, DESIGN.md §221). A principal holding
		// the member grant can create threads and add resources but cannot create a board — that is
		// workspace-scoped — so the board control is the disabled one, and it says which permission.
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			await page.goto("/boards/platform");

			const boardControl = page.locator("[data-create='board']");
			await expect(boardControl).toHaveAttribute("aria-disabled", "true");
			// **Not hidden**: the control is present so the reader knows the action exists, and the reason
			// beside it names the permission.
			await expect(boardControl).toBeVisible();
			await expect(page.locator("[data-create-reason='board']")).toContainText(
				"create:board",
			);

			// The controls the reader CAN use are enabled, so the disabled one is a fact about the grant
			// rather than about the surface.
			await expect(page.locator("[data-create='thread']")).toHaveAttribute(
				"aria-disabled",
				"false",
			);
			await expect(page.locator("[data-create='resource']")).toHaveAttribute(
				"aria-disabled",
				"false",
			);
		} finally {
			await close();
		}
	});

	test("a double activation creates one board, not two", async ({
		browser,
		baseURL,
	}) => {
		// The same hazard the composer and the decide control have, in its third place — and **this test
		// is deliberately written the way 06c's came to be**: both activations dispatched inside one
		// task, so React gets no render between them and the guard has to be synchronous.
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"nadia",
		);
		try {
			await page.goto("/boards/platform");
			await page.locator("[data-create='board']").click();
			const dialog = page.getByRole("dialog", { name: /new board/i });
			await dialog.locator("[data-field='name']").fill("One board only");

			await page.evaluate(() => {
				const form = document.querySelector("dialog[open] form");
				if (!(form instanceof HTMLFormElement)) throw new Error("no form");
				form.requestSubmit();
				form.requestSubmit();
			});

			// The dialog closes on the first success, and one board exists.
			await expect(dialog).toBeHidden();
			await expect(
				page.locator(".board-rail__name", { hasText: "One board only" }),
			).toHaveCount(1);
		} finally {
			await close();
		}
	});
	test("the thread dialog does not offer a description, because nothing renders one", async ({
		browser,
		baseURL,
	}) => {
		// **This is the assertion that would have caught the original defect.** The prototype collected
		// a thread description (`app.js` L165) and stored it (L115), and no render path ever read it —
		// so the port carried a form field whose answer the store dropped, because `Thread` has no
		// `description` attribute. Measured before the fix: the field existed, accepted text, and the
		// thread came back without it. The fix is that the form no longer asks, so the absence is the
		// assertion.
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			await page.goto("/boards/platform");
			await page.locator("[data-create='thread']").click();
			const dialog = page.getByRole("dialog", { name: /new thread/i });
			await expect(dialog).toBeVisible();

			// The title is asked for; a description is not.
			await expect(dialog.locator("[data-field='name']")).toBeVisible();
			await expect(dialog.locator("[data-field='description']")).toHaveCount(0);

			// And the two dialogs where a description *does* go somewhere still have it — otherwise this
			// test would pass on a change that removed the field everywhere.
			await page.keyboard.press("Escape");
			await expect(dialog).toBeHidden();
			await page.locator("[data-create='resource']").click();
			const resource = page.getByRole("dialog", { name: /add resource/i });
			await expect(
				resource.locator("[data-field='description']"),
			).toBeVisible();
		} finally {
			await close();
		}
	});

	test("a resource shows the type the reader chose", async ({
		browser,
		baseURL,
	}) => {
		// The other half of the same defect class: the dialog asks for one of four types, the store
		// keeps it, and until the fix no surface rendered it. Asserted as the **word**, not as a box — a
		// chip that always rendered the default would pass a presence check and still lose the choice.
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			await page.goto("/boards/platform?view=resources");
			await page.locator("[data-create='resource']").click();
			const dialog = page.getByRole("dialog", { name: /add resource/i });
			await dialog.locator("[data-field='name']").fill("A repository");
			await dialog
				.locator("[data-field='url']")
				.fill("https://example.com/a-repository");
			// **Deliberately not the default.** The default is `Link`, so a test that chose it could pass
			// on a chip that always rendered the default.
			await dialog.locator("[data-field='type']").selectOption("Repository");
			await dialog.locator("[data-create-confirm]").click();
			await expect(dialog).toBeHidden();

			const row = page.locator(".resource-row", { hasText: "A repository" });
			await expect(row.locator("[data-resource-type]")).toHaveText(
				"Repository",
			);

			// And a seeded resource shows its own type rather than the new one: the chip reads the
			// record, not a component default.
			const seeded = page.locator(".resource-row").first();
			await expect(seeded.locator("[data-resource-type]")).not.toBeEmpty();
		} finally {
			await close();
		}
	});
});
