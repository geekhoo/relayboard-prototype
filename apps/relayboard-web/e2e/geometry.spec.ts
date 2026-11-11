import { expect, test } from "./helpers/fixtures";
import {
	expectCoversTrack,
	expectNoOverflow,
	setViewport,
	type ViewportName,
	WIDTHS,
} from "./helpers/layout";
import { measureTextContrast, measureType } from "./helpers/style";

/**
 * **13a: the workspace holds its shape at every width.**
 *
 * Six widths, each measured on the scroll container of a column rather than on `documentElement` —
 * because `documentElement.scrollWidth === clientWidth` is true under `overflow: hidden`, which this
 * frame sets, so a document-level check would be vacuous. `measureOverflow` refuses the document and the
 * body outright for that reason, and `e2e/layout.spec.ts` proves the instrument can fail before this
 * file trusts it.
 *
 * ## The three questions, kept apart
 *
 * 1. **Overflow** — is content wider than its box?
 * 2. **Extent** — does a painted surface cover its track? The rail shipped 221px tall in a 900px column
 *    and passed every overflow assertion, which is why these are two instruments and two criteria.
 * 3. **Floors** — is the text big enough and the contrast sufficient, at the two extremes?
 *
 * A check that answered all three at once would report every failure against the wrong property.
 */
const COLUMNS = [
	".workspace-frame__pane",
	".workspace-frame__conversation",
] as const;

/** The widths where all three surfaces are columns, so each fills the frame's height. */
const THREE_COLUMN: readonly ViewportName[] = ["desktop", "wide"];

test.describe("13a: geometry at every width", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/boards/platform?view=threads&thread=delivery");
		// The pane and the conversation both need content, or the measurements describe empty boxes.
		await expect(page.locator(".thread-row").first()).toBeVisible();
		await expect(page.locator(".entry").first()).toBeVisible();
	});

	test("each column paints the full height of the frame where the columns are a row", async ({
		page,
	}) => {
		// **Extent, not overflow.** The rail shipped 221px tall in a 900px column and passed every
		// overflow assertion: content that fits its own box overflows nothing, and the defect is purely
		// that the column is only partly painted. Above 980px the three surfaces are one row, so each
		// fills the frame's whole height.
		for (const name of THREE_COLUMN) {
			await setViewport(page, name);
			for (const column of COLUMNS) {
				await expectCoversTrack(
					page.locator(column),
					page.locator(".workspace-frame"),
					`${column} at ${name} (${WIDTHS[name].width}px)`,
					"height",
				);
			}
			// The rail is a column above 980px, so its nav must fill the column it is in.
			await expectCoversTrack(
				page.locator(".workspace-frame__rail > nav"),
				page.locator(".workspace-frame__rail"),
				`the rail nav at ${name} (${WIDTHS[name].width}px)`,
			);
		}
	});

	test("at and below 980px the two rows together cover the frame", async ({
		page,
	}) => {
		// **The measurement that has to be relational rather than equal.** Below 980px the pane and the
		// conversation are rows stacked in one column, so neither matches the frame's height — the sum
		// does. Asserting either one equals the frame would report a 50% shortfall on correct layout,
		// which is exactly the kind of assertion that gets switched off instead of fixed.
		for (const name of ["narrow", "phoneLarge"] as ViewportName[]) {
			await setViewport(page, name);
			const measured = await page.evaluate(() => {
				const height = (selector: string) =>
					document.querySelector(selector)?.getBoundingClientRect().height ?? 0;
				return {
					frame: height(".workspace-frame"),
					pane: height(".workspace-frame__pane"),
					conversation: height(".workspace-frame__conversation"),
				};
			});
			expect(
				measured.pane + measured.conversation,
				`the pane (${measured.pane}) and the conversation (${measured.conversation}) together do not cover the frame (${measured.frame}) at ${name} (${WIDTHS[name].width}px). This is EXTENT: the rows leave a band of the column unpainted.`,
			).toBeGreaterThanOrEqual(measured.frame - 1);
		}
	});

	test("no column overflows horizontally at any of the six widths", async ({
		page,
	}) => {
		for (const name of Object.keys(WIDTHS) as ViewportName[]) {
			await setViewport(page, name);
			for (const column of COLUMNS) {
				await expectNoOverflow(
					page.locator(column),
					`${column} at ${name} (${WIDTHS[name].width}px)`,
				);
			}
		}
	});

	test("the document does not overflow either, once the frame's clip is lifted", async ({
		page,
	}) => {
		// **The measurement the frame's `overflow: hidden` would otherwise hide.** The criterion asks for
		// it explicitly: `documentElement` is measured only with the clip temporarily unset, so a genuine
		// overflow that the clip has been concealing becomes visible here rather than shipping green.
		for (const name of Object.keys(WIDTHS) as ViewportName[]) {
			await setViewport(page, name);
			const measured = await page.evaluate(() => {
				const frame = document.querySelector(".workspace-frame");
				const html = document.documentElement;
				const body = document.body;
				const saved = {
					frame: frame instanceof HTMLElement ? frame.style.overflow : "",
					html: html.style.overflow,
					body: body.style.overflow,
				};
				if (frame instanceof HTMLElement) frame.style.overflow = "visible";
				html.style.overflow = "visible";
				body.style.overflow = "visible";
				const result = {
					scrollWidth: html.scrollWidth,
					clientWidth: html.clientWidth,
				};
				if (frame instanceof HTMLElement) frame.style.overflow = saved.frame;
				html.style.overflow = saved.html;
				body.style.overflow = saved.body;
				return result;
			});
			expect(
				measured.scrollWidth,
				`the document overflows at ${name} (${WIDTHS[name].width}px) once the frame's clip is lifted: ` +
					`scrollWidth ${measured.scrollWidth} > clientWidth ${measured.clientWidth}. This is the overflow ` +
					"`overflow: hidden` was hiding.",
			).toBeLessThanOrEqual(measured.clientWidth + 1);
		}
	});
});

