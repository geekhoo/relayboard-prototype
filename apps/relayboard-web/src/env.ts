import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { runtimeEnvironment } from "#/server/env";

export const env = createEnv({
	server: {
		SERVER_URL: z.url().optional(),
		/**
		 * The session signing secret. **Required, and not `.optional()`.**
		 *
		 * The scaffold declared both variables optional, which is why it builds and runs with no
		 * `.env` at all; that is fine for a title and wrong for a signing key. Absent, the app
		 * must not serve: a session cookie signed with `undefined` is not a session, and the
		 * failure would otherwise surface as an unreadable cookie on the first post.
		 *
		 * The length floor lives in `requireSessionSecret` (`src/server/env.ts`), which is where
		 * the value is actually used and where the message can say how to generate one. This
		 * declaration's job is to make the variable a startup requirement rather than a
		 * first-request discovery.
		 */
		SESSION_SECRET: z.string().min(1),
	},

	/**
	 * The prefix that client-side variables must have. This is enforced both at
	 * a type-level and at runtime.
	 */
	clientPrefix: "VITE_",

	client: {
		VITE_APP_TITLE: z.string().min(1).optional(),
	},

	/**
	 * What object holds the environment variables at runtime — **the process environment,
	 * with Vite's build-time snapshot merged under it.**
	 *
	 * The scaffold had `import.meta.env` here, which only sees variables Vite exposes: a
	 * server-only variable read that way comes back `undefined` even when it is exported into
	 * the process. `NOTES.md` §5(d) measured exactly that with `SERVER_URL`. The session secret
	 * is server-only, so this is the one line that had to change for it to be readable at all.
	 */
	runtimeEnv: runtimeEnvironment(),

	/**
	 * By default, this library will feed the environment variables directly to
	 * the Zod validator.
	 *
	 * This means that if you have an empty string for a value that is supposed
	 * to be a number (e.g. `PORT=` in a ".env" file), Zod will incorrectly flag
	 * it as a type mismatch violation. Additionally, if you have an empty string
	 * for a value that is supposed to be a string with a default value (e.g.
	 * `DOMAIN=` in an ".env" file), the default value will never be applied.
	 *
	 * In order to solve these issues, we recommend that all new projects
	 * explicitly specify this option as true.
	 */
	emptyStringAsUndefined: true,
});
