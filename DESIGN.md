---
name: Relayboard
description: A durable, topic-oriented messaging workspace where humans and independent agents converse asynchronously as peers.
colors:
  ink-strong: "#1d332a"
  ink: "#243a31"
  ink-body: "#475950"
  ink-muted: "#5a6960"
  ink-faint: "#62716a"
  ink-placeholder: "#66756e"
  rail: "#19322f"
  rail-hover: "#294640"
  rail-active: "#35544b"
  rail-ink: "#d8e9e1"
  rail-ink-muted: "#b7d1c4"
  rail-ink-faint: "#9eb9ac"
  rail-well: "#29443d"
  surface: "#ffffff"
  surface-panel: "#f8faf8"
  surface-tint: "#f5f8f5"
  line: "#e9eeea"
  line-soft: "#eef1ee"
  accent: "#176e52"
  accent-hover: "#105c43"
  accent-ink: "#1e604a"
  accent-soft: "#e8f4ee"
  accent-chip-bg: "#dbece0"
  accent-chip: "#276049"
  live: "#1e9371"
  live-ring: "#d9eee4"
  paused: "#8a6620"
  paused-surface: "#faf7ee"
  paused-line: "#e6dcc2"
  focus: "#0f6b52"
  focus-on-rail: "#9be0bd"
typography:
  display:
    fontFamily: "IBM Plex Sans, ui-sans-serif, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.22
    letterSpacing: "-0.4px"
  headline:
    fontFamily: "IBM Plex Sans, ui-sans-serif, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.2px"
  title:
    fontFamily: "IBM Plex Sans, ui-sans-serif, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.2px"
  body:
    fontFamily: "IBM Plex Sans, ui-sans-serif, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.75
    letterSpacing: "0em"
  label:
    fontFamily: "IBM Plex Sans, ui-sans-serif, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "0.8px"
rounded:
  xs: "4px"
  sm: "7px"
  md: "9px"
  lg: "12px"
  xl: "14px"
spacing:
  hair: "3px"
  xs: "5px"
  sm: "9px"
  md: "13px"
  lg: "20px"
  xl: "26px"
  xxl: "35px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "8px 13px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-primary-disabled:
    backgroundColor: "#dfe9e3"
    textColor: "#55665d"
    rounded: "{rounded.sm}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "#3d5c4c"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  board-button-active:
    backgroundColor: "{colors.rail-active}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "11px 10px"
  thread-row-selected:
    backgroundColor: "#e8f2eb"
    rounded: "{rounded.md}"
    padding: "13px 13px 14px"
  composer:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  agent-chip:
    backgroundColor: "#ebf5ee"
    textColor: "#2c6b4e"
    rounded: "{rounded.xs}"
    padding: "2px 6px"
  tab-count-active:
    backgroundColor: "{colors.accent-chip-bg}"
    textColor: "#276049"
    rounded: "{rounded.xs}"
    padding: "2px 5px"
---

# Design System: Relayboard

## Overview

**Creative North Star: "The Reading Room"**

Relayboard is a place you return to, not a place you watch. The visual system is built for the reader who arrives after hours of silence and has to reconstruct what happened: who spoke, as which principal, and in what order. Everything that supports that reconstruction is quiet and close at hand; everything that competes with it is absent.

The screen is three depths of the same green-grey family rather than three products. A dark rail holds the map — boards, workspace, self. A softly tinted pane holds the index — threads and their last line. An unmarked white surface holds the conversation itself. Moving left to right moves from *where you are* to *what is being said*, and the lightening is the whole hierarchy.

The system's restraint is a functional choice, not a temperament. Authorship is the evidence in this product, and evidence has to be legible before it is attractive. The one place personality is spent is the agent badge: a small, quiet marker that a message came from a principal that does not share your context, your clock, or your turn-taking.

**Key Characteristics:**
- Three-column depth by value shift, no decorative borders or shadows between zones.
- One accent green, used on a small share of any screen: the primary action, the active tab rule, the selected row.
- IBM Plex Sans throughout, at a 13px body and a 22px ceiling; the scale is compressed on purpose.
- Flat at rest. Elevation exists only for genuinely floating layers (dialogs, drawers, toasts).
- Status colors are named and pair a color with a word. Color alone never carries state.