test.describe("13a: the rail overlay drawer", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/boards/platform?view=threads&thread=delivery");
		await expect(page.locator(".thread-row").first()).toBeVisible();
	});

	test("the toggle opens the drawer, and Escape closes it", async ({
		page,
	}) => {
		// **The dead end 04a measured, closed.** Below 980px the rail is off-canvas; before 13a nothing
		// could bring it back. The toggle is the affordance that matters, so it is asserted first.
		await setViewport(page, "narrow");
		const rail = page.locator(".workspace-frame__rail");
		const toggle = page.locator("[data-rail-toggle]");

		await expect(toggle).toBeVisible();
		// Closed: off-canvas and out of the tab order, which is why `visibility` is part of the rule.
		await expect(rail).toHaveCSS("visibility", "hidden");

		await toggle.click();
		await expect(rail).toHaveCSS("visibility", "visible");
		await expect(rail).toHaveAttribute("data-open", "true");
		// The scrim is present while it is open, and it is a control rather than decoration.
		await expect(page.locator("[data-rail-scrim]")).toBeVisible();

		await page.keyboard.press("Escape");
		await expect(rail).toHaveCSS("visibility", "hidden");
		await expect(page.locator("[data-rail-scrim]")).toHaveCount(0);
	});

	test("the scrim closes the drawer", async ({ page }) => {
		await setViewport(page, "narrow");
		await page.locator("[data-rail-toggle]").click();
		await expect(page.locator(".workspace-frame__rail")).toHaveAttribute(
			"data-open",
			"true",
		);
		await page
			.locator("[data-rail-scrim]")
			.click({ position: { x: 500, y: 400 } });
		await expect(page.locator(".workspace-frame__rail")).toHaveCSS(
			"visibility",
			"hidden",
		);
	});

	test("is not offered where the rail is already a column", async ({
		page,
	}) => {
		// Above 980px the rail is visible and a drawer toggle would be a control for something already on
		// screen.
		await setViewport(page, "desktop");
		await expect(page.locator("[data-rail-toggle]")).toBeHidden();
	});
});

