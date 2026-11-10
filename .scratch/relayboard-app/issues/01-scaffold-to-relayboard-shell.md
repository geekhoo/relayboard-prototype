# 01: Make the scaffold into a Relayboard shell

**What to build:** Opening the app in a browser stops looking like a TanStack starter and starts looking like the thing in `DESIGN.md`. The starter's site header, footer, about page, query demo, devtools wiring, Google Fonts import, teal palette, gradient wash and theme toggle are gone. The document renders in the self-hosted IBM Plex Sans that the prototype already ships, over the forest-green token set, with a `prefers-reduced-motion` block and the token names preserved from the design system. The app still shows nothing but a placeholder at this point — this ticket buys the frame the rest of the work hangs on, not any product behaviour.

Both reviews audited this ticket against the tree and found it right about everything it names and incomplete about eight things. Items M1–M8 below are those findings; they are the difference between "the starter looks gone" and "the starter *is* gone".

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] No route resolves for `/about` or `/demo/tanstack-query`; the starter routes **and every rule that only they used** are gone — including the `.demo-*` block, `.island-shell`, `.display-title`, `.island-kicker`, `.page-wrap`, `.nav-link` and `.site-footer`, and the `@tailwindcss/typography` plugin that existed for their prose. *(M6)*
- [ ] No site header, footer, or devtools panel renders in development or in a production build, and **the devtools Vite plugin, the devtools integration module and the four devtools packages it wired are removed**, not left in place unconsumed. *(M4)*
- [ ] No theme toggle exists, and no `data-theme` attribute, dark `:root` block, or `prefers-color-scheme` override remains. **`suppressHydrationWarning` goes with the pre-paint script it existed for.** *(M5)*
- [ ] The page title, meta description and any remaining scaffold identity are replaced with Relayboard's. *(M5)*
- [ ] **The body's radial-gradient wash, `body::before` glow and `body::after` grid are deleted.** `DESIGN.md` forbids a gradient wash or a coloured halo on any surface, and the scaffold's world is layered behind every screen. *(M1)*
- [ ] **`overflow-x: hidden` is removed from the body.** While it is present, "no horizontal scrolling" is vacuously true and a real overflow bug ships green. *(M2)*
- [ ] No literal colour appears at a call site — including the selection tint currently written as an `rgba()` in the root shell. *(M3)*
- [ ] Colour, type, radius and shadow tokens are declared once and named after `DESIGN.md`. **The eight tokens the prototype used that the design system did not carry are now in `DESIGN.md`'s frontmatter and its sidecar** — the focus ring and its on-rail variant, the placeholder ink, the soft rule, the live ring, the held-amber line, the rail well and the chip ink — so this ticket reproduces a documented palette rather than inventing one. Radii declare in the `rounded:` block and shadows in the sidecar, where they already live.
- [ ] **The app follows the styling split the spec now pins**: `@theme` carries the token block under `DESIGN.md`'s names, layout and responsive stages are utilities, and each component's anatomy is a co-located stylesheet beside it. The global sheet holds only the tokens, `@font-face`, resets, base typography and the reduced-motion block. Ticket 01 sets this boundary; every later UI ticket adds one component file, not a slice of a shared sheet.
- [ ] **The self-hosted face has a stated home.** The face is copied from the repository's existing latin-subset file into `public/fonts/` — there is no `public/` directory today — and referenced as `url('/fonts/ibm-plex-sans-latin.woff2')`, so it resolves in a production build without a bundler import and the document issues no request to any external font host. *(M8)*
- [ ] `prefers-reduced-motion` suppresses transitions and smooth scrolling.
- [ ] `npm run build`, `npx tsc --noEmit` and `npm run check` all pass, and the build **cannot** produce a serverless artefact: the Nitro preset is pinned to `node-server` and the Vercel deployment configuration is deleted rather than left to be discovered. *(M7)*
- [ ] The type and contrast floors are asserted later, not here: at this ticket there is no product text on screen to measure, so the criterion that belongs here is that the token set carries the right sizes and colours, and that a browser assertion exists by the time text does.

**Leaves the build green:** yes. The app renders an empty Relayboard frame.

**Write scope:** `vite.config.ts` (owns the Nitro preset outright), `tsconfig.json`, `src/styles.css`, `src/routes/__root.tsx`, `src/components/**`, `package.json`, `package-lock.json`, `public/`, and a **one-line append** to `biome.json` only if the components directory needs a glob it does not already cover. Ticket 02a appends its own globs to `biome.json` and its own dependencies and script to `package.json`; both edit the same two files, so take 02a after this one and let only one `npm install` run at a time.
