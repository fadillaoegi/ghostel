# Design — Milestone 1: Check-in and live lobby

## Overview
```
apps/web (React + R3F)  ──HTTP /api──▶  apps/server (Fastify) ──▶ PostgreSQL (guests)
          │                                   │
          └────────── WebSocket /ws ─────────▶ PresenceHub (in memory)
                       both import packages/shared (schemas, layout, movement rules)
```
In development Vite (port 5290) proxies `/api` and `/ws` to the server (port 2590), so the browser sees one origin and cookies are first-party. In production the server serves `apps/web/dist` itself for the same reason. This avoids third-party cookie problems (Safari blocks them).

## Transport choice
`ws` instead of Colyseus. Colyseus is at 0.18 with schema 5, which the team has not used, and its room/schema layer would hold domain state outside `packages/shared`. With `ws` the protocol is a small zod-validated union in `packages/shared`, authentication happens on the HTTP upgrade with the same cookie, and later rooms/games stay plain TypeScript. Cost: we write our own room fan-out and reconnect, which is small at this scale (≈50 concurrent guests).

## packages/shared
- `profile.ts` — `normalizeName`, `validateName` → `{ ok, value } | { ok: false, message }`; look enums and `lookSchema`; `randomLook(rng)`; `DEFAULT_LOOK`.
- `layout.ts` — lobby geometry: `LOBBY_BOUNDS` (x −14..14, z −10..10), obstacles (6 pillars, reception desk box, fountain), spawn points. Decoration placement is visual only and lives in `apps/web`.
- `movement.ts` — `resolveMove(state, target, dtSeconds)` → `{ pos, budget, corrected }`: rejects non-finite input, limits travel with a movement budget that refills at `MAX_SPEED` (5 u/s) and caps at 2.5 units, clamps to bounds inset by player radius, pushes out of obstacles. `constrainToWorld` is shared with the client for prediction.
- `protocol.ts` — zod schemas for client → server messages (`move`) and TypeScript types for server → client messages (`welcome`, `join`, `leave`, `snap`, `profile`, `correct`, `error`). `parseClientMessage(raw)` returns a typed result.

## Server
- `config.ts` — reads env (`PORT`, `HOST`, `DATABASE_URL`, `ALLOWED_ORIGINS`, `NODE_ENV`), fails fast on missing values.
- `db/pool.ts`, `db/migrate.ts` (ordered SQL files in `db/migrations/`, tracked in `schema_migrations`), `db/guests.ts` repository.
- Table `guests(id uuid pk default gen_random_uuid(), token_hash bytea unique not null, name text not null, look jsonb not null, created_at, updated_at, last_seen_at)`.
- `http/session.ts` — cookie `ghostel_sid`: 32 random bytes base64url; HttpOnly, SameSite=Lax, Path=/, Max-Age 180 days, Secure in production. Lookup by `sha256(token)`.
- Routes:
  - `GET /api/health` → `{ ok: true }`.
  - `GET /api/me` → `{ guest: { name, look } | null }`.
  - `PUT /api/me` body `{ name, look }` → validates; updates the cookie's guest or creates a new one and sets the cookie. Returns `{ guest }`. Errors: 400 `{ error, field, message }`. Notifies `PresenceHub.updateProfile(guestId, profile)`.
  - Origin check on non-GET requests; body limit 4 KB; simple per-IP rate limit on `PUT /api/me` (30/min).
- `realtime/hub.ts` — `PresenceHub`:
  - On upgrade: check Origin, resolve guest from cookie, enforce max 3 connections per guest, otherwise respond 401/403 before upgrading.
  - Each connection: `publicId` (random 9-byte base64url), guestId, profile, position, last accepted time, token bucket (40 msgs/s burst 60), invalid-message counter (close after 20).
  - `move` → `resolvePosition`; if corrected → send `correct` to sender; mark dirty.
  - Tick 15 Hz: broadcast `snap` with dirty players `[id, x, z, ry]`.
  - Close → `leave` broadcast. Heartbeat ping every 15 s, terminate dead sockets.
  - `maxPayload` 1 KB.

## Web
- Screens: `Loading` → `Creator` (no guest or editing) → `Lobby`.
- `api.ts` — fetch wrappers with `credentials: 'same-origin'`.
- `net/presence.ts` — WebSocket client store (zustand-free, a tiny subscribable store) holding remote players with interpolation buffers; reconnect with backoff.
- `three/Avatar.tsx` — low-poly character built from primitives with `flatShading`; parts selected by look enums.
- `three/Lobby.tsx` — hall: checker floor, walls with arched windows and moon, pillars, reception desk, fountain, pumpkins with flickering point lights, lanterns, bats flying, fog, purple/orange lighting.
- `three/Player.tsx` — local player: reads keyboard/joystick input, applies shared `resolvePosition`, sends `move` at 20 Hz when changed, applies server `correct`.
- `three/RemotePlayer.tsx` — interpolates to latest snapshot (~100 ms delay).
- Name tags: DOM elements in an overlay above the canvas, positioned each frame by `TagProjector` (`three/nametags.tsx`). drei `Html` was tried first; with drei 10.7.9 + React 19.3 its portal div mounted but stayed empty, so it was replaced.
- `ui/Joystick.tsx` — pointer-events virtual joystick, shown on touch devices.
- HUD: guest count, "Edit costume" button, connection status.
- Fonts: `@fontsource/creepster` (title) and `@fontsource/nunito` (UI), both OFL.

## Testing
- Unit (Vitest, `packages/shared`): name rules, look schema, movement (bounds, obstacles, speed, NaN/Infinity), protocol parsing.
- Integration (Vitest, `apps/server`, real PostgreSQL `ghostel_test`): session create/reload, profile isolation between two cookies, invalid name 400 message, invalid look 400, WS upgrade rejected without cookie / bad origin, welcome/join/leave, fake out-of-bounds move clamped and corrected, profile change broadcast.
- E2E (Playwright, Chromium): two browser contexts create characters, see each other's name tags, movement of one changes the other's view, rename propagates, closing a page removes the character, reload keeps profile. Desktop and phone (390×844) screenshots saved to `docs/evidence/`.

## Risks
- Headless WebGL: SwiftShader rendered the lobby at 2–5 fps and made E2E time out. On macOS the Playwright config uses ANGLE Metal (61 fps measured on Apple M1); other platforms fall back to SwiftShader. E2E asserts DOM name tags and HUD, not pixels.
- Free hosting cold start (see product steering).
