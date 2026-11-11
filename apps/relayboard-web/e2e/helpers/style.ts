/**
 * The route seam's style instruments.
 *
 * The prototype's `QA.md` records that its own assertions deliberately read no computed style, so
 * every visual question it could not answer was answered by a human looking at it. That is what
 * this file exists to replace — narrowly. It measures the **specific** properties three tickets
 * name rather than "the design", because a suite that asserts a whole computed style fails on
 * every legitimate refinement and gets deleted.
 *
 * What it is used for:
 *
 * - 01's type floor (a real font is applied, and the body text is at least 13px).
 * - 01's contrast floor (ink on the surface it is painted on, computed, not eyeballed).
 * - 15b's font assertion (the family the design system names, not a fallback).
 *
 * It returns numbers and strings; the caller asserts. A helper that asserted would have to know
 * which floor each ticket sets, and 13a and 15a set different ones at different widths.
 */
import { expect, type Locator } from "@playwright/test";

/** The computed properties the design system's floors are expressed in. */
export interface ComputedType {
	readonly fontFamily: string;
	readonly fontSizePx: number;
	readonly fontWeight: number;
	readonly lineHeight: string;
	readonly color: string;
	readonly backgroundColor: string;
}

/** Read the type and colour a reader actually gets, from the browser's own resolution. */
export const measureType = async (target: Locator): Promise<ComputedType> => {
	const count = await target.count();
	expect(
		count,
		`measureType: expected exactly one element, found ${count}`,
	).toBe(1);
	return await target.evaluate((element) => {
		const style = getComputedStyle(element);
		return {
			fontFamily: style.fontFamily,
			fontSizePx: Number.parseFloat(style.fontSize),
			fontWeight: Number(style.fontWeight),
			lineHeight: style.lineHeight,
			color: style.color,
			backgroundColor: style.backgroundColor,
		};
	});
};

/** An `rgb(...)` or `rgba(...)` colour, parsed. */
export interface Rgba {
	readonly r: number;
	readonly g: number;
	readonly b: number;
	readonly a: number;
}

/**
 * Parse a computed colour.
 *
 * Computed colours are always `rgb`/`rgba` in Chromium, so the parser only needs those two, and
 * it throws on anything else rather than returning a plausible-looking zero — a contrast check
 * reading `(0,0,0)` from an unparsed colour would report a ratio of 21:1 and pass.
 */
export const parseColor = (value: string): Rgba => {
	const match = /^rgba?\(([^)]+)\)$/.exec(value.trim());
	if (!match?.[1]) {
		throw new Error(
			`parseColor: "${value}" is not an rgb() or rgba() colour. A computed colour is always one of those in Chromium; anything else means this read a declaration rather than a computed value.`,
		);
	}
	const parts = match[1]
		.split(/[,/]/)
		.map((part) => Number.parseFloat(part.trim()));
	const [r = Number.NaN, g = Number.NaN, b = Number.NaN, a = 1] = parts;
	if ([r, g, b].some(Number.isNaN)) {
		throw new Error(`parseColor: "${value}" has a non-numeric channel.`);
	}
	return { r: r / 255, g: g / 255, b: b / 255, a };
};

/** WCAG relative luminance. */
const luminance = ({ r, g, b }: Rgba): number => {
	const channel = (value: number): number =>
		value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/**
 * The contrast ratio between two colours, from 1 to 21.
 *
 * The ratio is what WCAG's floors are stated in, so asserting 4.5:1 is asserting the documented
 * requirement rather than a colour a designer happened to pick.
 */
export const contrastRatio = (foreground: Rgba, background: Rgba): number => {
	const lighter = Math.max(luminance(foreground), luminance(background));
	const darker = Math.min(luminance(foreground), luminance(background));
	return (lighter + 0.05) / (darker + 0.05);
};

/**
 * The colour actually painted behind an element.
 *
 * Walking up the tree until a non-transparent background is found, because the ink is painted on
 * whatever surface is behind it — measuring an element's own transparent background would compare
 * ink against nothing and report a ratio against black.
 */
export const paintedBackground = async (target: Locator): Promise<Rgba> => {
	const value = await target.evaluate((element) => {
		let node: Element | null = element;
		while (node) {
			const background = getComputedStyle(node).backgroundColor;
			if (background !== "transparent" && !/,\s*0(\.0+)?\)$/.test(background)) {
				return background;
			}
			node = node.parentElement;
		}
		return getComputedStyle(document.documentElement).backgroundColor;
	});
	return parseColor(value);
};

/**
 * The contrast an element's text actually achieves against what is behind it.
 *
 * The one measurement 01's floor and 15a's re-assertion both need, in the form the requirement is
 * written: a ratio, from the ink the browser resolved and the surface that is actually there.
 */
export const measureTextContrast = async (target: Locator): Promise<number> => {
	const type = await measureType(target);
	const background = await paintedBackground(target);
	return contrastRatio(parseColor(type.color), background);
};
