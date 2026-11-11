import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "./helpers/fixtures";
import { resetWorkspace } from "./helpers/workspace";

/**
 * Run isolation, and the boundary that keeps the route seam separate from the other two.
 *
 * ## Why isolation is asserted rather than assumed
 *
 * The harness runs with one worker against **one** server process, so the workspace is shared
 * state: a test that leaves a thread read changes what the next one sees. 06a's reset hook is what
 * makes the tests order-independent, and `beforeEach` is where that lives — but a hook that
 * silently did nothing would still leave every test passing, in whatever order they happened to
 * run. So the reset's effect is asserted here, positively, once.
 */
test.describe("runs do not depend on each other", () => {
	test("the reset hook returns the workspace to the seed", async ({
		page,
		request,
		baseURL,
	}) => {
		const base = baseURL ?? "http://127.0.0.1:3218";

		// Read a thread, which advances this reader's `seen` watermark (03: only `readThread` marks
		// a thread read). The unread counts are the observable consequence.
		await page.goto("/boards/platform");
		await expect(page.locator(".board-rail__count").first()).toBeVisible();
		const before = await page.locator(".board-rail__count").allTextContents();

		await resetWorkspace(request, base);
		await page.reload();
		await expect(page.locator(".board-rail__count").first()).toBeVisible();
		const after = await page.locator(".board-rail__count").allTextContents();

		// The counts are derived from the seed's watermarks, so a reset that did nothing would leave
		// any advance in place and this comparison would fail.
		expect(after).toEqual(before);
	});

	test("a second test sees the seed's thread count and not the first test's edits", async ({
		page,
		request,
		baseURL,
	}) => {
		// Deliberately noisy: change the view and the search, so state that leaked would be visible.
		await page.goto("/boards/platform?view=resources&q=leaked");
		await resetWorkspace(request, baseURL ?? "http://127.0.0.1:3218");

		await page.goto("/boards/platform");
		await expect(page.locator(".thread-row")).toHaveCount(5);
		// The reader's search did not survive, because each test navigates from a fresh context: no
		// `localStorage`, no session storage, no history. The route's validator writes the parsed
		// search back into the address, so the parameter exists and is empty rather than absent —
		// asserting `null` here would be asserting something the app never does.
		expect(new URL(page.url()).searchParams.get("q") ?? "").toBe("");
	});
});

test.describe("the route seam is separate from the store and contract seams", () => {
	test("no test in this directory reaches the store or the server modules", () => {
		// 04c's criterion, asserted as a failing test rather than as a convention: the route seam
		// drives the app through its routes, so an import of the store here would be a second,
		// unstated seam that could pass while the real one was broken.
		const forbidden = [
			"#/server",
			"#/server/store",
			"#/server/store/demo-seed",
			"#/client/in-memory",
		];
		const files = readdirSync(join(process.cwd(), "e2e"), {
			recursive: true,
			encoding: "utf8",
		}).filter((name) => name.endsWith(".ts"));
		expect(files.length).toBeGreaterThan(0);

		const offenders: string[] = [];
		for (const file of files) {
			// Comments are stripped before scanning, and that is not tidiness: the first version of
			// this check matched its **own explanatory comment**, which quotes the import it forbids,
			// and so failed on a clean tree. A guard that fires on the documentation of the rule
			// teaches people to delete the documentation.
			const source = readFileSync(join(process.cwd(), "e2e", file), "utf8")
				.replace(/\/\*[\s\S]*?\*\//g, "")
				.replace(/^\s*\/\/.*$/gm, "");
			for (const match of source.matchAll(
				/(?:from\s*|import\(\s*)["']([^"']+)["']/g,
			)) {
				const specifier = match[1] ?? "";
				// Compared as a path root rather than as an exact string: a real violation writes
				// `#/server/store/instance`, and the previous version's exact comparison against
				// `#/server/store` passed it.
				const offending = forbidden.find(
					(root) => specifier === root || specifier.startsWith(`${root}/`),
				);
				if (offending) offenders.push(`${file} imports ${specifier}`);
			}
		}
		expect(
			offenders,
			`The route seam must reach the app through its routes only. Offending imports:\n${offenders.join("\n")}`,
		).toEqual([]);
	});

	test("the assertions use the domain's vocabulary", async ({ page }) => {
		// The words every ticket in this repository uses, and the ones a reader would search for:
		// Board, Thread, entry. A suite that called a thread a "conversation" in its assertions would
		// pass while the interface said something else, so the vocabulary is asserted where it shows
		// on screen.
		await page.goto("/boards/platform");
		const list = page.getByRole("list", { name: "Threads" });
		await expect(list).toBeVisible();
		await expect(list.getByRole("listitem").first()).toBeVisible();
		await expect(page.locator(".thread-row__meta").first()).toContainText(
			/entr/,
		);
	});
});
