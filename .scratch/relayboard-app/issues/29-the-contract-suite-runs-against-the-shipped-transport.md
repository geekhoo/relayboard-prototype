# 29: The contract suite runs against the transport the app ships

**What to build:** "Two implementations, one interface" becomes a test rather than a claim. The operations and stream conformance suites run against the HTTP client as well as the in-memory one, inside `npm test`, against a real server process, so a behaviour only one transport performs fails the gate. The interface members that are currently names in a list get behavioural cases — purge impact, purge, restore, and reading held permissions. The duplicated case in the stream conformance file is removed, so the file's own count means what it says.

**Blocked by:** 17 — Opening a thread advances `seen` on the shipped transport; 18 — record identity and the idempotency namespace; 21 — a resume replays every thread's missed entries. Each fixes a divergence the suite would report the moment it ran over HTTP, so the runner lands on a workspace where both transports agree.

**Status:** ready-for-agent

**Found by:** architecture F11 at `tests/contract/operations.conformance.ts:104-128` and `tests/http-client.test.ts:24-30`; the duplicated case at `tests/contract/stream.conformance.ts:301` and `:322`, recorded in the synthesis's Lead-only measurements.

- [ ] **Contract seam.** The operations suite passes unchanged over HTTP against a server started for the test run, with the same assertions as the in-memory run, and a failure names which transport failed.
- [ ] **Contract seam.** The stream suite passes over HTTP too, covering subscribe, pause, resume and the ending causes, and the HTTP run asserts at least one replayed frame so a transport that connects and delivers nothing cannot pass.
- [ ] **Contract seam.** The runner can fail: deleting the `seen` advance from one transport makes the HTTP run red. This is the criterion that proves the runner is not a second vacuous pass.
- [ ] **Contract seam.** Purge impact, purge and restore are each called and asserted through the interface: impact reports the counts the purge then removes, restore is additive and idempotent, and a purge leaves principals and grants untouched. Three members with no behavioural assertion anywhere in the interface suite today.
- [ ] **Contract seam.** Reading held permissions is called and asserted for a principal holding a board grant, one holding only a workspace grant, and one holding neither — the operation whose `none` requirement makes it the one that always answers.
- [ ] **Contract seam.** The conformance file contains no duplicated case: its own case count matches its distinct assertions, and the resume case asserts cross-thread re-delivery rather than the presence of a number.

**Leaves the build green:** yes, on top of 17, 18 and 21.
