import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

/**
 * The port's shipping target is one long-running Node process. An in-memory store and a
 * long-lived SSE connection both need a single process, and a serverless, horizontally
 * scaled target would build green and only then fail at runtime. The preset is therefore
 * pinned rather than inferred, so a Vercel build environment cannot silently switch it.
 */
const config = defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [
		nitro({ preset: "node-server" }),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
	],
});

export default config;