test.describe("13a: the phone", () => {
	test("the list is the first screen and the conversation is a second level with a back control", async ({
		page,
	}) => {
		// 13a:17 and spec L545. The **address stays one address**: the thread is a search parameter, so the
		// second level is a navigation with a history entry rather than a second path.
		await setViewport(page, "phone");
		await page.goto("/boards/platform?view=threads");
		await expect(page.locator(".thread-row").first()).toBeVisible();
		// The list is showing; the conversation is not, and there is nothing to go back from.
		await expect(page.locator(".workspace-frame__conversation")).toHaveCSS(
			"display",
			"none",
		);
		await expect(page.locator("[data-conversation-back]")).toBeHidden();

		await page.locator(".thread-row").first().click();
		await expect(page.locator(".workspace-frame__conversation")).toBeVisible();
		await expect(page.locator("[data-conversation-back]")).toBeVisible();
		// **The other level is gone**, which is what "second level" means — asserted as the `display` the
		// rule sets rather than as visibility. Measured: "the conversation is visible" was true with the
		// pane still in the layout, so that assertion alone proved nothing; and `toBeHidden` passed even
		// with the rule flipped back to `block`, because at this width a second child of a one-row grid is
		// squeezed to zero height. `display` is the property the rule actually governs.
		await expect(page.locator(".workspace-frame__pane")).toHaveCSS(
			"display",
			"none",
		);
		// The URL is still the board route, with the thread in the search.
		expect(page.url()).toContain("/boards/platform");
		expect(page.url()).toContain("thread=");

		await page.locator("[data-conversation-back]").click();
		await expect(page.locator(".workspace-frame__conversation")).toHaveCSS(
			"display",
			"none",
		);
		await expect(page.locator(".thread-row").first()).toBeVisible();
	});

	test("the composer is reachable and usable at 320px", async ({ page }) => {
		// The width where the composer broke once already, and 13a:19 asks for it by name.
		await setViewport(page, "phoneSmall");
		// **The reader's path, not a direct URL**: on a phone the thread list is the first screen, so a test
		// that jumped straight to a thread URL would skip the level the criterion is about.
		await page.goto("/boards/platform?view=threads");
		await page.locator(".thread-row").first().click();
		await expect(page.locator(".workspace-frame__conversation")).toBeVisible();
		const composer = page.getByLabel("Write a message");
		await expect(composer).toBeVisible();
		// **In the viewport**, not merely present: `toBeVisible` is true for an element scrolled past the
		// bottom of a clipped container, and that is how a composer becomes unusable.
		const box = await composer.boundingBox();
		if (box === null) throw new Error("no composer box");
		expect(box.y + box.height).toBeLessThanOrEqual(WIDTHS.phoneSmall.height);
		await composer.fill("Typed at 320px.");
		await page.getByRole("button", { name: "Send" }).click();
		await expect(
			page.locator(".entry__text", { hasText: "Typed at 320px." }),
		).toHaveCount(1);
	});
});

