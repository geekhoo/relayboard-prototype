# 27: The visual system reaches the numbers `DESIGN.md` states

**What to build:** The reading measure is the documented one. Body text caps at 68ch, the entry list centres at 850px, the composer at 780px, and Display headings balance their lines. The field focus treatment is the documented one too: the token that shifts the 1px edge under the focus ring exists in the token block and is used, so a focused field reads by edge and ring rather than by the global outline alone. The shadow vocabulary is either used or removed, and no component invents an elevation; the surfaces that genuinely float — the two dialogs and the drawer — carry the documented one. The agent and resource chips match the documented fills, inks, radii and sizes.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Found by:** product F8 at `DESIGN.md:195,207` against `src/components/Conversation.css:48-55,235-245`; product F10 at `DESIGN.md:50-54` against `src/styles.css:86-88`; product F9 at `src/styles.css:128-132` used by nothing and `src/components/Gatekeeper.css:12`, `ParticipantPanel.css:12`, `CreateDialog.css:5-13`, `PurgeDialog.css:26-33`; product F14 at `src/components/Conversation.css:125-134,181-190` and `BoardPane.css:136-145`.

- [ ] **Route seam.** At 1440 and at the widest width the suite runs, the conversation's body text measures at most 68ch and the entry list and composer are within their documented caps and centred. Measured with the computed-style helper, not by screenshot, so a legitimate restyle that keeps the measure passes.
- [ ] **Route seam.** At 320, the measure does not overflow: the cap is a maximum, so the narrow case still fits and no text is clipped to satisfy it. Both widths in one test, so a fixed pixel width cannot pass.
- [ ] **Route seam.** A field under focus with the keyboard shifts its edge to the documented token colour and keeps the 2px ring; the computed edge colour is not the unfocused one. The token is present in the stylesheet's token block, asserted once so the drift cannot return silently.
- [ ] **Route seam.** The two dialogs and the drawer carry a shadow drawn from the token block, and no element in the app sets a shadow outside it. Asserted by scanning computed styles for a shadow value that matches no declared token.
- [ ] **Route seam.** The agent chip and the resource chip compute the documented fill, ink, radius and font size, and the agent chip is distinguishable from the resource chip without relying on colour alone. The existing "no accent" assertion stays.
- [ ] **Unit/domain seam.** The style gate gains the check it is missing: a shadow or edge value used at a call site must resolve to a token declared in the token block, so the next invented elevation fails `npm run check:styles` rather than a review.

**Leaves the build green:** yes.
