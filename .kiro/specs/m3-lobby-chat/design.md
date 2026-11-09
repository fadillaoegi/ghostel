# Design — Milestone 3: Lobby chat

## packages/shared
- `chat.ts`
  - `CHAT_MAX = 200`, `CHAT_HISTORY = 50`, `CHAT_BURST = 5`, `CHAT_REFILL_SECONDS = 2`.
  - `normalizeChat(raw)`: NFC → `\s+` to one space → remove `\p{Cc}`, `U+202A–202E`, `U+2066–2069`, `U+200E`, `U+200F`, `U+061C`, `U+FEFF` → cap combining marks (`\p{M}{3,}` → first 2) → trim.
  - `validateChat(raw: unknown): Result<string>` with messages "Type a message first." and "Messages can be at most 200 characters."
  - `ChatMessage { id: string; from: string; name: string; text: string; at: number }`.
- `protocol.ts`
  - Client → server: `{ t: "chat", text: string }` (raw string capped at 1000 UTF-16 units by the schema; the real limit is applied after normalising).
  - Server → client: `{ t: "chat", msg: ChatMessage }`; `welcome` gains `chat: ChatMessage[]`.
  - Error codes: `chat_invalid`, `chat_rate_limited`.

## Server (`realtime/hub.ts`)
- `chatBuckets: Map<guestId, { tokens, at }>`, a token bucket shared by all tabs of a guest. It is dropped when the guest's last connection closes.
- `history: ChatMessage[]` (ring of 50). `id` is a hub counter in base36.
- On `chat`: `validateChat` → on failure send `error chat_invalid` and count it as invalid (so floods of junk still close the socket). Then check the rate limit → if over, send `error chat_rate_limited` (not counted as invalid). Otherwise build the message with the connection's `publicId` and current `profile.name`, push it to history and broadcast it to everyone, including the sender (the echo is the delivery receipt).

## Web
- `PresenceClient` keeps `chat: ChatLine[]` (max 100 lines) where `ChatLine = { kind: "chat", msg } | { kind: "notice", id, text }`, `bubbles: Map<publicId, { id, text }>` (6 s timer) and `notice` for the last error. `welcome` replaces the chat lines with the server history.
- `sendChat(text)` returns `false` when the socket is not open.
- `ui/ChatPanel.tsx`
  - Desktop: panel at bottom-left, log (`role="log"`, `aria-live="polite"`) and input. Enter focuses the input from anywhere in the lobby.
  - Phone (`pointer: coarse`): 💬 button with an unread badge; when open, a bottom sheet replaces the joystick.
  - Sender name is coloured with that player's accent colour when known.
- Speech bubbles: the name-tag overlay renders a wrapper per player (`bubble` + `nametag`), anchored at the bottom centre.

## Testing
- Unit: `normalizeChat`/`validateChat` (whitespace, controls, bidi, zalgo, empty, length by code points), protocol parsing for `chat`.
- Integration: broadcast with server-chosen sender, empty/too-long rejected and not broadcast, rate limit per guest across two tabs, history in `welcome` for a late joiner, rename affects new messages only.
- E2E: two contexts exchange messages (log + bubble), phone opens the chat sheet and sends.
