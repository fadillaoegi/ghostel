# Design — M23

## Shared (`packages/shared/src/chat.ts`, `protocol.ts`)
- `CHAT_HISTORY` 50 → **500** (kept per channel per day). New `CHAT_PAGE = 15`.
- `CHAT_DAY_UTC_OFFSET_HOURS = 7` (WIB has no daylight saving time). `chatDay(at)` = `floor((at + offset) / 86 400 000)`, a pure day number.
- Client message `{ t: "chat_older", before: string }`, where `before` is a chat id (base36, max 16 characters).
- Server messages:
  - `welcome.chatMore: boolean`
  - `{ t: "chat_page", before, msgs, more }`
  - `{ t: "chat_reset" }`

## Server (`hub.ts`)
- `histories` stays per channel. `welcome` sends the newest `CHAT_PAGE` messages and `chatMore = history.length > CHAT_PAGE`.
- `chat_older`: looks up `before` in the history of `conn.channel` only. It returns up to 15 messages before it and `more`. If the id is unknown (for example after a reset or a scene change), it answers with `msgs: []` and `more: false`.
- `rollChatDay()`:
  - Compares `chatDay(clock())` with the stored day. On a change, it clears every history and sends `chat_reset` to every connection.
  - It runs before every chat, page request and welcome, and on a timer (`chatDayCheckMs`, default 10 s, shorter in tests). So the reset is deterministic even when nobody sends anything at midnight.

## Web
- `PresenceClient`:
  - `chatMore` and `chatLoading` in the snapshot.
  - `loadOlderChat()` sends `chat_older` with the oldest loaded chat id. `chat_page` prepends the new lines, without duplicates, and only if `before` still matches the oldest loaded id.
  - `chat_reset` empties `chat`, `chatMore` and `historyMark`.
  - `MAX_CHAT_LINES` rises to `CHAT_HISTORY + 100`, so loaded pages are not dropped.
- `ChatPanel`:
  - A `visible` count (starts at 15). A pure `visibleStart(lines, count)` gives the index from which `count` chat messages, and the notices after them, are shown.
  - At the bottom: new lines keep the view at the newest 15 and scroll down.
  - Near the top (scrollTop < 24 px), or a click on "Earlier messages": if hidden local lines exist, show 15 more; otherwise call `loadOlder`.
  - A layout effect keeps the scroll position after lines are prepended (`scrollTop += newHeight - oldHeight`).
