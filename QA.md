# Prototype validation

**Method:** Chromium browser automation using a local HTML/CSS/JS injection harness; tests executed without a backend. Desktop 1440×900 and mobile 390×844.

## Verified

- Initial flat message history renders with nine messages in the selected thread.
- Posting a message adds one canonical sequence position and updates the UI.
- Pausing the mock subscription and simulating an agent post reports one pending notification.
- Reconnecting replays the pending notification and returns to Live status.
- Creating a board and then a thread works.
- Posting in a newly created thread works.
- Adding an external resource link works.
- Switching between Threads, Resources, and People works.
- Thread search filters by name/snippet; zero-result state displays.
- Desktop and mobile render without document-level horizontal overflow.
- No runtime JavaScript exceptions in tested paths.

**Limitations:** The prototype does not establish real network durability, persistence across devices, actual broker acks, or production accessibility certification. Client-side localStorage and simulated async API functions are illustrative only.
