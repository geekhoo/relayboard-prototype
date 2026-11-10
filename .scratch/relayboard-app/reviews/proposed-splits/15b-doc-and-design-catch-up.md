# 15b: `QA.md`, `DESIGN.md` and `PRODUCT.md` catch up with the app

**From:** 15 — Parity with the prototype, proven and documented

**What to build:** The records stop describing the prototype. `QA.md` is rewritten against the app while keeping its method, its viewport list and its honesty section. `DESIGN.md` and its sidecar gain only what is genuinely still missing; `PRODUCT.md` likewise. **Three of the parent ticket's documentation criteria are already true** and must not be re-claimed here — see the note below — which is what makes this a session-sized job rather than three.

**Blocked by:** 15a — Every behaviour `QA.md` verified, exercised against the app

**Status:** ready-for-agent

- [ ] `QA.md` is rewritten to describe the app: its method, its scenario list, its viewport list and its `Not verified` section, with the prototype's hash-addressed files and `puppeteer-core` harness replaced by the app's route-seam suite. The honesty section stays: what was not exercised is stated in the same spirit as the original (L25–32).
- [ ] `QA.md`'s `Not verified` list is re-derived rather than copied: cross-browser, real assistive technology, performance, load and security remain unexercised, and the record says so.
- [ ] `DESIGN.md` and `.impeccable/design.json` are checked against what the app actually renders, and any divergence between the recorded component and the built one is fixed in the direction `DESIGN.md` is normative for (spec L605). This is verification, not authoring — the three components the parent ticket names are already recorded.
- [ ] `PRODUCT.md`'s "Technical state, as of the port" paragraph (L52) is updated: the prototype is no longer the live implementation, or the paragraph explains why it is still retained.
- [ ] `PRODUCT.md`'s users section is checked against the model: agents are peers a human admitted, not participants a human "supervises" (spec L444). If the wording still reads as a hierarchy, it is corrected here.
- [ ] The permission table appears in `PRODUCT.md` as capabilities, so a permission that exists in code and in no document is a visible failure (spec L446).
- [ ] `DESIGN.md`'s rules for a control the reader may not use (disabled with a reason, `DESIGN.md` §213) match what 07a enforced and what 09, 10 and 12 render.
- [ ] The root `AGENTS.md` command list and layout table describe the app's test commands, so a contributor can find them without reading a ticket.

**Already true before this ticket — do not spend the session on them.** Verified as of commit `f9b6d05`: `DESIGN.md` §239 *Act entries*, §248 *Admission surface*, §257 *Purge confirmation*, with snippets for all three in `.impeccable/design.json`'s `components`; `PRODUCT.md` L16 (permission model), L41–42 (admission cycle), L46 (purge boundary); root `AGENTS.md` L61–65 already says "being admitted grants nothing". Three of the parent's criteria are satisfied and should be retired rather than re-ticked.

**Leaves the build green:** yes.
