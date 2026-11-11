import { existsSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * The route seam: Playwright driving the built app in a real browser.
 *
 * ## Why Playwright and not a hand-rolled driver
 *
 * This harness was hand-written five times before it was checked in — spawn Chrome, poll
 * `/json/version`, open a WebSocket, correlate requests by id, set device metrics, dispatch key
 * events — always as a throwaway, always slightly differently. The four things it kept getting
 * wrong are Playwright's default behaviours: waiting for the app to be interactive rather than
 * sleeping, a keystroke that actually reaches a focused control, a readable trace after a failure,
 * and a fresh browser context per test. The strongest evidence a harness should exist is that it
 * was being rewritten every time one was needed.
 *
 * ## Why it tests a BUILT server and not the dev server
 *
 * The build is what ships, and two defects this project found were only visible in one: the pane's
 * false first paint (a server-rendered "0 threads" that corrected itself) and a module-scope throw
 * that shipped into the client bundle and left every control inert. A dev server would have hidden
 * the first and repaired the second.
 *
 * ## Two ways to get that server, and why both exist
 *
 * Locally the harness builds and runs: `npm run e2e` from a clean checkout with no manual step.
 * In CI the workflow has already built — and the artefacts it asserted are the ones under test, so
 * a second build here would test something the other steps never saw. Set
 * `RELAYBOARD_E2E_REUSE_BUILD=1` and the config runs the existing build instead, **failing loudly
 * if it is absent** rather than quietly rebuilding.
 */
const REUSE_BUILD = process.env.RELAYBOARD_E2E_REUSE_BUILD === "1";

// Refuse at config-load time, not at server-start time: without this, a reuse run against an empty
// `.output` fails with node's ENOENT on a missing file, which reads as a broken repository rather
// than as a harness that was asked to reuse a build that is not there. Failing here says which
// contract was broken and how to satisfy it.
if (
	REUSE_BUILD &&
	!existsSync(join(process.cwd(), ".output", "server", "index.mjs"))
) {
	throw new Error(
		"RELAYBOARD_E2E_REUSE_BUILD=1 asks the harness to test the existing build, but .output/server/index.mjs is absent. This flag exists so CI tests the artefacts it already asserted; locally, unset it and the harness builds first.",
	);
}

/**
 * A port nothing else in this repository uses.
 *
 * Deliberately not 3000: that is `npm run dev`, and a dev server or a leftover probe server on it
 * would be silently adopted by a harness that reused an existing server. Nothing else in the repo
 * declares 3218, so a collision here means the harness itself is double-running, which is worth
 * failing on.
 */
const PORT = 3218;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * The environment the served app needs.
 *
 * `SESSION_SECRET` because the server refuses to serve without one, and `RELAYBOARD_TEST_MODE`
 * because the reset hook refuses in a production process — both stated here rather than inherited
 * from whatever shell ran the command, so the harness is reproducible from a cold terminal and in
 * CI.
 */
const SERVER_ENV: Record<string, string> = {
	SESSION_SECRET: "e2e-session-secret-0123456789abcdef",
	RELAYBOARD_TEST_MODE: "1",
	NODE_ENV: "production",
	PORT: String(PORT),
};

export default defineConfig({
	testDir: "./e2e",
	// The route seam covers the whole app, so a run is a survey rather than a unit: one worker keeps
	// the shared server's timing predictable, and the reset hook makes order-independence a property
	// of the tests rather than of the scheduling.
	fullyParallel: false,
	workers: 1,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI
		? [["github"], ["html", { open: "never" }]]
		: [["list"]],
	// A trace on the first retry and on any failure is what makes a failure diagnosable without
	// re-running it. `test-results/` is gitignored: a trace is a developer's artefact, not the
	// repo's. CI uploads it as an artefact instead.
	use: {
		baseURL: BASE_URL,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "off",
	},
	projects: [
		{
			// One browser project. The app has no browser-specific behaviour to justify more, and a
			// second project doubles a run that already builds.
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: {
		command: REUSE_BUILD
			? "node .output/server/index.mjs"
			: "npm run build && node .output/server/index.mjs",
		url: `${BASE_URL}/boards/platform`,
		// Never adopt a server this run did not start: a stale one would serve a build from before
		// the change under test, which is the one failure mode that looks like a pass.
		reuseExistingServer: false,
		timeout: 180_000,
		stdout: "pipe",
		stderr: "pipe",
		env: SERVER_ENV,
	},
});
