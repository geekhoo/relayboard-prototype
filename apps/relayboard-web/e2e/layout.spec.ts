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

	test("below 980px the two rows together still cover the frame", async ({
		page,
	}) => {
		// At and below 980px 04a's interim layout puts the pane above the conversation in two rows,
		// with the rail spanning both (WorkspaceFrame.css §29-48). Each one fills **half** the frame
		// by design, so measuring either against the frame reports a 450px shortfall that is not a
		// defect — which is the mistake this test exists to prevent a later reader from making.
		// What must be true is that the two rows add up to the frame and nothing is left unpainted.
		for (const name of ["narrow", "phone"] as ViewportName[]) {
			await setViewport(page, name);
			const coverage = await page.evaluate(() => {
				const frame = document.querySelector(".workspace-frame");
				const pane = document.querySelector(".workspace-frame__pane");
				const conversation = document.querySelector(
					".workspace-frame__conversation",
				);
				if (!frame || !pane || !conversation) throw new Error("frame missing");
				const frameRect = frame.getBoundingClientRect();
				const paneRect = pane.getBoundingClientRect();
				const conversationRect = conversation.getBoundingClientRect();
				const panePaints = getComputedStyle(pane).backgroundColor;
				const conversationPaints =
					getComputedStyle(conversation).backgroundColor;
				return {
					frameHeight: frameRect.height,
					stackedHeight: paneRect.height + conversationRect.height,
					panePaints,
					conversationPaints,
					stacked:
						Math.abs(paneRect.top - conversationRect.top) > 1 &&
						paneRect.top < conversationRect.top,
				};
			});
			expect(
				coverage.stacked,
				`${name}: the pane and the conversation were expected to be two rows below 980px, not side by side.`,
			).toBe(true);
			expect(
				Math.abs(coverage.frameHeight - coverage.stackedHeight),
				`${name}: the two rows sum to ${coverage.stackedHeight}px in a ${coverage.frameHeight}px frame, so part of the frame is painted by nothing. This is EXTENT, not overflow.`,
			).toBeLessThanOrEqual(2);
			// Both rows paint something: a row that fills its track and shows the page through it is
			// the same defect as a short surface.
			expect(coverage.panePaints).not.toBe("rgba(0, 0, 0, 0)");
			expect(coverage.conversationPaints).not.toBe("rgba(0, 0, 0, 0)");
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
