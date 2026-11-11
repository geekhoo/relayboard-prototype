import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Two participants, one workspace.
 *
 * ## Why a cookie and not a second server
 *
 * Spec L368 makes the first request name a principal from the seed's browser-selectable set, L372
 * makes the selection cyclic and stable within one store instance, and 06b put that behind an
 * `HttpOnly` cookie. Two browser contexts therefore get two principals **from one server**, which is
 * exactly the claim under test: one workspace two participants share, not two workspaces that happen
 * to hold the same seed.
 *
 * ## Why the identities are asked for and not assumed
 *
 * The rotation is cyclic, so a test that assumed "the first context is alex" would break the moment
 * anything else on the same server took a session first — including an earlier test in the same
 * worker. `whoAmI` reads the answer from the app's own session note, which 06b made the server's
 * answer rather than a guess. A test that hard-coded either id would be asserting the rotation's
 * phase, which is not what "two participants" means.
 *
 * ## Why entries are read from the DOM
 *
 * Every assertion below reads what a participant can see. Reaching into the client for a data
 * structure would test the client rather than the claim, and it would need an internal exposed on
 * `window` purely for the test — the shape 06c's own criterion is careful to avoid.
 */

/** The principal a page is acting as, read from the rendered session note. */
export const whoAmI = async (page: Page): Promise<string> => {
	const note = page.locator(".session-note__principal");
	await expect(note).not.toBeEmpty();
	const name = (await note.textContent())?.trim() ?? "";
	expect(name, "the session note did not name a principal").not.toBe("");
	return name;
};

/** The entries rendered in the conversation, in the order a reader sees them. */
export const renderedEntries = async (
	page: Page,
): Promise<readonly { seq: number; text: string }[]> =>
	await page.locator("[data-entry-seq]").evaluateAll((nodes) =>
		nodes.map((node) => ({
			seq: Number(node.getAttribute("data-entry-seq")),
			text: node.querySelector(".entry__text")?.textContent?.trim() ?? "",
		})),
	);

/**
 * Post a message in whichever context is passed, and wait for it to appear.
 *
 * Awaited on the rendered entry rather than on a promise, because a transport that returned before
 * committing would pass a promise-based wait and fail the reader's.
 */
export const postAs = async (page: Page, text: string): Promise<void> => {
	const draft = page.getByLabel("Write a message");
	await draft.fill(text);
	await page.getByRole("button", { name: "Send" }).click();
	await expect(page.locator(".entry__text", { hasText: text })).toHaveCount(1);
};
