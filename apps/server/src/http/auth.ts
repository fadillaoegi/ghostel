import type { FastifyRequest } from "fastify";
import type { Guest, GuestRepository } from "../db/guests";
import { hashSessionToken, isWellFormedToken, sessionCookieName } from "./session";

export type GuestResolver = (request: FastifyRequest) => Promise<Guest | null>;

/** The only way routes learn who is calling: the session cookie, looked up by token hash. */
export function makeGuestResolver(guests: GuestRepository, production: boolean): GuestResolver {
  const cookieName = sessionCookieName(production);
  return async (request) => {
    const token = request.cookies[cookieName];
    if (!isWellFormedToken(token)) return null;
    return guests.findByTokenHash(hashSessionToken(token));
  };
}
