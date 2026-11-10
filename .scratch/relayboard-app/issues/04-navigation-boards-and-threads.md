# 04: Browse boards and threads at a shareable URL

**What to build:** The three-column workspace renders from the client: a board rail, a thread pane, and a conversation. Moving between boards and threads is a navigation whose address can be reloaded, bookmarked and pasted, and a URL naming something that no longer exists resolves to a not-found state inside the app frame rather than a framework error page. This is the first ticket where the product is recognisably itself.

**Blocked by:** 01 — scaffold shell and tokens; 03 — the client interface

**Status:** ready-for-agent

- [ ] A wide viewport shows the board rail, thread pane and conversation together, full-bleed, with no site chrome competing for height.
- [ ] The open board and thread are both in the URL, and reloading or pasting that URL restores the same view.
- [ ] The three board views — threads, resources, people — are search parameters, so back and forward work across them.
- [ ] Thread search text and the unread filter are search parameters, validated on the way in so a hand-edited URL cannot break the view.
- [ ] A board or thread named in the URL that does not exist renders a not-found state inside the app frame.
- [ ] Thread rows show title, last entry excerpt, last author, entry count and an unread marker, ordered by most recent activity.
- [ ] Rows are reachable and activatable from the keyboard, and the active row is distinguishable without relying on colour alone.
