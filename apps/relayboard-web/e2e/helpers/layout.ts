/**
 * The route seam's measuring instruments.
 *
 * ## Why two functions and not one `assertFits()`
 *
 * A layout can be wrong in two different ways, and this session shipped one of each:
 *
 * 1. **Overflow** — content is bigger than its box. `scrollWidth > clientWidth`, and the reader
 *    gets a horizontal scrollbar inside a column.
 * 2. **Extent** — the surface is smaller than the track it sits in, so part of the column is
 *    painted by whatever is behind it. Nothing overflows; nothing reports an error; the defect is
 *    purely that something is *short*.
 *
 * The second is not hypothetical. The board rail shipped as a 240×221 nav inside a 240×900
 * column — the nav was 679px short of the column it filled the width of, and it passed **every**
 * overflow assertion, because content that fits its own box overflows nothing. A single
 * `assertFits()` that checked both would have passed the rail, and would have reported the
 * failure against the wrong property.
 *
 * So: `measureOverflow` answers "does the content fit", `measureExtent` answers "does the painted
 * surface cover the track", and each failure message says which one broke.
 *
 * ## Why these measure elements and never the document
 *
 * `documentElement.scrollWidth === documentElement.clientWidth` is **true under
 * `overflow: hidden`**, which the app frame may set. A document-level measurement would therefore
 * pass while every column inside it was broken, which is what makes it a vacuous check rather
 * than a weak one. `measureOverflow` refuses the document element and the body outright: a
 * measurement that cannot be taken correctly should not be available to be taken wrongly.
 */
