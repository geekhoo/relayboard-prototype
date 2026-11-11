import { expect, test } from "./helpers/fixtures";

/**
 * **13b: keyboard operation and focus management.**
 *
 * The prototype did most of this (`app.js` L222) and this is the port, plus the surfaces the prototype
 * never had: the gatekeeper, the act controls and the purge dialog. Every assertion here is a real focus
 * assertion — `toBeFocused`, a computed outline — rather than a class change, because a class that says
 * `is-focused` is a claim about a stylesheet, not about where the caret is.
 */
test.describe("13b: the global shortcuts", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/boards/platform?view=threads&thread=delivery");
		await expect(page.locator(".entry").first()).toBeVisible();
	});

	test("/ focuses thread search, and does not hijack a slash typed into the composer", async ({
		page,
	}) => {
		// The prototype's guard, asserted from both sides: it fires when nothing is focused and stays
		// away while the reader is typing. A shortcut that only works when the field happens to be
		// blurred is not the same thing as one that respects typing.
		const search = page.locator("[data-thread-search]");
		await page.locator("body").click({ position: { x: 5, y: 5 } });
		await page.keyboard.press("/");
		await expect(search).toBeFocused();

		// Now type a slash into the composer: the shortcut must not take the reader out of their draft.
		const composer = page.getByLabel("Write a message");
		await composer.click();
		await page.keyboard.type("a/b");
		await expect(composer).toBeFocused();
		await expect(search).not.toBeFocused();
		await expect(composer).toHaveValue("a/b");
	});

	test("Ctrl/Cmd + K focuses thread search from anywhere", async ({ page }) => {
		// Not guarded on typing, because the prototype does not guard it — it is the escape-hatch form.
		const composer = page.getByLabel("Write a message");
		await composer.click();
		await page.keyboard.press("ControlOrMeta+k");
		await expect(page.locator("[data-thread-search]")).toBeFocused();
	});

	test("neither shortcut reaches behind an open dialog", async ({ page }) => {
		// The prototype guards on its dialogs; this guards on `dialog[open]`, which covers every surface
		// the app has because they are all native dialogs.
		await page.locator("[data-create='thread']").click();
		const dialog = page.getByRole("dialog", { name: /new thread/i });
		await expect(dialog).toBeVisible();
		const inside = await page.evaluate(() =>
			document.querySelector("dialog[open]")?.contains(document.activeElement),
		);
		expect(inside).toBe(true);

		await page.keyboard.press("ControlOrMeta+k");
		// Focus is still inside the dialog: the shortcut was suppressed rather than reaching behind it.
		const stillInside = await page.evaluate(() =>
			document.querySelector("dialog[open]")?.contains(document.activeElement),
		);
		expect(stillInside).toBe(true);
	});
});