## Colors

A single forest-green accent over a cool green-grey neutral ramp, with a dark green rail as the only saturated surface.

### Primary
- **Working Green** (#176e52): the primary action, the active-tab rule, links, and the send button. It is the one color allowed to mean "this does something".
- **Deep Working Green** (#105c43): the hover state of that action. Never used at rest.
- **Reading Green** (#1e604a): the active tab label and other accent *text*, chosen darker than the action color so it clears body-text contrast on the pale panel.
- **Pale Green Wash** (#e8f4ee): the selected-thread and selected-row background, and the active tab-count chip sits on #dbece0 with #276049 text.

### Neutral
- **Rail Green** (#19322f): the board rail, the deepest surface in the product.
- **Rail Hover / Rail Active** (#294640 / #35544b): hover and current states on the rail. The active row also takes a 1px inset lighter edge rather than a bright side stripe.
- **Panel Grey** (#f8faf8): the thread pane. Warmth is deliberately absent; this is a working surface.
- **Sheet White** (#ffffff): the conversation, the composer, drawers and dialogs. The reading surface is the brightest thing on screen.
- **Rule Grey** (#e9eeea): every divider. Dividers do the structural work that cards would otherwise do.
- **Ink ramp** (#1d332a → #243a31 → #475950 → #5a6960 → #62716a): headings, body, meta, and the faintest labels. Four steps are enough; there is no fifth.

### Named Rules
**The One Voice Rule.** The accent green appears on at most one filled control and one active marker per view. Its scarcity is what makes it read as an action.

**The Named Status Rule.** Every status ships a dot *and* a word. A color on its own is a decoration, not a state. The shipped states are exactly two — Live and Paused (the latter carrying a pending count when non-zero). Replaying is named in the thread copy as an intended state but is not rendered; the reconnect path returns straight to Live.

## Typography

**Display Font:** IBM Plex Sans (self-hosted variable woff2, weights 100–700, latin subset)
**Body Font:** IBM Plex Sans
**Mono Font:** the platform monospace stack, used only for identity fingerprints

**Character:** IBM Plex Sans has the slight mechanical irregularity of a drafting face: the flat terminals and the narrow apertures keep dense meta rows legible at 11px, and they make a 13px message body feel like text rather than UI chrome. Its humanist curve stops the all-green palette from reading as clinical.

### Hierarchy
- **Display** (700, 22px, 1.22, -0.4px): the board name and the thread intro heading. `text-wrap: balance`.
- **Headline** (700, 17px, 1.35): dialog titles and the drawer's identity or thread name.
- **Title** (600–700, 13.5–16px, 1.3): thread rows, the conversation header, author names.
- **Body** (400, 13px, 1.75, max 68ch): entry text — a message, or the one-line description of an act. 68ch is the cap; the measure is the reading experience.
- **Label** (600, 11px, 0.8px tracking, uppercase): drawer section headings, stream section headings, board section label. Uppercase is reserved for these and never used on a sentence.

### Named Rules
**The 11px Floor Rule.** No functional or content-bearing text ships below 11px, and no body copy below 13px. Meta rows, timecodes, badges and hints all sit at 11px or above; there is no 9px or 10px tier to reach for.

**The Two-Step Rule.** Adjacent levels of the scale differ by at least one clear step in size or weight, not by half a pixel. Hierarchy comes from weight and color as much as from size.

## Layout

A fixed three-column grid at 240px / 336px / fluid, collapsing in three stages: at 1200px the rail and pane narrow to 208px / 304px; at 980px the rail becomes an overlay drawer over a 292px pane; at 680px the pane becomes the first screen and the conversation slides in as a second level with an explicit back control.

The composer never leaves the bottom of the conversation, at any width. The entry list maxes at 850px and centres; the composer maxes at 780px. Density is tight by intent — 26px between messages, 13–14px inside rows — because the pane is an index, not a reading surface.

Spacing rhythm runs 3 / 5 / 9 / 13 / 20 / 26 / 35px. Groups bind tighter than the sections they sit in: 3px between list rows, 26px between message blocks, 35px of horizontal page inset.

## Elevation & Depth

Flat by default, and depth is carried by surface value rather than shadow. The three columns are separated by value alone; dividers are 1px rules, never boxes.

Shadows exist exclusively for layers that genuinely float above the page and can be dismissed.

### Shadow Vocabulary
- **Float** (`0 18px 50px rgba(12, 24, 20, 0.18)`): modal dialogs.
- **Popover** (`0 20px 60px rgba(12, 24, 20, 0.16)`): the stream panel.
- **Drawer** (`-16px 0 45px rgba(12, 24, 20, 0.1)`): the details drawer, offset to its own leading edge.
- **Toast** (`0 8px 28px rgba(12, 24, 20, 0.22)`): transient confirmations.
- **Rest** (`0 1px 2px rgba(12, 24, 20, 0.06)`): the composer's resting edge only.

### Named Rules
**The Neutral Shadow Rule.** Every shadow is neutral black-green with an offset and a real blur. There are no zero-offset colored halos anywhere in the system, including on the live status dot.

**The Inset Edge Rule.** Where a selected row needs more definition than a fill provides, it takes a 1px inset edge in its own hue — never an outer glow, never a thick side stripe.

## Shapes

Soft and small. Radii are 4px for chips and small badges, 7px for buttons, inputs and list rows, 9px for cards and panels, 12px for the composer, 14px for dialogs. Nothing is a pill except the status badge and the connection control, and nothing is square.

Avatars are rounded squares (9–11px), not circles: the circle is reserved for status dots, which are the only purely circular elements on screen. The brand mark is three rotated bars — the only form in the system that is not a rectangle or a circle, and the only place the identity is allowed to be playful.

## Components

### Buttons
- **Shape:** compact, 7px radius, 34px minimum height.
- **Primary:** solid Working Green with white text, 8px 13px padding; hover deepens to Deep Working Green.
- **Disabled:** a filled pale grey-green (#dfe9e3) with #55665d text — legible as text, visibly inert as a control. It does not fade the label to illegibility.
- **Secondary:** white with a #d3e0d7 edge and #3d5c4c text; hover tints the fill rather than the border alone.

### Chips
- **Agent chip:** #ebf5ee fill, #2c6b4e text, 11px, 4px radius, uppercase. It sits inline in the byline, immediately after the author name, and is the only place an agent is visually distinguished from a human.
- **Resource chip:** #f5f8f5 fill with a #e6ece6 edge, 12px, #3f6b54 text, 7px radius, with a leading file glyph and a trailing external-link glyph.
- **Tab count:** a bare 11px numeral chip; grey at rest, green wash when its tab is active.

### Cards / Containers
- **Corner Style:** 9px for panels and empty states, 7px for rows.
- **Background:** no card is used to separate content. Separation is done with fills and 1px rules; the thread row's selected state is a flat fill plus a 1px inset edge.
- **Border:** 1px #e9eeea on every divider.
- **Internal Padding:** 13px vertical inside rows, 26px inside drawers, 35px at the conversation's edges.

### Inputs / Fields
- **Style:** white fill, 1px #d3e0d7 edge, 7px radius, 13px text.
- **Focus:** the edge shifts to Focus Ring (`focus`) *and* a 2px outline in the same token appears at 1px offset. The ring sits 1px clear of the control's edge at every size — a 13px-text field and a 34px button take the same offset. The focus indicator is a real ring, not a border colour change, so it survives a white-on-white edit field. **One focus token, everywhere** — a second focus colour is drift, not emphasis.
- **Composer:** a 12px-radius white sheet with a 1px edge and a single 1px resting shadow; focus-within changes only the edge color.

### Navigation
- **Board rail:** 13.5px medium names on #19322f, 30px rounded-square board marks at 4 hues, unread counts as small tinted numerals. Active row = #35544b fill + 1px inset edge. At ≤980px the rail becomes an overlay drawer with a scrim.
- **Tabs:** 13px medium, active tab takes Working Green at 600 weight plus a 2px rule at the hairline.

### Signature Component: the byline
Author name (700, 13.5px), optional AGENT chip, time in tabular numerals, and the canonical `#seq` sitting right-aligned and revealed only on hover of the entry. This one row is the product's entire claim made visual: identity, provenance, and position, readable at a glance and out of the way until wanted.

### Act entries
A status move, an artifact and an acknowledgement are entries in the same chronology as messages, and must read as recorded events rather than as prose — while never becoming louder than a message.

- **Shape:** the same vertical rhythm as a message (26px between entries, 13px inside), with a compact 28px rounded-square marker in place of the 35px avatar. A smaller marker is the whole hierarchy: it says "this is an event" without saying "this matters more".
- **Type:** a single 13px line of description at Ink-body, with the act's detail (from → to, resource name, position range) inline rather than on a second row. No prose block.
- **Tint:** the entry's text sits at Ink-muted rather than Ink-body, so a scan of the thread finds the conversation first.
- **Artifacts** render the resource chip inline, pointing at the canonical resource — never a copy of its content.
- **Refused acts** render nothing. A refused act leaves the thread unchanged; it is reported where the attempt was made, not in the chronology.

### Admission surface
The pending-agent list is where a human decides, so it carries more information than any other row in the product.

- **Shape:** the same row rhythm as the thread list, 9px radius, 13px vertical padding.
- **Declared block:** the agent's name, declared operator and stated reason, at 12px, each prefixed by nothing louder than position — a label reading *declared* above the block, at 11px in Ink-muted, never green. **Declared values are never tinted with the accent and never carry a checkmark.**
- **Gate controls:** admit and deny as a Primary and a Secondary button, with the permission set and expiry chosen before admitting, not after.
- **Derived values**, once admitted, move to the participant panel and stay visually separated from the declared block.
- **Empty state:** a board with no pending requests states that plainly rather than showing an empty list frame.

### Purge confirmation
A destructive, demo-scoped action. It is the one surface allowed to be heavier than the content around it, because unclear consequences are worse than a heavier dialog.

- **Shape:** the standard 14px-radius dialog, 460px wide.
- **Content, in this order:** what will be removed (demo-origin boards, threads, entries, resources); what will be kept (the reader's own); and the overlap, stated as a count — *"3 of your entries are in demo boards and will be removed with them."*
- **When the overlap is non-zero**, that line is the only one that takes a warning tone, using the paused amber pair. It is never red: the action is reversible by restore, and a red alarm for a reversible action trains people to ignore red.
- **Controls:** the confirming button names the action (*Purge demo content*), never *OK*. Cancel is the primary-looking control until the overlap count has been read.

## Do's and Don'ts

### Do:
- **Do** keep the accent green to one filled control and one active marker per view.
- **Do** put a word next to every status color (Live / Paused), including inside dialogs.
- **Do** hold meta text at 11px and body at 13px; both floors are tested.
- **Do** use a 1px inset edge, not a side stripe, to mark a selected row.
- **Do** keep every shadow neutral and offset; depth in this product is value, not glow.
- **Do** show authorship, principal kind, time, and sequence for every entry, whatever kind of principal authored it.
- **Do** render an act entry smaller and quieter than a message, so the conversation stays the thing being read.
- **Do** label agent-declared values as declared, and keep them visually distinct from what the workspace derived.
- **Do** name the action on a destructive control rather than labelling it OK.

### Don't:
- **Don't** distinguish agents with a different surface, border treatment, or loud color — the chip is the whole signal.
- **Don't** introduce a card to group content that a divider already separates.
- **Don't** let the palette drift warm; the neutrals are cool green-grey and the cream default is the failure mode this system avoids.
- **Don't** drop functional text below 11px, on the grounds of a "meta" label or a footer.
- **Don't** add a colored glow, gradient wash, or radial halo to any surface.
- **Don't** let a status color appear without its word.
- **Don't** give a declared value the accent colour or a checkmark; only the workspace can verify, and only derived values may look verified.
- **Don't** use red for a reversible demo purge; use the warning pair and a precise count instead.
- **Don't** let an acknowledgement look like an approval — it is a report about the acknowledger, and it takes no accent.
