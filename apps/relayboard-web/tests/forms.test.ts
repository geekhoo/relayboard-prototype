import { describe, expect, it } from "vitest";
import {
	addResourceForm,
	BOARD_NAME_MAX,
	createBoardForm,
	createThreadForm,
	DESCRIPTION_MAX,
	firstProblem,
	httpUrl,
	RESOURCE_DESCRIPTION_MAX,
	RESOURCE_NAME_MAX,
	RESOURCE_TYPES,
	THREAD_TITLE_MAX,
} from "#/domain/forms";

/**
 * The create dialogs' rules, asserted where they are enforced.
 *
 * ## Why these live in `src/domain` rather than in the component
 *
 * The prototype validates in the browser (`app.js` L172); this app has a server, so the same rules are
 * stated once where a request cannot skip them and the browser reuses them for a reader's sake. A rule
 * written twice is a rule that drifts, and the drift is invisible until somebody posts a 300-character
 * title.
 */
describe("the resource type set", () => {
	it("is the closed four, in the prototype's order", () => {
		// `Document`, `Repository` and `Design` are the seed's (app.js L30-32); `Link` is the
		// prototype's own default on `addResource` (app.js L117).
		expect([...RESOURCE_TYPES]).toEqual([
			"Document",
			"Repository",
			"Design",
			"Link",
		]);
	});

	it("is refused for anything else at the boundary", () => {
		// A free-text type would be a field nothing can filter on later, which is what the criterion
		// forbids — so an invented one is a validation failure rather than a stored string.
		const parsed = addResourceForm.safeParse({
			boardId: "platform",
			name: "Notes",
			url: "https://example.com/notes",
			type: "Spreadsheet",
			description: "",
		});
		expect(parsed.success).toBe(false);
	});

	it("defaults to Link for a resource added without a type, the prototype's own default", () => {
		const parsed = addResourceForm.safeParse({
			boardId: "platform",
			name: "Notes",
			url: "https://example.com/notes",
			description: "",
		});
		expect(parsed.success).toBe(true);
		if (!parsed.success) return;
		expect(parsed.data.type).toBe("Link");
	});
});

describe("the URL rule", () => {
	it("accepts http and https, and trims", () => {
		expect(httpUrl.safeParse("https://example.com/x").success).toBe(true);
		expect(httpUrl.safeParse("http://example.com").success).toBe(true);
		expect(httpUrl.parse("  https://example.com/x  ")).toBe(
			"https://example.com/x",
		);
	});

	it("refuses every scheme that would execute in the page that follows it", () => {
		// Not tidiness: `javascript:` and `data:` URIs run in the document that opens them, so a stored
		// one would be a script a reader is invited to click. Refused **before the store is touched**.
		for (const hostile of [
			"javascript:alert(1)",
			"data:text/html,<script>alert(1)</script>",
			"vbscript:msgbox(1)",
			"file:///etc/passwd",
		]) {
			expect(
				httpUrl.safeParse(hostile).success,
				`${hostile} must be refused`,
			).toBe(false);
		}
	});

	it("refuses an unparseable string with the same sentence, because the reader's action is the same", () => {
		const parsed = httpUrl.safeParse("not a url");
		expect(parsed.success).toBe(false);
		if (parsed.success) return;
		expect(parsed.error.issues[0]?.message).toBe("Use an HTTP or HTTPS URL");
	});

	it("names the problem in words a reader can act on", () => {
		// A dialog showing Zod's own message would be telling the reader about a schema rather than
		// about their input.
		const parsed = addResourceForm.safeParse({
			boardId: "platform",
			name: "Notes",
			url: "ftp://example.com/x",
			type: "Link",
			description: "",
		});
		expect(parsed.success).toBe(false);
		if (parsed.success) return;
		expect(firstProblem(parsed.error)).toBe("Use an HTTP or HTTPS URL");
	});
});

describe("the length limits", () => {
	it("are the prototype's numbers", () => {
		// Transcribed from app.js L165-171, and asserted so a later tidying cannot quietly change what
		// the dialogs accept.
		expect(THREAD_TITLE_MAX).toBe(100);
		expect(BOARD_NAME_MAX).toBe(65);
		expect(RESOURCE_NAME_MAX).toBe(90);
		expect(DESCRIPTION_MAX).toBe(240);
		expect(RESOURCE_DESCRIPTION_MAX).toBe(160);
	});

	it("refuse one character past the limit, and say so in a sentence", () => {
		const long = createBoardForm.safeParse({
			name: "x".repeat(BOARD_NAME_MAX + 1),
		});
		expect(long.success).toBe(false);
		if (long.success) return;
		expect(firstProblem(long.error)).toContain(String(BOARD_NAME_MAX));
		expect(firstProblem(long.error)).not.toMatch(/String must contain/);
	});

	it("accept one character at the limit", () => {
		expect(
			createBoardForm.safeParse({ name: "x".repeat(BOARD_NAME_MAX) }).success,
		).toBe(true);
	});
});

describe("required fields", () => {
	it("refuse an empty or whitespace-only name, per dialog", () => {
		expect(createBoardForm.safeParse({ name: "" }).success).toBe(false);
		expect(createBoardForm.safeParse({ name: "   " }).success).toBe(false);
		expect(
			createThreadForm.safeParse({ boardId: "b", title: "  " }).success,
		).toBe(false);
		expect(
			addResourceForm.safeParse({
				boardId: "b",
				name: " ",
				url: "https://example.com",
				type: "Link",
				description: "",
			}).success,
		).toBe(false);
	});

	it("trim the name rather than storing the typing around it", () => {
		expect(createBoardForm.parse({ name: "  Customer portal  " }).name).toBe(
			"Customer portal",
		);
	});
});
