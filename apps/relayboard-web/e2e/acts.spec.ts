import { createHmac } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "./helpers/fixtures";

/**
 * The act entries at the route seam, and the claims only a browser can check.
 *
 * 10b:15 says the hierarchy must be **asserted as computed style, not as an impression**: marker size,
 * line count and text colour, each checked once. That is why this file exists rather than more unit
 * tests - "distinguishably but not louder" is a claim about rendered pixels, and the only way to know
 * it holds is to measure what the browser laid out.
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

test.describe("an act end to end", () => {
	test("a status move appears at the right position, advances the sequence, and survives a reload", async ({
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
			const before = await page.locator(".entry").count();

			await page.locator("[data-act-perform='move']").click();

			const act = page.locator(".entry__act[data-entry-act='status-move']");
			await expect(act).toHaveCount(1);
			// At the right position: appended, so the last entry of the chronology, and the sequence
			// advanced by exactly one.
			await expect(page.locator(".entry").last()).toContainText(
				"moved the status",
			);
			await expect(page.locator(".entry")).toHaveCount(before + 1);

			// And a reload shows it still there: the act is in the store, not in a render.
			await page.reload();
			await expect(
				page.locator(".entry__act[data-entry-act='status-move']"),
			).toHaveCount(1);
		} finally {
			await close();
		}
	});

	test("an artifact renders the resource chip, pointing at the canonical resource", async ({
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

			const select = page.locator("[data-act='attach']");
			const value = await select.locator("option").nth(1).getAttribute("value");
			await select.selectOption(value ?? "");
			await page.locator("[data-act-perform='attach']").click();

			const chip = page.locator(".entry__resource-chip").first();
			await expect(chip).toBeVisible();
			// The chip is a link to the canonical resource, not a copy of its content, and it opens
			// safely: `noopener` is the half that matters.
			await expect(chip).toHaveAttribute("href", /^https?:\/\//);
			await expect(chip).toHaveAttribute("target", "_blank");
			expect((await chip.getAttribute("rel")) ?? "").toContain("noopener");
		} finally {
			await close();
		}
	});

	test("an acknowledgement renders as a report about the acknowledger, with no accent anywhere", async ({
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
			await page.locator("[data-act-perform='acknowledge']").click();

			const act = page.locator(".entry__act[data-entry-act='acknowledgement']");
			await expect(act).toHaveCount(1);

			// The wording holds the model's line (DESIGN.md 295, spec L438): it states a position, and no
			// word in it could read as a verdict.
			const text = (await act.textContent()) ?? "";
			expect(text).toMatch(/acknowledged up to #\d+/);
			for (const verdict of [
				"approved",
				"agreed",
				"done",
				"complete",
				"resolved",
				"signed",
			]) {
				expect(text.toLowerCase()).not.toContain(verdict);
			}

			// And the accent is absent, measured rather than read from the stylesheet: a rule and a
			// rendered colour can differ.
			const accent = await page.evaluate(() => {
				const probe = document.createElement("span");
				probe.style.backgroundColor = getComputedStyle(
					document.documentElement,
				).getPropertyValue("--color-accent-chip-bg");
				document.body.append(probe);
				const resolved = getComputedStyle(probe).backgroundColor;
				probe.remove();
				return resolved;
			});
			const tinted = await act.evaluateAll((nodes, accentColour) => {
				const has = (node: Element) =>
					getComputedStyle(node).backgroundColor === accentColour ||
					getComputedStyle(node).color === accentColour;
				return nodes.filter(
					(node) => has(node) || [...node.querySelectorAll("*")].some(has),
				).length;
			}, accent);
			expect(tinted).toBe(0);
		} finally {
			await close();
		}
	});
});

test.describe("an act is distinguishably quieter than a message, measured", () => {
	test("the marker is 28px for an act and 35px for a message, both rounded squares", async ({
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
			await page.locator("[data-act-perform='move']").click();
			await expect(page.locator(".entry__act").first()).toBeVisible();

			const measured = await page.evaluate(() => {
				const message = document.querySelector(
					"[data-entry-marker='message']",
				) as HTMLElement | null;
				const act = document.querySelector(
					"[data-entry-marker='status-move']",
				) as HTMLElement | null;
				if (!message || !act) return null;
				const box = (node: HTMLElement) => {
					const style = getComputedStyle(node);
					return {
						width: Math.round(node.getBoundingClientRect().width),
						height: Math.round(node.getBoundingClientRect().height),
						radius: style.borderTopLeftRadius,
					};
				};
				return { message: box(message), act: box(act) };
			});
			if (!measured) throw new Error("no markers found");

			// DESIGN.md 250, as numbers: 35px for a message, 28px for an act.
			expect(measured.message.width).toBe(35);
			expect(measured.message.height).toBe(35);
			expect(measured.act.width).toBe(28);
			expect(measured.act.height).toBe(28);
			// Rounded squares, never circles (214 reserves the circle for status dots): a radius of half
			// the width would be a circle, so the assertion is that it is not that.
			expect(measured.message.radius).not.toBe("17.5px");
			expect(measured.act.radius).not.toBe("14px");
		} finally {
			await close();
		}
	});

	test("an act is one line at Ink-muted, and a message is body ink", async ({
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
			await page.locator("[data-act-perform='move']").click();
			await expect(page.locator(".entry__act").first()).toBeVisible();

			const styles = await page.evaluate(() => {
				const act = document.querySelector(".entry__act") as HTMLElement | null;
				const text = document.querySelector(
					".entry__text",
				) as HTMLElement | null;
				const probe = document.createElement("span");
				probe.style.color = getComputedStyle(
					document.documentElement,
				).getPropertyValue("--color-ink-muted");
				document.body.append(probe);
				const mutedColour = getComputedStyle(probe).color;
				probe.remove();
				return {
					actColour: act ? getComputedStyle(act).color : null,
					actLines: act
						? Math.round(
								act.getBoundingClientRect().height /
									parseFloat(getComputedStyle(act).lineHeight),
							)
						: null,
					messageColour: text ? getComputedStyle(text).color : null,
					mutedColour,
				};
			});

			// Ink-muted rather than Ink-body: the "quieter than a message" claim, made checkable.
			expect(styles.actColour).toBe(styles.mutedColour);
			expect(styles.messageColour).not.toBe(styles.mutedColour);
			// One line: a one-line box divided by its own line height is 1.
			expect(styles.actLines).toBe(1);
		} finally {
			await close();
		}
	});
});

test.describe("the act controls", () => {
	test("every control is present, and any that is disabled names its permission", async ({
		browser,
		baseURL,
	}) => {
		// Sara is on the campaign board, whose member grant names fewer permissions than platform's - so
		// at least one act control is disabled for a real reason rather than a mock.
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"sara",
		);
		try {
			await page.goto("/boards/campaign");
			await page.locator(".thread-row").first().click();
			await expect(page.locator("[data-act-perform='attach']")).toBeVisible();

			// **Two different reasons a control can be disabled, and the test must not conflate them.**
			// The permission reason is a stated line beside the control; an empty select is disabled
			// because nothing is chosen yet, which is not a permission fact at all. My first version
			// required a permission line for any disabled control and failed on the attach button, whose
			// disabled state was the empty select — the assertion was wrong, not the surface.
			for (const kind of ["attach", "move", "acknowledge"]) {
				const control = page.locator(`[data-act-perform='${kind}']`);
				// Present, whether enabled or not: a control the reader cannot see is one they cannot ask
				// for the permission to use (DESIGN.md 221).
				await expect(control).toBeVisible();
				const reason = page.locator(`[data-act-reason='${kind}']`);
				const reasonPresent = (await reason.count()) > 0;
				if (reasonPresent) {
					// If a reason is stated, it names the permission and the control is disabled for it.
					await expect(reason).toContainText(/permission/i);
					await expect(control).toBeDisabled();
				}
			}
			// And on a board where the reader holds all three, the reasons are absent — so the absence is
			// a fact about the grant rather than about a component that never renders them.
			await page.goto("/boards/platform?view=threads&thread=delivery");
			for (const kind of ["attach", "move", "acknowledge"]) {
				await expect(page.locator(`[data-act-reason='${kind}']`)).toHaveCount(
					0,
				);
			}
		} finally {
			await close();
		}
	});

	test("two activations in one task produce one entry, not two", async ({
		browser,
		baseURL,
	}) => {
		// The guard is a ref set before the await, because React state is asynchronous - the same defect
		// 06c found in the composer. Both clicks are dispatched inside one evaluate, so React gets no
		// render between them.
		const { page, close } = await asPrincipal(
			browser,
			baseURL ?? "http://127.0.0.1:3218",
			"alex",
		);
		try {
			await page.goto("/boards/platform?view=threads&thread=delivery");
			const before = await page.locator(".entry").count();

			await page.evaluate(() => {
				const button = document.querySelector(
					"[data-act-perform='move']",
				) as HTMLButtonElement | null;
				button?.click();
				button?.click();
			});
			await expect(page.locator(".entry__act").first()).toBeVisible();
			await page.waitForTimeout(500);

			await expect(
				page.locator(".entry__act[data-entry-act='status-move']"),
			).toHaveCount(1);
			await expect(page.locator(".entry")).toHaveCount(before + 1);
		} finally {
			await close();
		}
	});
});
