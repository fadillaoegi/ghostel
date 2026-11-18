# Requirements — Milestone 23: chat shows 15 messages, infinite scroll, and a daily reset

Written before the code, on 2026-11-16.

Owner request (2026-11-16, Indonesian, with a screenshot of the Lobby chat panel): limit what is shown to 15 chats, add infinite scroll, and empty the chat again every day.

## Today
- The server keeps the last 50 messages per channel in memory and sends all of them in `welcome`.
- Lobby chat is never emptied. Floor and room chat are emptied when the last guest leaves.
- The panel shows every line the client has (up to 100, including "arrived" and "left" notices).

## What
1. **15 at a time.**
   - On entering a channel, the server sends only the newest 15 messages, plus whether older ones exist.
   - While the reader is at the bottom (following the conversation), the panel shows the newest 15 messages. Notices between them are shown too and do not count.
2. **Infinite scroll.**
   - Scrolling to the top of the log shows 15 older messages. If the client does not have them yet, it asks the server for them.
   - The scroll position stays where the reader was.
   - When the log is too short to scroll, a small "Earlier messages" button at the top does the same, so it also works with a keyboard and on phones.
   - When nothing older exists, the button disappears.
3. **Daily reset.**
   - Every day at **00:00 WIB (UTC+7, Asia/Jakarta)**, the server empties the chat history of every channel and tells every connected guest. Their panels become empty ("It's quiet here… say boo!").
   - Messages sent after midnight start the new day.
   - The reset also happens if the server was asleep at midnight: the history never contains messages from an earlier WIB day.
4. **Limits.**
   - The server keeps at most 500 messages per channel per day in memory. Older ones fall off, as before.
   - A page request is answered with at most 15 messages.

## Security
- A guest can only page through the history of the channel they are in now. A room's chat never goes to non-members, as before.
- Page requests go through the existing per-connection message rate limit, and the `before` id is validated by the schema.
- Chat stays in server memory only. Nothing is written to the database.

## Done when
- Server integration tests cover: welcome has 15 messages and the "more" flag; paging back to the first message; a page request from another channel gets nothing from this one; the reset at midnight WIB clears the history and notifies connected guests.
- A web unit test covers the "which lines are visible" rule.
- The existing chat E2E still passes, plus one E2E for loading earlier messages.
- Typecheck, unit, integration and build pass.
