/**
 * check-boot.mjs — does the server refuse to run without a session secret?
 *
 * Why a script rather than a test: the honest assertion is a **process exit**, and the app's
 * test run is a Node suite over src/** that carries no build. Spawned from here, after a
 * build, a missing secret is fatal in a fresh process — which is the condition a deployment
 * has — and that is not something a unit test can claim.
 *
 * What was measured, rather than assumed: the plugin's start entry (src/start.ts) is imported
 * lazily, **on the first request**, not when the process starts. A throwing start entry leaves
 * the built server listening and fails the first request. So 'the process refuses to serve' is
 * true, and 'the process refuses to start' is not. This script asserts the first by importing
 * the built entry directly, where the throw is fatal; the second is not claimed anywhere.
 *
 * Usage, from apps/relayboard-web after `npm run build`:
 *   npm run check:boot
 *
 * Exit code is 1 when the guard is missing, so it drops straight into a gate.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const APP = resolve(dirname(fileURLToPath(import.meta.url)), "..", "apps", "relayboard-web");
const SSR = join(APP, ".output", "server", "_ssr");

/**
 * The built start entry is content-hashed (start-YEAQwOYP.mjs), so it is found by prefix
 * rather than by name. Failing loudly when it is absent matters: a check that silently
 * skipped because the build layout moved would be worse than no check.
 */
const findStartChunk = () => {
  if (!existsSync(SSR)) {
    console.error(`check-boot: no build at ${SSR}. Run \`npm run build\` first.`);
    process.exit(1);
  }
  const candidates = readdirSync(SSR).filter((name) => /^start-.*\.mjs$/.test(name));
  if (candidates.length === 0) {
    console.error(
      `check-boot: no start-*.mjs chunk in ${SSR}. The plugin's start entry did not build, so the secret guard cannot be asserted here.`,
    );
    process.exit(1);
  }
  return join(SSR, candidates.sort()[0]);
};

const startChunk = findStartChunk();

/**
 * Import the entry in a fresh process, with the environment the caller passes.
 *
 * `--input-type=module` with `-e` lets the probe be a one-liner without a temporary file, and
 * the specifier is a file URL so a Windows path needs no escaping.
 */
const importInFreshProcess = (env) => {
  const specifier = pathToFileURL(startChunk).href;
  return spawnSync(
    process.execPath,
    ["--input-type=module", "-e", `await import(${JSON.stringify(specifier)})`],
    { env, encoding: "utf8", cwd: APP },
  );
};

// A fixed literal, long enough to pass the length floor. Not a secret: it never leaves this
// process, and the check is about the variable being *present and usable*.
const GOOD_SECRET = "check-boot-secret-0123456789abcdef0123";

const failures = [];

// 1. Without the variable: the import must be fatal, and the message must name it.
const withoutSecret = importInFreshProcess({
  ...process.env,
  SESSION_SECRET: "",
  NODE_ENV: "production",
});
const withoutOutput = `${withoutSecret.stdout ?? ""}${withoutSecret.stderr ?? ""}`;
if (withoutSecret.status === 0) {
  failures.push(
    "importing the built entry with SESSION_SECRET unset succeeded, so nothing refuses to serve without a secret",
  );
} else if (!withoutOutput.includes("SESSION_SECRET")) {
  failures.push(
    `importing without SESSION_SECRET failed but the message does not name the variable:\n${withoutOutput.trim()}`,
  );
}

// 2. With a secret that is present but too short: also fatal, and it says which rule it broke.
const tooShort = importInFreshProcess({
  ...process.env,
  SESSION_SECRET: "short",
  NODE_ENV: "production",
});
const shortOutput = `${tooShort.stdout ?? ""}${tooShort.stderr ?? ""}`;
if (tooShort.status === 0) {
  failures.push(
    "importing with a 5-character SESSION_SECRET succeeded, so the length floor is not enforced",
  );
} else if (!/too short/i.test(shortOutput)) {
  failures.push(`a short secret failed without saying it was short:\n${shortOutput.trim()}`);
}

// 3. With a usable secret: the import must succeed. Without this, a guard that always threw
//    would pass both checks above and the app would be unbootable for the wrong reason.
const withSecret = importInFreshProcess({
  ...process.env,
  SESSION_SECRET: GOOD_SECRET,
  NODE_ENV: "production",
});
if (withSecret.status !== 0) {
  failures.push(
    `the built entry failed to import with a usable secret, so it cannot be booted at all:\n${(withSecret.stderr ?? "").trim()}`,
  );
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`check-boot: ${failure}`);
  process.exit(1);
}

console.log(
  `check-boot: the built entry refuses to load without SESSION_SECRET, refuses a short one, and loads with a usable one (${startChunk.replace(SSR, ".output/server/_ssr")}).`,
);
