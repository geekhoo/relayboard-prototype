import { expect, test } from "./helpers/fixtures";
import {
	expectNoOverflow,
	setViewport,
	type ViewportName,
	WIDTHS,
} from "./helpers/layout";

/**
 * The conversation, asserted at the route seam.
 *
 * 05:17 asks for every criterion in this ticket to be asserted here except the two send guards,
 * which belong to the contract seam because they are about the store's idempotency rather than about
 * what a reader sees. The split is deliberate and is stated in both files.
 *
 * ## What this file deliberately does not do
 *
 * It does not open a thread by posting to it and then reading back whatever order the data happened
 * to arrive in. Every assertion about order is made against the **seed's** thread whose timestamps
 * run against its positions (`retention`), because that thread is the one that fails if anything
 * sorts by `createdAt`. A test written against a well-behaved thread proves nothing about ordering.
 */
const THREAD_WITH_BACKWARDS_TIME = "retention";
const THREAD_WITH_A_RELATION = "delivery";

test.describe("reading a thread", () => {
	test("renders every entry in seq order, with author, kind, time and position", async ({
		page,
	}) => {
		await page.goto(
			`/boards/platform?view=threads&thread=${THREAD_WITH_BACKWARDS_TIME}`,
		);

		const entries = page.locator("[data-entry-seq]");
		await expect(entries.first()).toBeVisible();

		// The order, read from the DOM's own attributes rather than from the data: this is what a
		// reader's eye follows down the column.
		const seqs = await entries.evaluateAll((nodes) =>
			nodes.map((node) => Number(node.getAttribute("data-entry-seq"))),
		);
		expect(seqs.length).toBeGreaterThan(1);
		expect(seqs).toEqual([...seqs].sort((left, right) => left - right));

		// And specifically NOT timestamp order: this thread's instants run the other way, so a
		// timestamp sort would produce a descending seq list above and this comparison is what
		// catches it.
		const timestamps = await entries.evaluateAll((nodes) =>
			nodes.map(
				(node) => node.querySelector("time")?.getAttribute("datetime") ?? "",
			),
		);
		const byTimestamp = timestamps
			.map((stamp, index) => ({ stamp, seq: seqs[index] as number }))
			.sort((left, right) => left.stamp.localeCompare(right.stamp))
			.map(({ seq }) => seq);
		expect(seqs).not.toEqual(byTimestamp);

		// Every entry shows its byline: author, position, and a time.
		const first = entries.first();
		await expect(first.locator(".entry__author")).not.toBeEmpty();
		await expect(first.locator(".entry__seq")).toContainText("#");
		await expect(first.locator(".entry__time")).not.toBeEmpty();
	});

	test("marks agent-authored entries without ranking them", async ({
		page,
	}) => {
		await page.goto("/boards/platform?view=threads&thread=delivery");

		const agentTag = page.locator(".entry__kind").first();
		await expect(agentTag).toHaveText(/agent/i);
		// The marking carries no accent — it is a label, not a rank (AGENTS.md). Compared against the
		// accent token itself rather than against another element: the first version of this compared
		// against the Send button, which is DISABLED while the composer is empty and therefore painted
		// with the surface tint, so the comparison proved nothing.
		const accentChip = await page.evaluate(() =>
			getComputedStyle(document.documentElement)
				.getPropertyValue("--color-accent-chip-bg")
				.trim(),
		);
		const style = await agentTag.evaluate((element) => {
			const computed = getComputedStyle(element);
			return { background: computed.backgroundColor, color: computed.color };
		});
		expect(accentChip).not.toBe("");
		const accentAsRgb = await page.evaluate((value) => {
			const probe = document.createElement("span");
			probe.style.backgroundColor = value;
			document.body.append(probe);
			const resolved = getComputedStyle(probe).backgroundColor;
			probe.remove();
			return resolved;
		}, accentChip);
		expect(style.background).not.toBe(accentAsRgb);
	});

	test("opens with an intro naming the creator, the date and how many entries", async ({
		page,
	}) => {
		await page.goto("/boards/platform?view=threads&thread=delivery");

		const intro = page.locator(".conversation__intro");
		await expect(intro).toContainText("Started by");
		// The creator's name, not their id: the roster resolved it.
		await expect(intro).toContainText("Maya Chen");
		await expect(intro).toContainText(/\d{4}/);
	});

	test("separates days with a divider", async ({ page }) => {
		await page.goto("/boards/platform?view=threads&thread=delivery");
		await expect(page.locator("[data-entry-seq]").first()).toBeVisible();

		// The seed's entries span more than one day in most time zones; what must hold regardless is
		// that a divider appears wherever the day key changes and nowhere else.
		const dividers = await page.locator(".conversation__day").count();
		const dayKeys = await page
			.locator("[data-entry-seq]")
			.evaluateAll((nodes) =>
				nodes.map((node) => {
					const stamp =
						node.querySelector("time")?.getAttribute("datetime") ?? "";
					const date = new Date(stamp);
					return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
				}),
			);
		const expected = dayKeys.filter(
			(key, index) => key !== dayKeys[index - 1],
		).length;
		expect(dividers).toBe(expected);
	});

	test("a referencing entry's link moves the reader to the entry it responds to", async ({
		page,
	}) => {
		// **This test used to assert the href's shape, and that is what let a real defect through:**
		// the anchor pointed at `#entry-<id>` while entries carried only `data-entry-id`, so the link
		// moved nobody anywhere and the shape assertion passed. What is asserted now is the thing that
		// was broken — where the reader ends up.
		await page.goto(
			`/boards/platform?view=threads&thread=${THREAD_WITH_A_RELATION}`,
		);

		const relation = page.locator(".entry__relation a").first();
		await expect(relation).toBeVisible();
		const target =
			(await relation.getAttribute("href"))?.replace(/^#/, "") ?? "";
		expect(target).not.toBe("");

		// The target exists at all — the half that was missing.
		await expect(page.locator(`#${target}`)).toHaveCount(1);

		await relation.click();

		// And after the click the target is inside the conversation's visible box. Measured rather
		// than asserted from a scroll position: the anchor may be above or below the reader, and the
		// browser's native jump is what closes the distance.
		const placement = await page.evaluate((id) => {
			const element = document.querySelector(`#${id}`);
			const column = document.querySelector(".workspace-frame__conversation");
			if (!element || !column) return null;
			const targetRect = element.getBoundingClientRect();
			const box = column.getBoundingClientRect();
			return {
				targetTop: targetRect.top,
				targetBottom: targetRect.bottom,
				boxTop: box.top,
				boxBottom: box.bottom,
				visible:
					targetRect.bottom > box.top &&
					targetRect.top < box.bottom &&
					targetRect.height > 0,
			};
		}, target);

		expect(placement).not.toBeNull();
		expect(
			placement?.visible,
			`after following the relation the target entry is at ${placement?.targetTop}-${placement?.targetBottom} and the conversation spans ${placement?.boxTop}-${placement?.boxBottom}, so it is not in view: the anchor does not land.`,
		).toBe(true);
	});

	test("shows the thread's details, and closes from the keyboard", async ({
		page,
	}) => {
		await page.goto("/boards/platform?view=threads&thread=delivery");

		const details = page.locator(".conversation__details");
		const summary = details.locator("summary");
		await expect(details.locator(".conversation__facts")).toBeHidden();

		// Reachable and openable from the keyboard: a native disclosure is focusable and announces its
		// expanded state, which is why this is a <details> rather than a div with a click handler.
		await summary.focus();
		await expect(summary).toBeFocused();
		await page.keyboard.press("Enter");
		await expect(details.locator(".conversation__facts")).toBeVisible();

		// The four facts the criterion names.
		const facts = details.locator(".conversation__facts");
		await expect(facts).toContainText("Created");
		await expect(facts).toContainText("Entries");
		await expect(facts).toContainText("Last position");
		await expect(facts).toContainText("Participants");

		// And it closes again from the keyboard, which is what "dismissable from the keyboard" means.
		await page.keyboard.press("Enter");
		await expect(details.locator(".conversation__facts")).toBeHidden();
	});

	test("filters this thread's entries by term and distinguishes no match from empty", async ({
		page,
	}) => {
		await page.goto("/boards/platform?view=threads&thread=delivery");
		const all = await page.locator("[data-entry-seq]").count();
		expect(all).toBeGreaterThan(1);

		const search = page.getByPlaceholder("Search this thread");
		await search.fill("outbox");
		const narrowed = await page.locator("[data-entry-seq]").count();
		expect(narrowed).toBeGreaterThan(0);
		expect(narrowed).toBeLessThan(all);
		await expect(page.locator(".entry__text").first()).toContainText(/outbox/i);

		// No match: a different sentence from an empty thread's.
		await search.fill("zzzzzzzz");
		await expect(page.locator(".conversation__empty-title")).toHaveText(
			"No matching messages",
		);
		await expect(page.locator(".conversation__empty-detail")).toContainText(
			"Try a different search term",
		);

		// Clearing restores every entry.
		await search.fill("");
		expect(await page.locator("[data-entry-seq]").count()).toBe(all);
	});
});

test.describe("posting", () => {
	test("commits a message at its position and shows the sequence it landed on", async ({
		page,
	}) => {
		await page.goto("/boards/platform?view=threads&thread=delivery");
		const before = await page
			.locator("[data-entry-seq]")
			.last()
			.getAttribute("data-entry-seq");
		const lastBefore = Number(before ?? 0);

		const draft = page.getByLabel("Write a message");
		await draft.fill("A message from the route seam.");
		await page.getByRole("button", { name: "Send" }).click();

		// Exactly once: a composer that appended twice would show two entries with the same text.
		const mine = page.locator(".entry__text", {
			hasText: "A message from the route seam.",
		});
		await expect(mine).toHaveCount(1);

		// At its correct position, with the position visible: the new entry is the last one and its
		// rendered seq is the previous last plus one.
		const lastEntry = page.locator("[data-entry-seq]").last();
		await expect(lastEntry.locator(".entry__text")).toHaveText(
			"A message from the route seam.",
		);
		expect(Number(await lastEntry.getAttribute("data-entry-seq"))).toBe(
			lastBefore + 1,
		);
		await expect(lastEntry.locator(".entry__seq")).toHaveText(
			`#${lastBefore + 1}`,
		);

		// The composer cleared on success.
		await expect(draft).toHaveValue("");
	});

	test("sends on Ctrl+Enter, and refuses an empty draft with a reason", async ({
		page,
	}) => {
		await page.goto("/boards/platform?view=threads&thread=delivery");

		const draft = page.getByLabel("Write a message");
		const send = page.getByRole("button", { name: "Send" });
		await expect(send).toBeDisabled();
		// The reason is stated, not implied by a grey button.
		await expect(page.locator(".conversation__reason")).toHaveText(
			/A message needs some text/,
		);

		// Whitespace only is still empty.
		await draft.fill("   \n  ");
		await expect(send).toBeDisabled();
		await expect(page.locator(".conversation__reason")).toHaveText(
			/A message needs some text/,
		);

		await draft.fill("Sent from the keyboard.");
		await expect(send).toBeEnabled();
		await draft.press("Control+Enter");

		await expect(
			page.locator(".entry__text", { hasText: "Sent from the keyboard." }),
		).toHaveCount(1);
	});

	test("trims surrounding whitespace before committing", async ({ page }) => {
		await page.goto("/boards/platform?view=threads&thread=delivery");

		await page.getByLabel("Write a message").fill("   trimmed by the seam   ");
		await page.getByRole("button", { name: "Send" }).click();

		const posted = page
			.locator("[data-entry-seq]")
			.last()
			.locator(".entry__text");
		await expect(posted).toHaveText("trimmed by the seam");
	});

	/**
	 * **The failed-send path is not asserted here, and the reason is a limitation rather than an
	 * oversight.**
	 *
	 * 05's criterion is "a failed send leaves the draft in place with the reason rather than
	 * clearing it". Reproducing it needs a send that fails, and with the in-memory transport no input
	 * the composer can produce makes the client fail: it trims the draft itself, so the store's
	 * "Message cannot be empty" is unreachable from the UI, and it only ever posts to the thread it
	 * opened, so "Thread not found" is unreachable too. Every remaining failure mode is a permission
	 * refusal, and 07a is what builds those.
	 *
	 * What IS asserted is the half that can be: the reason is a live region with the right shape, and
	 * the draft is not cleared by a disabled button (below). The store's refusals are asserted at the
	 * contract seam, where they are reachable, and the component's handling of one becomes assertable
	 * in the browser the moment 07a gives the composer a failure it can provoke.
	 */
	test("states the reason as a live region rather than a disabled button", async ({
		page,
	}) => {
		await page.goto("/boards/platform?view=threads&thread=delivery");

		const reason = page.locator(".conversation__reason");
		// An <output> element: it is announced when it changes, which is what a reason for a refused
		// action needs to be. A paragraph with role="status" would work too; the element is used
		// because it carries the behaviour without a simulated role.
		expect(
			await reason.evaluate((element) => element.tagName.toLowerCase()),
		).toBe("output");
		await expect(reason).toHaveText(/A message needs some text/);

		// Typing a draft removes the reason and enables the control, in one step.
		await page.getByLabel("Write a message").fill("now there is a draft");
		await expect(reason).toHaveText("");
		await expect(page.getByRole("button", { name: "Send" })).toBeEnabled();
	});
});

test.describe("the composer's geometry", () => {
	test("stays at the bottom of the conversation at every width", async ({
		page,
	}) => {
		await page.goto("/boards/platform?view=threads&thread=delivery");

		for (const name of Object.keys(WIDTHS) as ViewportName[]) {
			await setViewport(page, name);
			const geometry = await page.evaluate(() => {
				const column = document.querySelector(".workspace-frame__conversation");
				const composer = document.querySelector(".conversation__composer");
				if (!column || !composer) throw new Error("missing");
				const columnRect = column.getBoundingClientRect();
				const composerRect = composer.getBoundingClientRect();
				return {
					columnBottom: columnRect.bottom,
					composerBottom: composerRect.bottom,
					composerHeight: composerRect.height,
					columnHeight: columnRect.height,
				};
			});
			// Pinned to the bottom: the composer's bottom edge is the column's, within a pixel.
			expect(
				Math.abs(geometry.columnBottom - geometry.composerBottom),
				`${name} (${WIDTHS[name].width}px): the composer's bottom is ${geometry.composerBottom} and the column's is ${geometry.columnBottom}, so it is not pinned.`,
			).toBeLessThanOrEqual(1);
			// And it does not eat the column: a composer taller than its column would pin and overflow.
			expect(geometry.composerHeight).toBeLessThan(geometry.columnHeight);

			await expectNoOverflow(
				page.locator(".workspace-frame__conversation"),
				`the conversation at ${name}`,
			);
		}
	});
});
