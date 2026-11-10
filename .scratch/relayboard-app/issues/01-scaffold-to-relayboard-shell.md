# 01: Make the scaffold into a Relayboard shell

**What to build:** Opening the app in a browser stops looking like a TanStack starter and starts looking like the thing in `DESIGN.md`. The starter's site header, footer, about page, query demo, devtools panel, Google Fonts import, teal palette and theme toggle are gone. The document renders in the self-hosted IBM Plex Sans that the prototype already ships, over the forest-green token set, with a `prefers-reduced-motion` block and the token names preserved from the design system. The app still shows nothing but a placeholder at this point — this ticket buys the frame the rest of the work hangs on, not any product behaviour.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] No route resolves for `/about` or `/demo/tanstack-query`; the starter routes and their styles are gone.
- [ ] No site header, footer, or devtools panel renders in either development or a production build.
- [ ] No theme toggle exists, and no `data-theme` attribute, dark `:root` block, or `prefers-color-scheme` override remains.
- [ ] The document issues no request to any external font host, and the body computes to the self-hosted face rather than a fallback.
- [ ] Colour, type, radius and shadow tokens are declared once and named after `DESIGN.md`; no component hard-codes a hex value.
- [ ] `prefers-reduced-motion` suppresses transitions and smooth scrolling.
- [ ] Type and contrast still meet the floors `DESIGN.md` records: no functional text below 11px, no body text below 13px, AA against the actual background.
- [ ] `npm run build`, `npx tsc --noEmit` and `npm run check` all pass.
