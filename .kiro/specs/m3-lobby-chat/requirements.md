# Requirements — Milestone 3: Lobby chat

Text chat in the Grand Lobby, shown in a chat panel and as speech bubbles above characters.

## Requirement 1 — Sending messages
**User story:** As a guest, I want to type a message so everyone in the lobby can read it.
1. THE chat panel SHALL have a text field and a send button; Enter sends, Escape leaves the field.
2. WHEN a guest presses Enter in the lobby while not typing, THE chat field SHALL get focus (desktop).
3. WHILE the chat field has focus, movement keys SHALL type text and SHALL NOT move the character.
4. ON touch screens, THE chat SHALL open from a chat button so it does not cover the joystick by default.

## Requirement 2 — Server validation
**User story:** As the hotel, I want chat to stay readable and safe.
1. THE server SHALL normalise text: whitespace runs (including newlines) become one space, trimmed; control characters, bidirectional override characters and BOM removed; combining-mark runs capped at 2 per base character.
2. IF the normalised text is empty or longer than 200 characters, THEN THE server SHALL reject it with an `error` message carrying a clear reason, and SHALL NOT broadcast it.
3. THE server SHALL rate limit chat per guest across all of that guest's tabs (burst 5, then 1 message every 2 s). Over the limit, THE server SHALL reply with an `error` ("Slow down…") and SHALL NOT broadcast.
4. THE server SHALL attach the sender's public connection ID and current display name; the client SHALL NOT be able to choose the sender.
5. Chat is kept in memory only (architecture rule). THE server SHALL keep the last 50 lobby messages and SHALL send them in `welcome`.

## Requirement 3 — Receiving messages
**User story:** As a guest, I want to notice and read what others say.
1. WHEN a chat message arrives, THE client SHALL append it to the chat log (newest at the bottom, auto-scroll) and SHALL show it as a speech bubble above the sender for about 6 seconds.
2. THE chat log SHALL show join and leave notices ("Bob checked in", "Bob checked out"), generated on the client from presence events.
3. WHEN the chat is collapsed (phone), THE chat button SHALL show the number of unread messages.
4. Text SHALL always be rendered as text, never as HTML.

## Acceptance criteria
- A message from one guest appears in the other guest's log and as a bubble above the sender.
- Empty, too-long and flooded messages are rejected by the server and never reach other guests.
- Renaming changes the name on new messages, not on old ones.
- A guest who joins later sees recent history.
- Usable on desktop and phone.
