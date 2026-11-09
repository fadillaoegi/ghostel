import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { MAX_CLIENT_FRAME_BYTES } from "@ghostel/shared";
import { WebSocketServer } from "ws";
import type { Guest } from "../db/guests";
import type { PresenceHub } from "./hub";

export interface UpgradeDeps {
  server: Server;
  hub: PresenceHub;
  allowedOrigins: ReadonlySet<string>;
  /** Resolves the guest for the request's session cookie, or null. */
  authenticate: (request: IncomingMessage) => Promise<Guest | null>;
  onConnected?: (guest: Guest) => void;
}

const STATUS_TEXT: Record<number, string> = {
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  429: "Too Many Requests",
  500: "Internal Server Error",
  503: "Service Unavailable",
};

function refuse(socket: Duplex, status: number): void {
  socket.end(`HTTP/1.1 ${status} ${STATUS_TEXT[status] ?? "Error"}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

/** Authenticates `/ws` upgrades with the session cookie and Origin before handing them to the hub. */
export function attachWebSocket(deps: UpgradeDeps): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_CLIENT_FRAME_BYTES, perMessageDeflate: false });

  deps.server.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    socket.on("error", () => socket.destroy());
    const path = (request.url ?? "").split("?")[0];
    if (path !== "/ws") return refuse(socket, 404);
    const origin = request.headers.origin;
    if (!origin || !deps.allowedOrigins.has(origin)) return refuse(socket, 403);

    deps
      .authenticate(request)
      .then((guest) => {
        if (!guest) return refuse(socket, 401);
        const admit = deps.hub.canAdmit(guest.id);
        if (!admit.ok) return refuse(socket, admit.status);
        wss.handleUpgrade(request, socket, head, (ws) => {
          deps.hub.attach(ws, guest.id, { name: guest.name, look: guest.look }, guest.candies);
          deps.onConnected?.(guest);
        });
      })
      .catch(() => refuse(socket, 500));
  });

  return wss;
}