import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** One rectangle, as the browser reports it. */
export interface MeasuredRect {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

/** The scroll geometry that proves whether content fits its box. */
export interface OverflowMeasurement {
	readonly scrollWidth: number;
	readonly clientWidth: number;
	readonly scrollHeight: number;
	readonly clientHeight: number;
	/** True when the box scrolls horizontally: content is wider than the visible box. */
	readonly overflowsX: boolean;
	/** True when the box scrolls vertically. */
	readonly overflowsY: boolean;
}

/**
 * Which dimension of a track a surface is expected to fill.
 *
 * A **column** in the frame fills its track's height and only part of its width — the three columns
 * divide the frame horizontally, so a pane 336px wide in a 1440px frame is correct, not 1104px
 * short. A **surface inside** a column (the rail's nav inside the rail) is expected to fill both.
 * Making the axis explicit is what keeps `coversTrack` from meaning two things, which is how the
 * rail defect would have been measured against the wrong track and passed.
 */
export type ExtentAxis = "both" | "height" | "width";

/** The geometry that proves whether a painted surface covers the track it sits in. */
export interface ExtentMeasurement {
	readonly surface: MeasuredRect;
	readonly track: MeasuredRect;
	/** The surface's own computed background, so "painted" is observable rather than assumed. */
	readonly backgroundColor: string;
	/** False when the computed background is transparent: it fills the track but paints nothing. */
	readonly paintsBackground: boolean;
	/** False when the surface leaves any part of its track uncovered. */
	readonly coversTrack: boolean;
	/** How many pixels of track the surface fails to cover, in the worst direction. */
	readonly shortfallPx: number;
}

/**
 * The tolerance for a one-pixel discrepancy.
 *
 * Fractional layout means a surface and its track can differ by a sub-pixel without anything being
 * wrong, and a check that failed on 0.4px would be turned off within a week.
 */
export const TOLERANCE_PX = 1;

/**
 * Assert the locator resolves to a single element and not to the document or the body.
 *
 * Exported because both measurements use it, and because the thrown message is the whole value of
 * the refusal: it says what to pass instead.
 */
const requireMeasurableElement = async (
	target: Locator,
	what: string,
): Promise<void> => {
	const count = await target.count();
	expect(count, `${what}: expected exactly one element, found ${count}`).toBe(
		1,
	);
	const isDocumentScoped = await target.evaluate(
		(element) =>
			element === document.documentElement || element === document.body,
	);
	expect(
		isDocumentScoped,
		`${what}: refusing to measure <${await target.evaluate((element) => element.tagName.toLowerCase())}>. ` +
			"The document element reports no overflow under 'overflow: hidden', which the app frame " +
			"may set, so a document-level measurement passes while every column inside it is broken. " +
			"Pass the specific column or scroll container instead — for example '.workspace-frame__pane' " +
			"rather than 'body'.",
	).toBe(false);
};

/**
 * Measure whether an element's content fits inside it.
 *
 * `+1` on the comparison absorbs sub-pixel rounding, which is why the ticket states the rule as
 * `scrollWidth <= clientWidth + 1`.
 */
export const measureOverflow = async (
	container: Locator,
): Promise<OverflowMeasurement> => {
	await requireMeasurableElement(container, "measureOverflow");
	const measurement = await container.evaluate((element) => ({
		scrollWidth: element.scrollWidth,
		clientWidth: element.clientWidth,
		scrollHeight: element.scrollHeight,
		clientHeight: element.clientHeight,
	}));
	return {
		...measurement,
		overflowsX:
			measurement.scrollWidth > measurement.clientWidth + TOLERANCE_PX,
		overflowsY:
			measurement.scrollHeight > measurement.clientHeight + TOLERANCE_PX,
	};
};

/**
 * Assert an element's content fits, with a message that says **overflow** and names the numbers.
 */
export const expectNoOverflow = async (
	container: Locator,
	what: string,
	axis: "x" | "y" | "both" = "x",
): Promise<OverflowMeasurement> => {
	const measurement = await measureOverflow(container);
	if (axis !== "y") {
		expect(
			measurement.overflowsX,
			`${what} scrolls horizontally: scrollWidth ${measurement.scrollWidth} > clientWidth ${measurement.clientWidth} + ${TOLERANCE_PX}. This is OVERFLOW — the content is wider than the box.`,
		).toBe(false);
	}
	if (axis !== "x") {
		expect(
			measurement.overflowsY,
			`${what} scrolls vertically: scrollHeight ${measurement.scrollHeight} > clientHeight ${measurement.clientHeight} + ${TOLERANCE_PX}. This is OVERFLOW.`,
		).toBe(false);
	}
	return measurement;
};

const rectOf = (locator: Locator): Promise<MeasuredRect> =>
	locator.evaluate((element) => {
		const rect = element.getBoundingClientRect();
		return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
	});

/**
 * Measure whether a painted surface covers the track it sits in.
 *
 * Both arguments are locators because the interesting question is relational: the rail's nav
 * versus the rail's column, the pane's list versus the pane. A surface measured alone has no
 * truth value — 221px is not wrong until you know the column is 900.
 */
export const measureExtent = async (
	surface: Locator,
	track: Locator,
	axis: ExtentAxis = "both",
): Promise<ExtentMeasurement> => {
	await requireMeasurableElement(surface, "measureExtent(surface)");
	await requireMeasurableElement(track, "measureExtent(track)");
	const [surfaceRect, trackRect, backgroundColor] = await Promise.all([
		rectOf(surface),
		rectOf(track),
		surface.evaluate((element) => getComputedStyle(element).backgroundColor),
	]);
	// A transparent background means the surface fills its track and shows the page through it,
	// which reads as the same defect as being short: the column is not painted by this element.
	const paintsBackground =
		backgroundColor !== "transparent" &&
		!/^rgba\(.*,\s*0(\.0+)?\)$/.test(backgroundColor);
	const widthShort = Math.max(0, trackRect.width - surfaceRect.width);
	const heightShort = Math.max(0, trackRect.height - surfaceRect.height);
	return {
		surface: surfaceRect,
		track: trackRect,
		backgroundColor,
		paintsBackground,
		coversTrack:
			(axis === "height" || widthShort <= TOLERANCE_PX) &&
			(axis === "width" || heightShort <= TOLERANCE_PX) &&
			paintsBackground,
		shortfallPx:
			axis === "height"
				? heightShort
				: axis === "width"
					? widthShort
					: Math.max(widthShort, heightShort),
	};
};

/**
 * Assert a surface covers its track, with a message that says **extent, not overflow**.
 *
 * The sentence matters: a reader who has just seen an overflow check pass needs to be told that
 * this is a different kind of wrong, or they will look for the wrong bug.
 */
export const expectCoversTrack = async (
	surface: Locator,
	track: Locator,
	what: string,
	axis: ExtentAxis = "both",
): Promise<ExtentMeasurement> => {
	const measurement = await measureExtent(surface, track, axis);
	expect(
		measurement.paintsBackground,
		`${what}: the surface fills its track but paints no background ("${measurement.backgroundColor}"). This is EXTENT, not overflow — the column is showing whatever is behind it.`,
	).toBe(true);
	expect(
		measurement.coversTrack,
		`${what}: the surface is ${measurement.surface.width}x${measurement.surface.height} in a ${measurement.track.width}x${measurement.track.height} track — ${measurement.shortfallPx}px short. This is EXTENT, not overflow: content fits its own box and overflow is clean, but the column is only partly painted.`,
	).toBe(true);
	return measurement;
};

/** The widths 13a measures at, and the two `QA.md` records for the prototype. */
export const WIDTHS = {
	phoneSmall: { width: 320, height: 700 },
	phone: { width: 390, height: 844 },
	phoneLarge: { width: 680, height: 900 },
	narrow: { width: 980, height: 900 },
	wide: { width: 1200, height: 900 },
	desktop: { width: 1440, height: 900 },
} as const;

export type ViewportName = keyof typeof WIDTHS;

/**
 * Set the viewport to one of the widths the design system names.
 *
 * One call per width rather than a number at each call site, so 13a's six widths and 15a's
 * re-assertion over the whole product cannot drift into seven different sets of numbers.
 */
export const setViewport = async (
	page: Page,
	name: ViewportName,
): Promise<void> => {
	await page.setViewportSize(WIDTHS[name]);
	// A resize is asynchronous in layout terms: the next measurement must not read the old box.
	await page.evaluate(
		() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))),
	);
};
