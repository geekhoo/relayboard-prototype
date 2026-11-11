import { z } from "zod";

/**
 * The create dialogs' inputs, validated at the boundary.
 *
 * ## Where this departs from the prototype, and why
 *
 * `app.js` L165-175 validates these **in the browser**: a maxlength on the input, a `type="url"`
 * hint, and a hand-written check that a resource's URL is http or https. A `maxlength` is an
 * attribute a form can be told to ignore and a `type="url"` is not validation at all — the prototype
 * gets away with both because it has no server. This app has one, so the same rules are stated here
 * where they cannot be bypassed, and the browser keeps its hints for the sake of the reader.
 *
 * The rules themselves are the prototype's numbers: 100 for a thread title, 65 for a board name, 90
 * for a resource name, 160 for its description, 240 for the two optional descriptions. Transcribing
 * them matters — the ticket says to follow the prototype here — and stating them in one module means
 * a browser hint and a server refusal cannot drift apart.
 */

/** The longest a thread's title may be (app.js L165: `maxlength="100"`). */
export const THREAD_TITLE_MAX = 100;
/** The longest a board's name may be (app.js L167: `maxlength="65"`). */
export const BOARD_NAME_MAX = 65;
/** The longest a resource's name may be (app.js L170: `maxlength="90"`). */
export const RESOURCE_NAME_MAX = 90;
/** The longest an optional description may be (app.js L166, L168, L171). */
export const DESCRIPTION_MAX = 240;
/** The longest a resource's description may be (app.js L171: `maxlength="160"`). */
export const RESOURCE_DESCRIPTION_MAX = 160;

/**
 * A URL a reader can act on: http or https, and nothing else.
 *
 * The prototype refuses anything else with `Use an HTTP or HTTPS URL` (app.js L172), and the reason
 * is not tidiness: `javascript:` and `data:` URLs execute in the page that opens them, so a
 * `javascript:` resource link would be a stored script. Refused **before the store is touched**, so
 * nothing is written that a reader could then be tricked into following.
 */
export const httpUrl = z
	.string()
	.trim()
	.min(1, "A resource needs a URL")
	.refine((value) => {
		try {
			const parsed = new URL(value);
			return parsed.protocol === "http:" || parsed.protocol === "https:";
		} catch {
			// An unparseable string is a URL problem, not a protocol problem, and the message says the
			// same thing either way because the reader's action is the same.
			return false;
		}
	}, "Use an HTTP or HTTPS URL");

/**
 * The resource types, closed.
 *
 * `Document`, `Repository` and `Design` are the three the seed uses (app.js L30-32); `Link` is the
 * prototype's own default on `addResource` (app.js L117). A free-text type would be a field nothing
 * can filter on later, which is why 09 closes it — and why the seed's three values must reproduce
 * exactly, since they are already stored.
 */
export const RESOURCE_TYPES = [
	"Document",
	"Repository",
	"Design",
	"Link",
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const createBoardForm = z.object({
	name: z.string().trim().min(1, "A board needs a name").max(BOARD_NAME_MAX),
	description: z.string().trim().max(DESCRIPTION_MAX).optional(),
});

export const createThreadForm = z.object({
	boardId: z.string().min(1),
	title: z
		.string()
		.trim()
		.min(1, "A thread needs a title")
		.max(THREAD_TITLE_MAX),
	description: z.string().trim().max(DESCRIPTION_MAX).optional(),
});

export const addResourceForm = z.object({
	boardId: z.string().min(1),
	name: z
		.string()
		.trim()
		.min(1, "A resource needs a name")
		.max(RESOURCE_NAME_MAX),
	url: httpUrl,
	// The default lives here rather than in the handler so the value is the schema's: a caller that omits
	// the type gets `Link` without any handler remembering to fill it in (app.js L117).
	type: z.enum(RESOURCE_TYPES).default("Link"),
	description: z.string().trim().max(RESOURCE_DESCRIPTION_MAX).default(""),
});

export type CreateBoardForm = z.infer<typeof createBoardForm>;
export type CreateThreadFormInput = z.infer<typeof createThreadForm>;
export type AddResourceForm = z.infer<typeof addResourceForm>;

/**
 * The first problem a reader should be told about, in the words they can act on.
 *
 * Zod's own messages are terse-typed rather than plain ("String must contain at most 65
 * character(s)"), and a dialog that shows one is a dialog telling the reader about a schema rather
 * than about their input. This maps the first issue to a sentence that names the field.
 */
export const firstProblem = (error: z.ZodError): string => {
	const issue = error.issues[0];
	if (!issue) return "That could not be accepted";
	const field = issue.path.join(".");
	switch (issue.code) {
		case "too_big":
			return `${labelFor(field)} is limited to ${issue.maximum} characters`;
		case "too_small":
			return `${labelFor(field)} needs at least ${issue.minimum} characters`;
		case "invalid_format":
			return labelFor(field) === "URL"
				? "Use an HTTP or HTTPS URL"
				: issue.message;
		default:
			// A refinement's own message is written for a reader already (the URL check above), so it is
			// passed through rather than replaced.
			return issue.message;
	}
};

const labelFor = (field: string): string => {
	switch (field) {
		case "name":
			return "The name";
		case "board name":
			return "The board name";
		case "title":
			return "The title";
		case "description":
			return "The description";
		case "url":
			return "URL";
		default:
			return "That field";
	}
};