test.describe("13a: the floors", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/boards/platform?view=threads&thread=delivery");
		await expect(page.locator(".entry").first()).toBeVisible();
	});

	test("no functional text computes below 13px where it is body copy", async ({
		page,
	}) => {
		// **13a makes the first assertion of the floors**, at its two extremes; 15a re-asserts over the
		// whole product. The distinction matters: a floor asserted only where a ticket happened to look is
		// not a floor, which is why 15a re-runs it rather than introducing it.
		//
		// The elements are named rather than swept. "Everything on the page" would fail on the 11px
		// labels DESIGN.md sets deliberately — the label is the floor, not an exception to it.
		for (const name of ["desktop", "phone"] as ViewportName[]) {
			await setViewport(page, name);
			for (const selector of [
				".entry__text",
				".thread-row__name",
				".board-rail__name",
				".conversation__title",
				".entry__author",
			]) {
				const target = page.locator(selector).first();
				if ((await target.count()) === 0) continue;
				const type = await measureType(target);
				expect(
					type.fontSizePx,
					`${selector} computes ${type.fontSizePx}px at ${name} (${WIDTHS[name].width}px), below the 13px body floor`,
				).toBeGreaterThanOrEqual(13);
			}
		}
	});

	test("labels compute at least 11px, the smallest the design system permits", async ({
		page,
	}) => {
		// The other side of the line, asserted separately: a single ">= 11" over every element would let
		// body copy ship at 11px.
		await setViewport(page, "phone");
		for (const selector of [
			".entry__time",
			".entry__seq",
			".conversation__subtitle",
		]) {
			const target = page.locator(selector).first();
			if ((await target.count()) === 0) continue;
			const type = await measureType(target);
			expect(
				type.fontSizePx,
				`${selector} computes ${type.fontSizePx}px, below the 11px label floor`,
			).toBeGreaterThanOrEqual(11);
		}
	});

	test("text meets WCAG AA against the surface it is actually painted on", async ({
		page,
	}) => {
		// **Against the surface the browser resolved**, not a token: `measureTextContrast` walks up to the
		// first painted background, which is what a reader sees. A token comparison would pass on a
		// component whose own background differs from the token it inherited.
		for (const name of ["desktop", "phone"] as ViewportName[]) {
			await setViewport(page, name);
			for (const selector of [
				".entry__text",
				".entry__author",
				".thread-row__name",
				".conversation__title",
			]) {
				const target = page.locator(selector).first();
				if ((await target.count()) === 0) continue;
				const ratio = await measureTextContrast(target);
				// 4.5:1 is AA for body text, and the inks are chosen to clear it — so anything below is a
				// regression rather than a style preference.
				expect(
					ratio,
					`${selector} has contrast ${ratio.toFixed(2)}:1 at ${name} (${WIDTHS[name].width}px), below WCAG AA 4.5:1`,
				).toBeGreaterThanOrEqual(4.5);
			}
		}
	});
});

test.describe("13a: the panels fit the viewport", () => {
	test("the stream panel opens fully inside the viewport at every width", async ({
		page,
	}) => {
		// 13a:20 and QA.md L21: anchored within the viewport, and never past an edge.
		for (const name of Object.keys(WIDTHS) as ViewportName[]) {
			await setViewport(page, name);
			await page.goto("/boards/platform?view=threads&thread=delivery");
			await expect(page.locator(".entry").first()).toBeVisible();

			// **The stream panel is inline content in the conversation column, not an overlay** — 11b's
			// decision, and the criterion's "opens fully inside the viewport" was written for a panel that
			// opens. So the honest measurement is horizontal: it spans its column and no more. Asserting it
			// fits the viewport vertically would assert that a scrolled column contains nothing below the
			// fold, which is what scrolling is for.
			//
			// Recorded rather than quietly narrowed: if the panel becomes an overlay, this is the
			// assertion that must change with it.
			const box = await page.locator(".stream-panel").first().boundingBox();
			if (box === null) throw new Error(`no stream panel at ${name}`);
			expect(
				box.x,
				`starts before the viewport at ${name}`,
			).toBeGreaterThanOrEqual(-1);
			expect(
				box.x + box.width,
				"runs past the right edge at " +
					name +
					" (" +
					WIDTHS[name].width +
					"px)",
			).toBeLessThanOrEqual(WIDTHS[name].width + 1);
			// And it is reachable: scrolled into view, its control is operable.
			await page.locator(".stream-panel").first().scrollIntoViewIfNeeded();
			await expect(page.locator("[data-stream-toggle]")).toBeVisible();
		}
	});

	test("the participant panel opens fully inside the viewport at every width", async ({
		page,
	}) => {
		for (const name of Object.keys(WIDTHS) as ViewportName[]) {
			await setViewport(page, name);
			// No thread open: on a phone the pane is hidden once one is, and the people list is the pane.
			await page.goto("/boards/platform?view=people");
			await expect(
				page.locator("[data-participant-open]").first(),
			).toBeVisible();
			await page.locator("[data-participant-open]").first().click();

			const panel = page.getByRole("complementary", {
				name: /participant details/i,
			});
			const box = await panel.boundingBox();
			if (box === null) throw new Error(`no participant panel at ${name}`);
			expect(box.x).toBeGreaterThanOrEqual(-1);
			expect(
				box.x + box.width,
				"runs past the right edge at " +
					name +
					" (" +
					WIDTHS[name].width +
					"px)",
			).toBeLessThanOrEqual(WIDTHS[name].width + 1);
			expect(box.y + box.height).toBeLessThanOrEqual(WIDTHS[name].height + 1);
		}
	});
});

