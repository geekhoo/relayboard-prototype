# 20: The interface, and the code's own guards, stop claiming what the build does not do

**What to build:** Five claims the build does not keep, all of them one line wide. The stream panel does not call an in-memory history durable, and a transport that has failed does not go on reading "Live". The expired-admission copy does not instruct the reader to renew with a credential no browser surface holds and no client operation offers. The frame's interim placeholder copy is gone. The transport module stops documenting a keep-alive frame it never sends. The dead error class whose docstring says three acts are unimplemented — they are implemented — is removed. And the guard that is supposed to catch a branch on `kind` catches one, whatever shape the comparison is written in, because a guard that only matches string literals is a green light over the rule `AGENTS.md` calls a bug.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Found by:** product F1 at `src/components/StreamPanel.tsx:235`; product F4 at `src/client/http.ts:441-456`, consumed by nothing at `src/components/-conversation-queries.ts:139`; security F10 at `src/components/StreamPanel.tsx:308-310`; product F16 at `src/components/WorkspaceFrame.tsx:124-128,149-153`; architecture F13 at `src/server/stream.ts:106-107` and `src/routes/api/stream.ts:217-226`; architecture F14 at `src/client/index.ts:586-603` and `src/client/in-memory.ts:23,55-56`; security F13 at `tests/permissions.test.ts:329-331`.

- [ ] **Route seam.** While the stream is connected, no rendered copy in the stream panel claims that history is durable, persistent or survives anything; the assertion reads the rendered panel against the frame's own note that a restart clears the workspace, so two surfaces of one product cannot contradict each other. It must fail on the word the panel uses today.
- [ ] **Route seam.** A transport failure renders as disconnected rather than "Live": the indicator's rendered state changes when the stream reports an error and the panel's copy names the disconnect. The test breaks the transport and asserts what is on screen, not that an event was emitted.
- [ ] **Unit/domain seam.** The client's stream-error event has a consumer whose observable is the connection state; the assertion fails if the event type is dropped from the handler, which is exactly how this shipped.
- [ ] **Route seam.** The expired-access copy names an act this interface offers — asking a gate holder for a new admission — and carries no instruction to renew with a credential. The test pairs the copy with the gate surface, which exposes no renewal, so sentence and capability cannot drift apart again.
- [ ] **Route seam.** No interim placeholder copy renders in any state the frame can reach; the test walks the frame's states and matches the placeholders' text, so a refactor that makes one reachable fails here rather than shipping.
- [ ] **Unit/domain seam.** The documented frame vocabulary and the frames the transport can produce agree: either a keep-alive frame is emitted and asserted on an idle connection, or the claim is removed. The criterion is that the two cannot disagree, not which way it goes.
- [ ] **Unit/domain seam.** No exported error class or docstring describes a state the code is not in: the "arrives with a later ticket" class is gone and nothing throws it, asserted by the build's type check plus a test that the interface's members are all served.
- [ ] **Unit/domain seam.** The `kind` guard detects a branch on `kind` through a variable as well as through a literal: a fixture written as a variable comparison is reported by the scan, and the scan still reports the sanctioned gate comparison it is meant to allow. Both directions asserted, because a scan that reports everything is as useless as one that reports nothing.

**Leaves the build green:** yes.
