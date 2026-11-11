/**
 * The route seam's server control: starting from a known workspace.
 *
 * ## The reset hook, and why its id is read rather than written down
 *
 * 06a's `resetTestStore` is a server function guarded by `resetAllowed()`, which refuses unless the
 * process is not production or declares `RELAYBOARD_TEST_MODE=1`. The harness declares that, so
 * every test can start from the seed.
 *
 * Its URL is `/_serverFn/<64 hex characters>`, and the id is derived from the function's export
 * name at build time. **A hard-coded id is a trap**: the first version of this file carried a
 * truncated copy, and the server's answer was `Server function info not found for <id>` with HTTP
 * 500 — which reads exactly like "the reset function is not in this build", and cost twenty
 * minutes of re-deriving a build that was fine. Worse, the failure blames the app rather than the
 * harness. So the id is read from the built server's own function manifest and the lookup fails
 * loudly if it is ambiguous.
 *
 * ## What a reset does and does not do
 *
 * It returns the **process's** store to a fresh seed, in place. It does not touch the browser: a
 * cookie naming a principal the fresh seed also holds stays valid, which is correct — the seed
 * holds the same principals every time, so a session survives a reset and a test does not have to
 * re-establish one.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { APIRequestContext } from "@playwright/test";
import { expect } from "@playwright/test";

const SSR_DIR = join(process.cwd(), ".output", "server", "_ssr");
const RESET_FUNCTION_NAME = "resetTestStore_createServerFn_handler";

/**
 * The reset function's id, read from the built server.
 *
 * Exactly one match or a thrown error naming what was found: zero means the build predates the
 * function, and two would mean a rename left a stale entry, and either way a test that silently
 * skipped the reset would be testing whatever the previous test left behind.
 */
export const resetFunctionId = (): string => {
	let files: string[];
	try {
		files = readdirSync(SSR_DIR).filter((name) => name.endsWith(".mjs"));
	} catch {
		throw new Error(
			`The route seam needs a built server: ${SSR_DIR} does not exist. Run \`npm run build\` first, or let the config's webServer build it.`,
		);
	}
	const found: string[] = [];
	for (const file of files) {
		const source = readFileSync(join(SSR_DIR, file), "utf8");
		for (const match of source.matchAll(
			/"([0-9a-f]{64})":\s*\{\s*functionName:\s*"([A-Za-z0-9_]+)"/g,
		)) {
			if (match[2] === RESET_FUNCTION_NAME && match[1]) found.push(match[1]);
		}
	}
	const unique = [...new Set(found)];
	if (unique.length !== 1) {
		throw new Error(
			`Expected exactly one server function named ${RESET_FUNCTION_NAME} in the build, found ${unique.length}${unique.length ? `: ${unique.join(", ")}` : ""}. Zero means the build predates it; more than one means a rename left a stale manifest entry.`,
		);
	}
	return unique[0] as string;
};

/**
 * Reset the server's workspace to the seed.
 *
 * Sent as the browser sends it — `origin` and `x-tsr-serverfn` — because the server function's
 * endpoint requires an origin header as CSRF protection, and a request without one is refused.
 */
export const resetWorkspace = async (
	request: APIRequestContext,
	baseURL: string,
): Promise<void> => {
	const response = await request.post(
		`${baseURL}/_serverFn/${resetFunctionId()}`,
		{ headers: { origin: baseURL, "x-tsr-serverfn": "true" } },
	);
	const body = await response.text();
	expect(
		response.status(),
		`The workspace reset failed with ${response.status()}: ${body.slice(0, 300)}`,
	).toBe(200);
	// A serialised failure comes back as 200 with an error payload in this transport, so the status
	// alone is not proof. The marker below is the success shape; a container that renamed the
	// result would fail here rather than passing silently.
	expect(
		body,
		`The workspace reset returned an error payload: ${body.slice(0, 300)}`,
	).toContain('"reset"');
};
