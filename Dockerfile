# Ghostel production image: one Node server that serves the web build, the API and the WebSocket.
# Used by compose.vps.yaml. The demo video package (submission/video) is not installed.
ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS build
RUN corepack enable
WORKDIR /app
COPY . .
# NODE_ENV=development so pnpm installs the build tools (Vite, esbuild).
RUN NODE_ENV=development pnpm install --frozen-lockfile --filter "@ghostel/server..." --filter "@ghostel/web..." \
  && pnpm build

FROM node:${NODE_VERSION} AS deps
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --prod --filter "@ghostel/server..."

FROM node:${NODE_VERSION}
ENV NODE_ENV=production HOST=127.0.0.1 PORT=8108
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /app/packages/shared ./packages/shared
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY package.json ./
USER node
CMD ["node", "apps/server/dist/main.js"]