test.describe("13a: content degrades without breaking", () => {
	test("thread titles truncate rather than pushing the layout", async ({
		page,
	}) => {
		// story 123 and spec L184. A long title must not widen the row: the pane keeps its width and the
		// text clips with an ellipsis.
		await setViewport(page, "narrow");
		await page.goto("/boards/platform?view=threads");
		await expect(page.locator(".thread-row").first()).toBeVisible();

		const measured = await page.evaluate(() => {
			const row = document.querySelector(
				".thread-row__title",
			) as HTMLElement | null;
			if (!row) return null;
			const style = getComputedStyle(row);
			return {
				overflow: style.overflow,
				textOverflow: style.textOverflow,
				whiteSpace: style.whiteSpace,
			};
		});
		if (measured === null) throw new Error("no thread row title");
		// Truncation is a computed property rather than an impression: clipping with an ellipsis and no
		// wrapping is the only combination that shortens rather than pushes.
		expect(measured.overflow).toBe("hidden");
		expect(measured.textOverflow).toBe("ellipsis");
		expect(measured.whiteSpace).toBe("nowrap");
	});

	test("in-thread search is reachable on a phone, closing the prototype gap", async ({
		page,
	}) => {
		// QA.md L29: the prototype had no reachable entry point below 680px. This asserts the app does
		// not carry that forward.
		await setViewport(page, "phone");
		await page.goto("/boards/platform?view=threads");
		await page.locator(".thread-row").first().click();
		await expect(page.locator(".workspace-frame__conversation")).toBeVisible();

		const search = page.locator(".conversation__search-input");
		await expect(search).toBeVisible();
		const box = await search.boundingBox();
		if (box === null) throw new Error("no search box");
		expect(box.y + box.height).toBeLessThanOrEqual(WIDTHS.phone.height);
		await search.fill("replay");
		await expect(page.locator(".entry").first()).toBeVisible();
	});

	test("the dark rail keeps its active-row inset edge and unread counts while it is visible", async ({
		page,
	}) => {
		// 13a:25. The selected state is an inset edge rather than a colour change, which matters on the
		// dark rail for the same reason the focus ring is an outline.
		for (const name of ["desktop", "wide"] as ViewportName[]) {
			await setViewport(page, name);
			await page.goto("/boards/platform?view=threads");
			const active = page
				.locator('.board-rail__row[aria-current="page"]')
				.first();
			await expect(active).toBeVisible();
			const edge = await active.evaluate(
				(element) => getComputedStyle(element).boxShadow,
			);
			expect(edge, `no inset edge on the active row at ${name}`).toContain(
				"inset",
			);
			await expect(page.locator(".board-rail__count").first()).toBeVisible();
		}
	});
});
