# Product: Ghostel

Ghostel is a virtual, low-poly 3D haunted hotel. Tagline (working): "Check in. Hang out. Play till dawn."

## Competition
- Kiroween 2026 on Devpost. Target category: Costume Contest (striking, memorable UI). Fallback: Frankenstein.
- Official deadline recorded on 2026-11-05: 2026-12-04 14:00 PT (2026-12-05 05:00 WIB). Personal target: 2026-12-03 21:00 WIB.
- Submission requirements recorded on 2026-11-05 (re-check the official rules before submitting): meaningful Kiro usage, `.kiro` folder at repo root, working app URL, public GitHub repo with an open source license, YouTube demo video under 3 minutes.

## Product decisions (confirmed)
- No login. Users are guests identified by an HttpOnly cookie. Identity is the guest ID, never the display name. Names can change at any time.
- Characters are visible to other guests in realtime while walking through the building.
- Communication: text chat, voice, camera and screen share. Camera, microphone and screen share are always off until the user turns them on (decided by the owner on 2026-11-08; before that the rule was "no video"). Media is peer-to-peer WebRTC (mesh), so calls stay small: tables seat 2 or 4, rooms hold 2–8 guests. Larger video calls would need an SFU such as LiveKit Cloud (needs an account; not planned yet).
- Seats (2026-11-08): every floor has tables for 2 and 4, the canteen has many, and every room has one long table with as many seats as the room's capacity. Sitting at a floor table joins that table's call and opens a Zoom-like meeting view. In a room, everyone in the room shares one call; sitting at the long table only opens the meeting view.
- Presentations (2026-11-08): anyone in a room can ask to present; the room owner approves or refuses and can stop a presentation at any time. One presenter at a time, by screen share (desktop browsers only) or by PDF slides.
- Floors (2026-11-08): 1 Grand Lobby, 2 Hall of Portraits, 3 Moonlit Greenhouse, 4 Ghoul's Diner (canteen, order a snack at the counter), 5 Rooftop Graveyard with the night city below. Room doors stay on floors 1–3.
- Phones (2026-11-08): touch screens get an on-screen gamepad (analog stick on the left, context action buttons on the right) in portrait and landscape. Physical gamepads are supported through the Gamepad API.
- Visual style: low-poly 3D.
- Built fresh with Kiro. Do not copy code from the old Ghost Turtle Kit project.
- Stack: option A, full TypeScript pnpm monorepo (confirmed 2026-11-07, see `architecture.md`).
- First game: Pumpkin Trivia (Halloween quiz, playable against a bot). Confirmed by the owner on 2026-11-07 ("sesuai kamu rekomendasikan").
- Rooms are separate 3D scenes reached through the lobby's room doors, not areas inside the lobby. Confirmed 2026-11-07. Each room is its own realtime channel.
- Hosting (tentative, to be verified before deploy): single Node service on Render Free serving web + API + WebSocket, PostgreSQL on Neon Free. Risk: Render Free spins down after 15 minutes without inbound HTTP or WebSocket traffic and cold starts take roughly a minute. Mitigation: "waking the ghosts" loading screen plus a scheduled ping during judging.

## Milestones (each must be demoable before moving on)
1. Low-poly character creation and guest name.
2. Explorable building with other characters visible in realtime.
3. Chat in the central hall.
4. Create rooms, lock them, set a password (checked on the server).
5. Voice inside rooms.
6. One polished shared game, with a system that allows more games.
7. Decorations, atmosphere, effects and NPC ghosts so the building never feels empty for a solo judge.
8. If time allows: a second game or proximity voice.

Owner-requested milestones added later (specs in `.kiro/specs/`): M8 floors and music, M9 room doors, night city and monster variety, M10 Ghoul's Diner and the rooftop on floor 5, M11 phone gamepad and landscape, M12 seats, table calls and the meeting view, M13 camera, M14 presentations (screen share and PDF slides).
