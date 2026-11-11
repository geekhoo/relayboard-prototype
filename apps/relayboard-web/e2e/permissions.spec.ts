import { createHmac } from "node:crypto";
import { expect, test } from "./helpers/fixtures";
import { whoAmI } from "./helpers/participants";

/**
 * Permissions, at the route seam: what a refusal looks like to a reader.
 *
 * ## How a test gets a principal the app would not issue
 *
 * The app issues sessions round-robin to the seed's **browser-selectable** principals — alex, then
 * maya. The interesting subject for "may not post" is `nadia`, the seeded superadmin: workspace
 * grants only, **no board grant at all**, so she can read every board (workspace `read:board` reaches
 * its contents) and cannot write in any of them. That asymmetry is exactly what 07a:20 requires.
 *
 * She is not selectable, so the app will not hand out her session. The test therefore mints the
 * cookie itself: 06b signs it as `base64url(id) + "." + base64url(HMAC-SHA256(id))`, and the harness
 * knows the secret it passes to the server in `webServer.env`. That is the test acting as the
 * session authority — which is what a test is — and it is deliberately **not** an app affordance: no
 * participant operation issues a session for an id of the caller's choosing.
 *
 * The payoff is that 05's recorded gap closes here. "A failed send leaves the draft in place with
 * the reason" was unassertable because nothing the composer could do failed; a principal without
 * `post:message` makes it reachable.
 */
const SECRET = "e2e-session-secret-0123456789abcdef";

/** The session cookie the server itself would have issued for a principal. */
const sessionFor = (principalId: string): string => {
	const encoded = Buffer.from(principalId, "utf8").toString("base64url");
	const signature = createHmac("sha256", SECRET)
		.update(principalId)
		.digest("base64url");
	return `${encoded}.${signature}`;
};

test.describe("permissions at the seam", () => {
	test("a board member may post", async ({ page }) => {
		// The control. Without it, an enforcement bug that refused everybody would look like a pass.
		await page.goto("/boards/platform?view=threads&thread=delivery");
		expect(await whoAmI(page)).not.toBe("");

		await page.getByLabel("Write a message").fill("a member may post");
		await page.getByRole("button", { name: "Send" }).click();
		await expect(
			page.locator(".entry__text", { hasText: "a member may post" }),
		).toHaveCount(1);
	});

	test("the superadmin may read a board and may not post in it", async ({
		browser,
		baseURL,
	}) => {
		const context = await browser.newContext();
		try {
			const url = new URL(baseURL ?? "http://127.0.0.1:3218");
			await context.addCookies([
				{
					name: "relayboard_session",
					value: sessionFor("nadia"),
					domain: url.hostname,
					path: "/",
					httpOnly: true,
					sameSite: "Lax",
				},
			]);
			const page = await context.newPage();
			await page.goto("/boards/platform?view=threads&thread=delivery");

			// **Reads work**, because workspace `read:board` reaches a board's threads (spec L425).
			expect(await whoAmI(page)).toBe("nadia");
			await expect(page.locator("[data-entry-seq]").first()).toBeVisible();

			// **Writing does not**, and the refusal is a stated reason rather than a silent no-op:
			// the draft stays, and the composer says what is missing (05's criterion, reachable at
			// last because a principal without `post:message` now exists).
			const draft = page.getByLabel("Write a message");
			await draft.fill("a superadmin may not post here");
			await page.getByRole("button", { name: "Send" }).click();

			await expect(page.locator(".conversation__reason")).toContainText(
				/permission/i,
			);
			// The draft is NOT lost: a refusal is not a reason to throw away what somebody typed.
			await expect(draft).toHaveValue("a superadmin may not post here");
			// And nothing was written.
			await expect(
				page.locator(".entry__text", {
					hasText: "a superadmin may not post here",
				}),
			).toHaveCount(0);
		} finally {
			await context.close();
		}
	});

	test("the people view refuses a principal without read:member", async ({
		browser,
		baseURL,
	}) => {
		// `nadia` holds no board grant, so she holds no `read:member` on this board. 04b built this
		// refusal branch against a check that did not exist and recorded it as unobservable; 07a is
		// what makes it a real state, so it is asserted here rather than assumed.
		const context = await browser.newContext();
		try {
			const url = new URL(baseURL ?? "http://127.0.0.1:3218");
			await context.addCookies([
				{
					name: "relayboard_session",
					value: sessionFor("nadia"),
					domain: url.hostname,
					path: "/",
					httpOnly: true,
					sameSite: "Lax",
				},
			]);
			const page = await context.newPage();
			await page.goto("/boards/platform?view=people");

			// Never a silent empty list: either the refusal, or the rows.
			const refusal = page.locator(".board-pane__empty-title");
			await expect(
				refusal,
				"the people view rendered neither rows nor a stated refusal — a silent empty list is a claim that the board has nobody on it",
			).toContainText(/not readable|permission/i);
		} finally {
			await context.close();
		}
	});

	test("a member still sees the people on their own board", async ({
		page,
	}) => {
		// The control for the test above: the refusal is about the grant, not about the view.
		await page.goto("/boards/platform?view=people");
		await expect(page.locator(".person-row").first()).toBeVisible();
	});
});
