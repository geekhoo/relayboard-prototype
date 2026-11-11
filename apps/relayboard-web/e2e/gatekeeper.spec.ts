import { createHmac } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "./helpers/fixtures";

/**
 * The gatekeeper surface at the route seam.
 *
 * ## Why every test here mints its own session
 *
 * The app issues sessions round-robin to the seed's browser-selectable principals, so a test that
 * just loaded a page would get **whoever the rotation was up to** — and the gate is a property of the
 * principal, so the assertion would pass or fail by test order. Measured: the first version of this
 * file ran as `maya`, who holds no `admit:agent` anywhere, and every "it opens" assertion failed
 * for a reason that had nothing to do with the surface.
 *
 * So each test names its principal and signs the cookie 06b signs. **Alex is the demo's gate holder**
 * on platform (08a's FINDING 1); `sara` is on campaign and design with the member grant, and holds
 * no gate there.
 *
 * ## What this file cannot assert, and why
 *
 * A pending request needs a **knock**, and a knock comes from an unauthenticated caller (08a). A
 * browser cannot produce one, and inventing a "knock as me" control would be an affordance the
 * product must not have. So the decision controls are asserted where they are reachable —
 * `tests/admissions.test.ts` drives admit and deny through the surface — and this file asserts
 * everything the human's side owns: reachability, the stated states, the focus contract, and the two
 * rules about how a declared value may be presented.
 */
const SECRET = "e2e-session-secret-0123456789abcdef";

const sessionFor = (principalId: string): string => {
	const encoded = Buffer.from(principalId, "utf8").toString("base64url");
	const signature = createHmac("sha256", SECRET)
		.update(principalId)
		.digest("base64url");
	return `${encoded}.${signature}`;
};

/** A page acting as a named principal. */
const asPrincipal = async (
	browser: Parameters<typeof test>[1] extends never
		? never
		: import("@playwright/test").Browser,
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

test.describe("the gatekeeper control", () => {
	test("is reachable from the board frame and opens without changing the address", async ({
		browser,
		baseURL,
	}) => {
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			await page.goto("/boards/platform?view=threads&thread=delivery");
			const before = page.url();

			const toggle = page.locator("[data-gatekeeper-toggle]");
			await expect(toggle).toBeVisible();
			await expect(toggle).toHaveAttribute("aria-disabled", "false");

			await toggle.click();
			await expect(
				page.getByRole("dialog", { name: /pending agents/i }),
			).toBeVisible();
			// **The address did not change.** 08b:22: opening the surface must not lose the reader's
			// place, so it is a panel over the frame rather than a route.
			expect(page.url()).toBe(before);
		} finally {
			await close();
		}
	});

	test("states plainly that nothing is waiting, rather than showing an empty frame", async ({
		browser,
		baseURL,
	}) => {
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			await page.goto("/boards/platform");
			await page.locator("[data-gatekeeper-toggle]").click();

			const panel = page.getByRole("dialog", { name: /pending agents/i });
			await expect(panel.locator(".gatekeeper__empty-title")).toHaveText(
				/no agents are waiting/i,
			);
			// And the detail says what would make one appear, so the state is informative rather than
			// merely empty (DESIGN.md §263).
			await expect(panel.locator(".gatekeeper__empty-detail")).toContainText(
				/asks to join/i,
			);
		} finally {
			await close();
		}
	});

	test("closes on Escape and returns focus to the control that opened it", async ({
		browser,
		baseURL,
	}) => {
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			await page.goto("/boards/platform");
			const toggle = page.locator("[data-gatekeeper-toggle]");
			await toggle.click();
			await expect(
				page.getByRole("dialog", { name: /pending agents/i }),
			).toBeVisible();

			await page.keyboard.press("Escape");
			await expect(
				page.getByRole("dialog", { name: /pending agents/i }),
			).toBeHidden();
			// Focus back on the opener: a panel that dropped focus to the document would leave a
			// keyboard reader at the top of the frame with no idea what happened.
			await expect(toggle).toBeFocused();
		} finally {
			await close();
		}
	});

	test("reads as disabled with a stated reason for a principal without the gate", async ({
		browser,
		baseURL,
	}) => {
		// Sara is on campaign with the member grant, which does not include `admit:agent`.
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"sara",
		);
		try {
			await page.goto("/boards/campaign");

			const toggle = page.locator("[data-gatekeeper-toggle]");
			// Disabled rather than hidden (DESIGN.md §221): the surface is there and the reader learns
			// why they cannot use it.
			await expect(toggle).toHaveAttribute("aria-disabled", "true");
			await toggle.click({ force: true });

			const panel = page.getByRole("dialog", { name: /pending agents/i });
			await expect(panel.locator(".gatekeeper__empty-title")).toContainText(
				/cannot decide admissions/i,
			);
			await expect(panel.locator(".gatekeeper__empty-detail")).toContainText(
				/admit:agent/i,
			);
		} finally {
			await close();
		}
	});
});

test.describe("the surface keeps declared and derived apart", () => {
	test("the panel never contains a secret or a credential", async ({
		browser,
		baseURL,
	}) => {
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			await page.goto("/boards/platform");
			await page.locator("[data-gatekeeper-toggle]").click();
			const panel = page.getByRole("dialog", { name: /pending agents/i });
			await expect(panel).toBeVisible();

			// 08b:21, asserted on the rendered text in every state the panel can be in.
			const text = (await panel.textContent()) ?? "";
			expect(text).not.toMatch(
				/pollingSecret|credential|knock-[A-Za-z0-9_-]{20,}/,
			);
		} finally {
			await close();
		}
	});

	test("the declared label is never tinted with the accent", async ({
		browser,
		baseURL,
	}) => {
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			await page.goto("/boards/platform");
			await page.locator("[data-gatekeeper-toggle]").click();
			const panel = page.getByRole("dialog", { name: /pending agents/i });
			await expect(panel).toBeVisible();

			// DESIGN.md §256: the declared block is never green. Measured as a computed colour rather
			// than read from the stylesheet, because a rule and a rendered result can differ.
			const accentChip = await page.evaluate(() =>
				getComputedStyle(document.documentElement)
					.getPropertyValue("--color-accent-chip-bg")
					.trim(),
			);
			const accentAsRgb = await page.evaluate((value) => {
				const probe = document.createElement("span");
				probe.style.backgroundColor = value;
				document.body.append(probe);
				const resolved = getComputedStyle(probe).backgroundColor;
				probe.remove();
				return resolved;
			}, accentChip);
			expect(accentChip).not.toBe("");

			// Asserted over whatever IS rendered: with nothing pending there is no declared block, and a
			// test that required one would be asserting the queue rather than the styling.
			const tinted = await panel
				.locator(".knock-row__declared-label")
				.evaluateAll(
					(nodes, accent) =>
						nodes.filter(
							(node) => getComputedStyle(node).backgroundColor === accent,
						).length,
					accentAsRgb,
				);
			expect(tinted).toBe(0);
		} finally {
			await close();
		}
	});
});
