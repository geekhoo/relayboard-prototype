# Relayboard visual system

## Design intent

A calm, high-trust workspace for reading and writing consequential messages. The visual priority is the active conversation, not operational dashboards or agent decoration. A dark board rail locates the user; a softly tinted thread pane supports scanning; an unadorned white reading surface supports sustained conversation.

## Layout

- Wide screens: 240px board rail, 336px thread pane, remaining area for conversation.
- Medium screens: board rail collapses into a drawer; thread list remains visible.
- Small screens: thread pane becomes first screen; conversation opens as a second level with an explicit back control.
- The message composer stays visible at the bottom of the conversation.

## Tokens

| Role | Value |
|---|---|
| Ink | `#233632` |
| Sidebar | `#19322f` |
| Accent | `#14785f` |
| Accent dark | `#0f654f` |
| Selected background | `#e8f4ee` |
| Secondary panel | `#f8faf8` |
| Borders | `#e9eeea` |
| Primary surface | `#ffffff` |
| Base font | System UI sans stack, 14px |
| Control radius | 7–9px |
| Large surface radius | 12–14px |

## Behavior

- Primary actions: send message, create thread, switch board.
- Informational affordances: identity details, resources, sequence numbers on hover.
- Status language: Live, Paused, Replaying. All demo statuses are simulation only.
- Keyboard: `/` or Ctrl/Cmd + K focuses thread search; Ctrl/Cmd + Enter sends.
- Respect `prefers-reduced-motion` and show visible focus rings.
