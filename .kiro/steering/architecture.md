# Architecture

## Layout (pnpm monorepo)
- `packages/shared` — domain rules, validation (zod), wire protocol types, building layout, movement rules, later game rules. Pure TypeScript. Must not import React, DOM APIs, `ws`, `pg` or any Node-only module.
- `apps/server` — Node + TypeScript. Fastify for HTTP (`/api/*`), `ws` for realtime (`/ws`), `pg` for PostgreSQL. In production it also serves the built web app so everything is same-origin.
- `apps/web` — React + TypeScript strict + Vite + React Three Fiber (`@react-three/fiber`, `@react-three/drei`).

## Server layering
- `domain` logic lives in `packages/shared`.
- `apps/server/src/db` — repositories (SQL only, parameterized).
- `apps/server/src/http` — Fastify routes, cookie session.
- `apps/server/src/realtime` — WebSocket hub: presence, movement authority, broadcast.
- `apps/server/src/app.ts` wires them together; `main.ts` reads config and starts.

## Realtime model
- The client sends its desired position at up to 20 Hz. The server validates (finite numbers, building bounds, obstacles, max speed), stores the accepted position, and broadcasts snapshots at a fixed tick. Rejected or clamped moves get a `correct` message back to the sender.
- Presence is keyed by connection (one avatar per tab), each connection belongs to one guest. Public IDs sent to clients are per-connection random IDs, never the guest ID or cookie token.
- Position, presence, seats, calls, running games, presentations (including PDF slides) and chat stay in server memory. PostgreSQL 18 stores guest profiles (name, look, found candies) and rooms (door, capacity, access, argon2 password hash). Migrations are append-only in `apps/server/src/db/migrate.ts`.
- Channels: "lobby", "floor:2".."floor:5" and "room:<id>". Every broadcast goes through a channel. Calls are a room channel or one table on a floor (`<channel>#<table>`); signaling is relayed only inside one call.
- Media is peer-to-peer WebRTC (mesh). The server only relays signaling and announces stream ids.

## Conventions
- TypeScript `strict`, no `eval`, no `any` unless justified in a comment.
- ESM everywhere. Node 24.
- Local ports (avoid 5178, 5179, 8098, 5478 used by the old project): web 5290, server 2590, PostgreSQL 18 in Docker 5490, E2E server 2595, production smoke test 2597.
- Tests: Vitest for unit and server integration (real PostgreSQL), Playwright for browser tests (fake microphone, camera and screen), `node --test` for the Kiro hook scripts.