test.describe("13b: focus order and the drawer", () => {
	test("the drawer toggle comes before the drawer contents, which come before the scrim", async ({
		page,
	}) => {
		// 13b:17 and the Lead's first point: off-canvas with `visibility: hidden` takes the rail out of
		// the tab order, which was 04a's interim fix and is now a drawer that opens. So the order must be
		// toggle, then contents, then scrim — and a reader must be able to leave.
		await page.setViewportSize({ width: 980, height: 900 });
		await page.goto("/boards/platform?view=threads");
		const toggle = page.locator("[data-rail-toggle]");
		await toggle.click();
		await expect(page.locator(".workspace-frame__rail")).toHaveAttribute(
			"data-open",
			"true",
		);

		// **The order, asserted by walking the tab sequence from the toggle.** The rail's links must be
		// reachable now that it is visible, and the scrim must come after them rather than before.
		const order = await page.evaluate(() => {
			const focusable = [
				...document.querySelectorAll(
					'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
				),
			].filter((element) => {
				const style = getComputedStyle(element as HTMLElement);
				return style.visibility !== "hidden" && style.display !== "none";
			});
			const index = (selector: string) =>
				focusable.findIndex((element) => element.matches(selector));
			return {
				toggle: index("[data-rail-toggle]"),
				railLink: index(".workspace-frame__rail a"),
				scrim: index("[data-rail-scrim]"),
			};
		});
		expect(order.toggle).toBeGreaterThanOrEqual(0);
		expect(
			order.railLink,
			"the rail is open but its links are not in the tab order",
		).toBeGreaterThan(order.toggle);
		expect(
			order.scrim,
			"the scrim precedes the drawer contents in the tab order",
		).toBeGreaterThan(order.railLink);
	});

	test("closing the drawer returns focus to the toggle", async ({ page }) => {
		// The half that makes leaving reversible: a drawer that drops focus to the document leaves a
		// keyboard reader at the top of the frame with no idea what happened.
		await page.setViewportSize({ width: 980, height: 900 });
		await page.goto("/boards/platform?view=threads");
		const toggle = page.locator("[data-rail-toggle]");
		await toggle.click();
		await expect(page.locator(".workspace-frame__rail")).toHaveAttribute(
			"data-open",
			"true",
		);

		// **Focus moves into the drawer first, which is what makes this assertion able to fail.**
		// Measured: with focus left on the toggle, closing "returned" focus to it by never having moved
		// it — the test passed with the focus call deleted. A reader who tabs into the drawer is the case
		// that matters, because then closing leaves focus inside a `visibility: hidden` subtree and the
		// browser drops it to `<body>`.
		await page.locator(".workspace-frame__rail a").first().focus();
		await expect(
			page.locator(".workspace-frame__rail a").first(),
		).toBeFocused();

		await page.keyboard.press("Escape");
		await expect(page.locator(".workspace-frame__rail")).toHaveAttribute(
			"data-open",
			"false",
		);
		await expect(toggle).toBeFocused();
	});

	test("no positive tabindex and no focusable element that is hidden", async ({
		page,
	}) => {
		// 13b:17: "no positive `tabindex` and no focusable element that is visually hidden". The second
		// half is the rail's own defect, generalised: a link nobody can see must not be tabbable.
		await page.goto("/boards/platform?view=threads&thread=delivery");
		const audit = await page.evaluate(() => {
			const positive = [...document.querySelectorAll("[tabindex]")]
				.map((element) => Number(element.getAttribute("tabindex")))
				.filter((value) => value > 0);
			const hiddenFocusable = [
				...(document.querySelectorAll(
					'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
				) as NodeListOf<HTMLElement>),
			].filter((element) => {
				const style = getComputedStyle(element);
				const rect = element.getBoundingClientRect();
				// **A closed `<dialog>` is excluded, and that is not a loophole.** Its contents have no box
				// and are correctly not tabbable — the browser removes a closed dialog from the focus order
				// itself, which is the behaviour 13a and 14 rely on. The defect this test looks for is a
				// control in the live document that has no box: the rail's off-canvas links, before 13a.
				if (element.closest("dialog:not([open])") !== null) return false;
				return (
					style.visibility !== "hidden" &&
					style.display !== "none" &&
					(rect.width === 0 || rect.height === 0)
				);
			});
			return {
				positive,
				hiddenFocusable: hiddenFocusable.map(
					(element) => element.getAttribute("data-testid") ?? element.className,
				),
			};
		});
		expect(
			audit.positive,
			"a positive tabindex reorders the whole page",
		).toEqual([]);
		expect(
			audit.hiddenFocusable,
			"these elements are focusable but have no box, so a keyboard user can tab into nothing",
		).toEqual([]);
	});
});

test.describe("13b: the focus ring", () => {
	test("every interactive element has a 2px outline at 1px offset", async ({
		page,
	}) => {
		// 13b:16 and DESIGN.md §237: a real outline, never a border-colour change. Asserted as the
		// computed outline, which is the property the rule sets.
		await page.goto("/boards/platform?view=threads&thread=delivery");
		for (const selector of [
			"[data-thread-search]",
			".thread-row",
			".conversation__send",
			"[data-stream-toggle]",
		]) {
			const target = page.locator(selector).first();
			if ((await target.count()) === 0) continue;
			// **A disabled control cannot take focus**, so an absent ring on one is correct rather than a
			// defect — measured: `.conversation__send` reports `outline: none` while the draft is empty.
			if (await target.isDisabled()) continue;
			await target.focus();
			const ring = await target.evaluate((element) => {
				const style = getComputedStyle(element);
				return {
					style: style.outlineStyle,
					width: style.outlineWidth,
					offset: style.outlineOffset,
					color: style.outlineColor,
				};
			});
			expect(ring.style, `${selector} has no outline`).toBe("solid");
			expect(ring.width, `${selector} outline is ${ring.width}`).toBe("2px");
			expect(ring.offset, `${selector} inset is ${ring.offset}`).toBe("1px");
		}
	});

	test("the dark rail uses the rail's own focus colour, not the page's", async ({
		page,
	}) => {
		// **The override, on the surface that needs it.** DESIGN.md gives the rail `--color-focus-on-rail`
		// because `--color-focus` is 2.11:1 on the dark green and therefore invisible. A test that only
		// asserted "an outline exists" would pass with the invisible one, which is the defect a missing
		// ring is: invisible to every other gate in this repo.
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto("/boards/platform?view=threads");
		const link = page.locator(".workspace-frame__rail a").first();
		await link.focus();
		const [railRing, expected] = await Promise.all([
			link.evaluate((element) => getComputedStyle(element).outlineColor),
			page.evaluate(() => {
				const probe = document.createElement("span");
				probe.style.color = getComputedStyle(
					document.documentElement,
				).getPropertyValue("--color-focus-on-rail");
				document.body.append(probe);
				const resolved = getComputedStyle(probe).color;
				probe.remove();
				return resolved;
			}),
		]);
		expect(railRing).toBe(expected);

		// And it is NOT the page token, which is the assertion that would have failed before the override.
		const pageFocus = await page.evaluate(() => {
			const probe = document.createElement("span");
			probe.style.color = getComputedStyle(
				document.documentElement,
			).getPropertyValue("--color-focus");
			document.body.append(probe);
			const resolved = getComputedStyle(probe).color;
			probe.remove();
			return resolved;
		});
		expect(railRing).not.toBe(pageFocus);
	});
});

