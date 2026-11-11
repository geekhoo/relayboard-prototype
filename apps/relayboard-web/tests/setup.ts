/**
 * What every test run needs in its environment.
 *
 * The server's resolver reads `SESSION_SECRET` at module scope and throws when it is absent, so
 * importing it — which several suites do — fails unless the variable is set. A test run is a
 * process that serves requests, so it needs a secret for the same reason a dev server does;
 * this file is that requirement stated once rather than repeated in every suite.
 *
 * It does **not** weaken the check the app makes. Two other assertions cover the absence:
 * `tests/session.test.ts` calls `requireSessionSecret` with explicit sources and proves it
 * refuses, and `scripts/check-boot.mjs` spawns a process with no secret and proves the import is
 * fatal. Setting a value here only means the *suite* is not the place that proves the absence.
 *
 * The value is a fixed literal rather than random so a test can sign and verify a cookie across
 * two files if it needs to. It is not a secret: it is test-only and never leaves this process.
 */
process.env.SESSION_SECRET ??= "test-secret-0123456789abcdef0123456789";
