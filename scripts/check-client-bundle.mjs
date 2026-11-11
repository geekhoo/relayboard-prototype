#!/usr/bin/env node
/**
 * The client bundle must not carry the server's secrets.
 *
 * ## Why this exists
 *
 * 04b found a defect no gate could see. `src/server/principal.ts` read
 * `SESSION_SECRET` at module scope, and the client entry imports the server
 * functions, which import the resolver — so the throw shipped inside the browser
 * bundle. React never hydrated: the search box accepted text and wrote nothing,
 * the filter did nothing, and links appeared to work only because a browser
 * follows an anchor without JavaScript. Every gate was green, and every
 * measurement was of the server's HTML, which was correct.
 *
 * The fix was `import.meta.env.SSR ? requireSessionSecret() : ""` — a build-time
 * constant, so the server bundle keeps the call and the client bundle keeps
 * nothing. That fix is only trustworthy if something checks it, because the next
 * server-only module imported into a client component will look exactly the same
 * in review as this one did.
 *
 * `check:boot` is the mirror of this check: it proves the server refuses to load
 * without a secret. This proves the browser never learns what the secret is for.
 *
 * ## What it asserts
 *
 * For every JavaScript asset in the built client bundle:
 *
 * 1. The secret's variable name does not appear.
 * 2. The guard's function name does not appear.
 * 3. No Node built-in that only exists on the server is imported.
 *
 * It runs after `npm run build`, because there is no bundle to inspect until then,
 * and it fails loudly on a missing directory rather than passing an empty check.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Strings that must never reach the browser. */
const FORBIDDEN = [
	{
		needle: "SESSION_SECRET",
		why: "the session-signing secret's variable name",
	},
	{
		needle: "requireSessionSecret",
		why: "the server's environment guard",
	},
	{
		needle: "node:crypto",
		why: "a Node built-in that only exists on the server",
	},
];

const bundleRoot = join(process.cwd(), ".output", "public");

/** Every file under a directory, recursively. */
function walk(dir) {
	const found = [];
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) found.push(...walk(path));
		else found.push(path);
	}
	return found;
}

let assets;
try {
	assets = walk(bundleRoot).filter((path) => path.endsWith(".js"));
} catch {
	console.error(
		`check-client-bundle: no client bundle at ${bundleRoot}. Run \`npm run build\` first.`,
	);
	process.exit(1);
}

if (assets.length === 0) {
	console.error(
		`check-client-bundle: ${bundleRoot} exists but holds no JavaScript. Refusing to pass an empty check.`,
	);
	process.exit(1);
}

const failures = [];
for (const asset of assets) {
	const source = readFileSync(asset, "utf8");
	for (const { needle, why } of FORBIDDEN) {
		if (source.includes(needle)) {
			failures.push(`${asset.slice(bundleRoot.length + 1)}: contains ${needle} (${why})`);
		}
	}
}

if (failures.length > 0) {
	console.error("check-client-bundle: server-only code reached the browser bundle.");
	for (const failure of failures) console.error(`  ${failure}`);
	console.error(
		"\nA module-scope side effect in a server module ships to the client whenever a client\n" +
			"component's import graph reaches it. Gate it on import.meta.env.SSR, or move the\n" +
			"side effect into the start entry.",
	);
	process.exit(1);
}

console.log(
	`check-client-bundle: ${assets.length} client assets carry none of ${FORBIDDEN.length} server-only strings.`,
);