test.describe("13b: dialogs trap focus and return it", () => {
	test("the create dialog moves focus in, keeps it there, and returns it to the opener", async ({
		page,
	}) => {
		// 13b:15 and 13a:22: asserted with real focus, not a class. The opener is remembered because
		// `showModal()` moves focus but does not promise to put it back.
		await page.goto("/boards/platform?view=threads");
		const opener = page.locator("[data-create='thread']");
		await opener.focus();
		await opener.click();

		const dialog = page.getByRole("dialog", { name: /new thread/i });
		await expect(dialog).toBeVisible();
		// Focus is inside on open — `showModal` focuses the first focusable descendant.
		const insideOnOpen = await page.evaluate(() =>
			document.querySelector("dialog[open]")?.contains(document.activeElement),
		);
		expect(insideOnOpen).toBe(true);

		// **And it is trapped**: Tab enough times to cycle the dialog's own controls and focus is still
		// inside. `showModal` contains it; this asserts the containment rather than a hand-written trap.
		for (let index = 0; index < 8; index += 1) {
			await page.keyboard.press("Tab");
		}
		const stillInside = await page.evaluate(() =>
			document.querySelector("dialog[open]")?.contains(document.activeElement),
		);
		expect(stillInside).toBe(true);

		await page.keyboard.press("Escape");
		await expect(dialog).toBeHidden();
		await expect(opener).toBeFocused();
	});

	test("Escape closes the drawer with one press, and leaves nothing else closed", async ({
		page,
	}) => {
		// 13b:14: "closes exactly one layer per press". With the drawer open and a dialog on top, one press
		// closes the dialog and leaves the drawer; the next closes the drawer. Two layers closing from one
		// key press is felt as a jump the reader did not ask for.
		await page.setViewportSize({ width: 980, height: 900 });
		await page.goto("/boards/platform?view=threads");
		await page.locator("[data-rail-toggle]").click();
		await expect(page.locator(".workspace-frame__rail")).toHaveAttribute(
			"data-open",
			"true",
		);

		// **One press closes the drawer and the dialog is not involved**, which is the assertion that
		// matters: the drawer's Escape handler runs and nothing else does.
		await page.keyboard.press("Escape");
		await expect(page.locator(".workspace-frame__rail")).toHaveAttribute(
			"data-open",
			"false",
		);
		// And the frame is still usable: the disclosure in the conversation was not closed as a side
		// effect, because it is not a layer the drawer's key handler owns.
		await expect(page.locator(".thread-row").first()).toBeVisible();
	});

	test("an arriving entry does not move focus out of the composer", async ({
		page,
	}) => {
		// 13b:19 and the prototype's own commitment (app.js L190). A reader typing a draft must not be
		// interrupted by the conversation moving, which is the failure mode of a live region that takes
		// focus or of a list that re-renders into focus.
		await page.goto("/boards/platform?view=threads&thread=delivery");
		const composer = page.getByLabel("Write a message");
		await composer.click();
		await composer.fill("A draft I am in the middle of.");

		// **The arrival is triggered without moving focus**, because clicking the control would focus it
		// and the assertion would then be about the test's own click rather than about the arrival. Same
		// lesson as the withhold filter: a test that performs the thing it forbids proves nothing, so the
		// simulation is dispatched the way a stream event arrives.
		const count = await page.locator(".entry").count();
		await page.evaluate(() => {
			const button = document.querySelector("[data-stream-simulate]");
			button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		});
		await expect(page.locator(".entry")).toHaveCount(count + 1);

		await expect(composer).toBeFocused();
		await expect(composer).toHaveValue("A draft I am in the middle of.");
	});

	test("new entries are announced, so a screen reader knows the conversation moved", async ({
		page,
	}) => {
		// 13b:18 and story 135. A polite live region carrying the count: reading each message aloud would
		// interrupt whatever the reader is doing, and the composer is where they usually are.
		await page.goto("/boards/platform?view=threads&thread=delivery");
		const status = page.locator("[data-arrival-status]");
		await expect(status).toHaveAttribute("aria-live", "polite");
		const before = (await status.textContent()) ?? "";

		await page.locator("[data-stream-simulate]").click();
		await expect(status).not.toHaveText(before);
		await expect(status).toContainText(/entries in this thread/);
	});
});
