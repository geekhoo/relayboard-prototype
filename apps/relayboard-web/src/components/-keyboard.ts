import { useEffect } from "react";

/**
 * The keyboard layer: the prototype's global shortcuts, and the rules that keep focus findable.
 *
 * ## The prototype's guard, kept exactly (`app.js` L222)
 *
 * `/` focuses thread search and `Ctrl/Cmd + K` does the same. Both are guarded:
 *
 * - **Not while typing.** `active.tagName` being `INPUT` or `TEXTAREA` suppresses `/`, or a `/` in the
 *   composer would jump the reader out of their draft. The prototype checks exactly those two tags and so
 *   does this; a `contenteditable` guard would be inventing a case the product has none of.
 * - **Not while a dialog is open** — the prototype checks its two dialogs and this checks the native
 *   `dialog[open]`, which covers all of ours because 13a, 14 and 08b all use `<dialog>`.
 *
 * `Ctrl/Cmd + K` is **not** guarded on typing, because the prototype does not guard it: it is the
 * escape-hatch form of the shortcut and a reader in a field who presses it means it.
 *
 * ## Escape closes one layer, and the layers are ordered
 *
 * A dialog covers everything, so it is handled by the dialog itself (13a and 14 each assert their own).
 * Then the rail drawer, then the participant panel. This module owns the **rail drawer**, because a
 * drawer that a keyboard user cannot leave is a trap rather than a drawer — and it returns focus to the
 * toggle it came from, which is the half that makes Leave reversible.
 */
export interface KeyboardLayerOptions {
	/** The thread search field, focused by `/` and `Ctrl/Cmd + K`. */
	readonly searchField: () => HTMLElement | null;
	/** Whether the rail drawer is open, and how to open or close it. */
	readonly railOpen: () => boolean;
	readonly setRailOpen: (open: boolean) => void;
	/** The control that opens the drawer, so closing can return focus to it. */
	readonly railToggle: () => HTMLElement | null;
}

/**
 * Whether the reader is typing, which is the prototype's guard.
 *
 * Exported so a test can assert the predicate directly as well as through the handler: a shortcut that
 * works because the field happened to be blurred is not the same thing as one that respects typing.
 */
export const isTyping = (element: Element | null): boolean =>
	element !== null &&
	(element.tagName === "INPUT" || element.tagName === "TEXTAREA");

/** Whether any dialog is open, which suppresses the global shortcuts. */
export const dialogOpen = (): boolean =>
	document.querySelector("dialog[open]") !== null;

/**
 * Install the keyboard layer, and return a function that removes it.
 *
 * One listener on `window` rather than per control: the shortcuts are global by definition, and a
 * per-control listener would have to be added to each surface that might be focused when the key is
 * pressed.
 */
export const installKeyboardLayer = (
	options: KeyboardLayerOptions,
): (() => void) => {
	const onKey = (event: KeyboardEvent) => {
		const active = document.activeElement;
		const typing = isTyping(active);

		if (event.key === "/" && !typing && !dialogOpen()) {
			const field = options.searchField();
			if (field === null) return;
			// `preventDefault` so the `/` does not also land in the field the reader did not focus.
			event.preventDefault();
			field.focus();
			return;
		}

		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
			const field = options.searchField();
			if (field === null) return;
			event.preventDefault();
			field.focus();
			return;
		}

		if (event.key === "Escape" && options.railOpen()) {
			// **One layer per press.** A dialog is handled by the dialog itself; the drawer is the next
			// layer out, and this only acts when one is actually open.
			event.preventDefault();
			options.setRailOpen(false);
			// Focus goes back to the control that opened it, or a keyboard reader is left at the document
			// start with no idea what happened.
			options.railToggle()?.focus();
		}
	};

	window.addEventListener("keydown", onKey);
	return () => window.removeEventListener("keydown", onKey);
};

/** Install the layer for as long as a component is mounted. */
export const useKeyboardLayer = (options: KeyboardLayerOptions): void => {
	useEffect(() => installKeyboardLayer(options), [options]);
};
