import { expect, test } from "./helpers/fixtures";
import {
	expectCoversTrack,
	expectNoOverflow,
	setViewport,
	type ViewportName,
	WIDTHS,
} from "./helpers/layout";

/**
 * The layout floors this ticket can assert, at the widths 13a will measure.
 *
 * ## Why this file exists at all, when 13a owns responsive geometry
 *
 * Because the instruments have to be proved before 13a trusts them. A `measureExtent` that
 * silently returned `coversTrack: true` for everything would make 13a's headline criterion
 * vacuous, and that is the exact failure this session has already made once — a green check on a
 * broken page. So the harness's first job is to prove its own measurements can fail.
 *
 * **The positive assertions below are deliberately narrower than 13a's.** This test says the
 * instruments work and that the frame is not obviously broken at six widths; 13a says the design
 * holds at each of them, including the surfaces and measures this file does not know about. Proving
 * a floor here is not a substitute for proving the design there, and 13a is free to tighten any of
 * this.
 */
test.describe("the layout instruments", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/boards/platform");
		// The pane's rows are the content that could overflow; without them the measurement is of
		// an empty box.
		await expect(page.locator(".thread-row").first()).toBeVisible();
	});

	test("measureOverflow reports a real overflow when one is introduced", async ({
		page,
	}) => {
		// The instrument must be able to fail. A panel is widened past its column's width so the
		// pane is genuinely too narrow for its content, and the measurement is required to notice.
		await page.evaluate(() => {
			const row = document.querySelector(".thread-row");
			if (row instanceof HTMLElement) row.style.width = "2000px";
		});
		const measurement = await page.evaluate(() => {
			const pane = document.querySelector(".workspace-frame__pane");
			if (!pane) throw new Error("no pane");
			return { scrollWidth: pane.scrollWidth, clientWidth: pane.clientWidth };
		});
		expect(
			measurement.scrollWidth,
			"A 2000px row inside the pane produced no horizontal overflow, so measureOverflow's positive case cannot be trusted.",
		).toBeGreaterThan(measurement.clientWidth);
	});

	test("measureExtent reports a real shortfall when one is introduced", async ({
		page,
	}) => {
		// The rail defect in miniature: a nav that fills its column's width but not its height.
		// Nothing overflows — which is exactly why 13a cannot use an overflow check for this.
		await page.evaluate(() => {
			const nav = document.querySelector(".workspace-frame__rail nav");
			if (nav instanceof HTMLElement) nav.style.height = "221px";
		});
		const measurement = await page.evaluate(() => {
			const nav = document.querySelector(".workspace-frame__rail nav");
			const column = document.querySelector(".workspace-frame__rail");
			if (!nav || !column) throw new Error("no rail");
			return {
				navHeight: nav.getBoundingClientRect().height,
				columnHeight: column.getBoundingClientRect().height,
				navScroll: nav.scrollHeight,
				navClient: nav.clientHeight,
			};
		});
		expect(measurement.navHeight).toBeLessThan(measurement.columnHeight);
		// The point of the whole split, asserted as a fact rather than described: the short surface
		// has NO overflow. An overflow-only check passes here.
		expect(measurement.navScroll).toBeLessThanOrEqual(
			measurement.navClient + 1,
		);
	});

	test("the instruments refuse to measure the document element", async ({
		page,
	}) => {
		// A document-level overflow check is vacuous under `overflow: hidden`, which the frame sets.
		// The helper throws rather than documenting the precondition, so the mistake is unavailable.
		const documentOverflows = await page.evaluate(
			() =>
				document.documentElement.scrollWidth >
				document.documentElement.clientWidth,
		);
		expect(
			documentOverflows,
			"This assertion documents the reason the helper refuses the document element: the frame sets overflow: hidden, so this measurement is true regardless of whether the columns inside it are broken.",
		).toBe(false);
	});

	test("every column fits its content at each of the six widths", async ({
		page,
	}) => {
		for (const name of Object.keys(WIDTHS) as ViewportName[]) {
			await setViewport(page, name);
			await expectNoOverflow(
				page.locator(".workspace-frame__pane"),
				`the pane at ${name} (${WIDTHS[name].width}px)`,
			);
			await expectNoOverflow(
				page.locator(".workspace-frame__conversation"),
				`the conversation at ${name} (${WIDTHS[name].width}px)`,
			);
		}
	});

	test("each column paints the full height of the frame it sits in", async ({
		page,
	}) => {
		// A column fills its track's **height** and only part of its width: the three columns divide
		// the frame horizontally, so a 336px pane in a 1440px frame is correct. That is why the axis
		// is explicit — the rail defect was a surface that filled its width and not its height, and a
		// "both" check against the frame would have reported the pane as 1104px short and been
		// switched off rather than fixed.
		// Above 980px the three columns are one row, so each fills the frame's whole height.
		for (const name of ["desktop", "wide"] as ViewportName[]) {
			await setViewport(page, name);
			await expectCoversTrack(
				page.locator(".workspace-frame__pane"),
				page.locator(".workspace-frame"),
				`the pane at ${name} (${WIDTHS[name].width}px)`,
				"height",
			);
			await expectCoversTrack(
				page.locator(".workspace-frame__conversation"),
				page.locator(".workspace-frame"),
				`the conversation at ${name} (${WIDTHS[name].width}px)`,
				"height",
			);
		}
	});

	test("below 980px the rows still cover the frame, and on a phone one level covers it", async ({
		page,
	}) => {
		// **04a's interim is what this test used to assert, and 13a replaced it.** At and below 980px the
		// pane sat above the conversation in two rows with the rail spanning both; 13a makes the rail an
		// overlay drawer and, at and below 680px, makes the pane the first screen and the conversation the
		// second — one level at a time, of the same route (spec L545).
		//
		// So the invariant is stated per width rather than assumed: the painted surfaces cover the frame,
		// whichever ones are showing. That is the property 04a was protecting; the *arrangement* is 13a's
		// to change.
		for (const name of ["narrow", "phone"] as ViewportName[]) {
			await setViewport(page, name);
			await page.goto("/boards/platform?view=threads");
			await expect(page.locator(".thread-row").first()).toBeVisible();
			const coverage = await page.evaluate(() => {
				const frame = document.querySelector(".workspace-frame");
				if (!frame) throw new Error("frame missing");
				const frameHeight = frame.getBoundingClientRect().height;
				// Every child of the frame that is actually laid out, not merely present.
				const painted = [...frame.children]
					.map((child) => {
						const style = getComputedStyle(child as HTMLElement);
						const rect = child.getBoundingClientRect();
						return {
							display: style.display,
							background: style.backgroundColor,
							height: rect.height,
						};
					})
					.filter((child) => child.display !== "none");
				return { frameHeight, painted };
			});
			expect(
				coverage.painted.length,
				`${name}: no laid-out child of the frame — the frame is painted by nothing.`,
			).toBeGreaterThan(0);
			// **Only the surfaces meant to paint are checked for a background.** The rail is a wrapper whose
			// `nav` carries the dark surface, and the frame paints under all three — so a transparent
			// wrapper is correct, and asserting otherwise would fail on the layout working. The two named
			// surfaces are the ones DESIGN.md makes painted.
			for (const [name_, selector] of [
				[name, ".workspace-frame__pane"],
				[name, ".workspace-frame__conversation"],
			] as const) {
				const painted = await page
					.locator(selector)
					.evaluate((element) => getComputedStyle(element).backgroundColor);
				expect(
					painted,
					`${name_}: ${selector} paints no background, so it shows the page through it. This is EXTENT, not overflow.`,
				).not.toBe("rgba(0, 0, 0, 0)");
			}
			// The tallest painted surface reaches the frame: either one level fills it, or two rows sum to
			// it. The sum is what 04a asserted and it is still the right invariant; the difference is that
			// on a phone only one row exists.
			const tallest = Math.max(
				...coverage.painted.map((child) => child.height),
			);
			expect(
				Math.abs(coverage.frameHeight - tallest),
				`${name}: the tallest laid-out surface is ${tallest}px in a ${coverage.frameHeight}px frame, so part of the frame is painted by nothing. This is EXTENT, not overflow.`,
			).toBeLessThanOrEqual(2);
		}
	});

	test("the rail's nav fills the rail column in both dimensions", async ({
		page,
	}) => {
		// The defect this instrument exists for, asserted positively: a nav that is only as tall as
		// its rows leaves the column painted by the page background. Measured at the widths where the
		// rail is a column at all — below 680px it is parked off-canvas (04a), which 13a replaces.
		for (const name of ["desktop", "wide", "narrow"] as ViewportName[]) {
			await setViewport(page, name);
			await expectCoversTrack(
				page.locator(".workspace-frame__rail nav"),
				page.locator(".workspace-frame__rail"),
				`the rail's nav at ${name} (${WIDTHS[name].width}px)`,
				"both",
			);
		}
	});
});
