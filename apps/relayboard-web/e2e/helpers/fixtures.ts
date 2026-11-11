/**
 * The seam's own `test`, which resets the workspace before every test.
 *
 * ## Why this is a fixture rather than a `beforeEach` in each file
 *
 * Criterion: "the browser context for each test starts from a clean state — no persisted
 * `localStorage` and a fresh server context". The browser half is Playwright's default (a new
 * context per test, so nothing persists). The server half is 06a's reset hook, and putting it in a
 * shared fixture is what makes isolation a property of the harness rather than a habit each spec
 * file has to remember.
 *
 * A test that specifically needs to *observe* a reset still calls `resetWorkspace` itself; the
 * fixture only guarantees where a test starts.
 */
import { test as base } from "@playwright/test";
import { resetWorkspace } from "./workspace";

const DEFAULT_BASE_URL = "http://127.0.0.1:3218";

export const test = base.extend<{ resetBeforeEach: string }>({
	// The fixture's value is unused; it exists so the hook runs for tests that never mention it.
	// `auto: true` is what makes that unconditional — a fixture is otherwise only set up when
	// something depends on it, which would reset nothing and pass.
	resetBeforeEach: [
		async ({ request, baseURL }, use) => {
			await resetWorkspace(request, baseURL ?? DEFAULT_BASE_URL);
			await use("reset");
		},
		{ auto: true },
	],
});

/**
 * Whether this run is testing the transport that shares one workspace.
 *
 * True for every real build, false for `VITE_RELAYBOARD_TRANSPORT=memory`, and the six specs about
 * one shared workspace skip with this reason rather than failing. A skip is only honest when the
 * condition is one the harness sets and can unset; this one is, and the default build never sees it.
 */
export const SHARED_WORKSPACE =
	process.env.VITE_RELAYBOARD_TRANSPORT !== "memory";

export const MEMORY_ONLY_REASON =
	"Built with VITE_RELAYBOARD_TRANSPORT=memory: the in-memory client builds its store per router, so every page load gets its own workspace and a shared-workspace claim is false by construction. Re-run without that variable to assert it.";

export { expect } from "@playwright/test";
