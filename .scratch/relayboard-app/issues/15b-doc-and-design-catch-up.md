# 15b: `QA.md`, `DESIGN.md` and `PRODUCT.md` catch up with the app

**From:** 15 — Parity with the prototype, proven and documented

**What to build:** The records stop describing the prototype. `QA.md` is rewritten against the app while keeping its method, its viewport list and its honesty section. `DESIGN.md` and its sidecar gain only what is genuinely still missing; `PRODUCT.md` likewise. **Three of the parent ticket's documentation criteria are already true** and must not be re-claimed here — see the note below — which is what makes this a session-sized job rather than three.

**Blocked by:** 15a — Every behaviour `QA.md` verified, exercised against the app

**Write scope:** `QA.md`, `DESIGN.md`, `PRODUCT.md` and the design sidecar. Nothing under `src/`.

**Status:** done — verified; see `## Comments`

- [x] `QA.md` is rewritten to describe the app: its method, its scenario list, its viewport list and its `Not verified` section, with the prototype's hash-addressed files and `puppeteer-core` harness replaced by the app's route-seam suite. The honesty section stays: what was not exercised is stated in the same spirit as the original (L25–32).
- [x] `QA.md`'s `Not verified` list is re-derived rather than copied: cross-browser, real assistive technology, performance, load and security remain unexercised, and the record says so.
- [x] `DESIGN.md` and `.impeccable/design.json` are checked against what the app actually renders, and any divergence between the recorded component and the built one is fixed in the direction `DESIGN.md` is normative for (spec L629). This is verification, not authoring — the three components the parent ticket names are already recorded.
- [x] **Check the record for `#7fb79c`**, the `focus-within` border colour in exactly two sidecar snippets — *Search Field* (`.impeccable/design.json` L598) and *Composer* (L630) — a value `DESIGN.md` neither declares nor mentions, which exists only in the prototype's `styles.css` L676 and L1467 and is therefore a colour literal outside the token block the app now forbids; resolve it, either as a token in `DESIGN.md` or by giving both snippets an existing token.
- [x] **Check the record for the four board-mark hues**, the same gap as `#7fb79c` one line above. `DESIGN.md` §241 makes "30px rounded-square board marks at 4 hues" normative and names none of the four values; `.impeccable/design.json`'s *Board Rail* snippet carries only two of them — the default `#527b72` and ochre `#8a6553` (`ds-board-mark` and `ds-board-mark.ds-ochre`). `lavender`, `blue` and `sage` exist nowhere but the prototype's `styles.css` L396–410 (`#6d6a96`, `#4d7091`, `#477263`), which the app's token rule cannot read. Resolve it here: all four reach `DESIGN.md`'s frontmatter as named tokens and all four appear in the sidecar's board-mark snippet, with the prototype's values as the source. 04a's rail renders them from `theme`, so the app will carry them in `@theme` regardless; this ticket is what makes the record true rather than what makes the app work.
- [x] `PRODUCT.md`'s users section is checked against the model: agents are peers a human admitted, not participants a human "supervises" (spec L467). If the wording still reads as a hierarchy, it is corrected here.
- [x] The permission table appears in `PRODUCT.md` as capabilities, so a permission that exists in code and in no document is a visible failure (spec L469).
- [x] `DESIGN.md`'s rules for a control the reader may not use (disabled with a reason, `DESIGN.md` §221) match what 07a enforced and what 09, 10 and 12 render.
- [x] The root `AGENTS.md` command list and layout table describe the app's test commands, so a contributor can find them without reading a ticket.

**Already true before this ticket — do not spend the session on them.** Verified as of commit `f9b6d05`: `DESIGN.md` §247 *Act entries*, §256 *Admission surface*, §265 *Purge confirmation*, with snippets for all three in `.impeccable/design.json`'s `components`; `PRODUCT.md` L16 (permission model), L41–42 (admission cycle), L46 (purge boundary); root `AGENTS.md` L61–65 already says "being admitted grants nothing". Three of the parent's criteria are satisfied and should be retired rather than re-ticked.

**Leaves the build green:** yes.

## Comments

**Implemented and verified** at `e29ab49`. The records stop describing the prototype: `QA.md` now records
the app's route-seam suite and its own `Not verified` section, `DESIGN.md` and its sidecar gained the two
colour families that were missing, and `PRODUCT.md` carries the permission table as capabilities.

**The two colour gaps this ticket was written to close, both real:**

- **`#7fb79c`** existed only in the prototype's stylesheet and in two sidecar snippets — a value
  `DESIGN.md` neither declared nor mentioned, and therefore a colour literal outside the token block the app
  forbids. It is now `field-focus-edge` in `DESIGN.md`'s token block.
- **The four board-mark hues.** `DESIGN.md` §241 makes "30px rounded-square board marks at 4 hues"
  normative and named none of the values; the sidecar carried two. All four are now named tokens —
  `board-mark-ochre`, `-lavender`, `-blue`, `-sage` — with the prototype's own values, and all four appear in
  the board-mark snippet.

**The criteria that were already true were left alone rather than re-claimed.** The ticket's own note
records that `DESIGN.md` §247, §256 and §265 and three `PRODUCT.md` lines were satisfied before it started;
they were checked against the tree and not re-ticked as new work.

**`QA.md`'s honesty section survives the rewrite**, which was the risk: a document that describes a
different harness tends to lose the admissions the old one made. Cross-browser, real assistive technology,
performance, load and security are still listed as unexercised, in the same spirit as the original, and
re-derived rather than copied — the old list was about `puppeteer-core` and this one is about Playwright.
