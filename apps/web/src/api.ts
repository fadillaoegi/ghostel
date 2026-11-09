import type { Profile, RoomAccess, RoomDecor, RoomFloor, RoomGame, RoomSummary } from "@ghostel/shared";

export type SaveResult = { ok: true; profile: Profile } | { ok: false; field: string; message: string };

export async function fetchMe(): Promise<Profile | null> {
  const res = await fetch("/api/me", { credentials: "same-origin", cache: "no-store" });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  const body = (await res.json()) as { guest: Profile | null };
  return body.guest;
}

export async function saveMe(profile: Profile): Promise<SaveResult> {
  let res: Response;
  try {
    res = await fetch("/api/me", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(profile),
    });
  } catch {
    return { ok: false, field: "body", message: "The hotel is unreachable. Check your connection and try again." };
  }
  const body = (await res.json().catch(() => ({}))) as { guest?: Profile; field?: string; message?: string };
  if (res.ok && body.guest) return { ok: true, profile: body.guest };
  return { ok: false, field: body.field ?? "body", message: body.message ?? `Something went wrong (${res.status}).` };
}

export type ApiResult<T> = { ok: true; value: T } | { ok: false; field: string; message: string };

async function call<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, field: "body", message: "The hotel is unreachable. Check your connection and try again." };
  }
  if (res.status === 204) return { ok: true, value: undefined as T };
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.ok) return { ok: true, value: data as T };
  return {
    ok: false,
    field: typeof data["field"] === "string" ? data["field"] : "body",
    message: typeof data["message"] === "string" ? data["message"] : `Something went wrong (${res.status}).`,
  };
}

export interface RoomForm {
  name: string;
  access: RoomAccess;
  decor: RoomDecor;
  game: RoomGame;
  /** Empty string means "keep the current password" on update. */
  password: string;
}

function roomBody(form: Partial<RoomForm>) {
  const { password, ...rest } = form;
  return form.access === "password" && password ? { ...rest, password } : rest;
}

export const roomsApi = {
  list: () => call<{ rooms: RoomSummary[] }>("GET", "/api/rooms"),
  /** `where` picks the floor and optionally the door; the server picks the first free one otherwise. */
  create: (form: RoomForm, where: { floor?: RoomFloor; slot?: string; capacity?: number } = {}) =>
    call<{ room: RoomSummary }>("POST", "/api/rooms", { ...roomBody(form), ...where }),
  update: (id: string, form: Partial<RoomForm>) => call<{ room: RoomSummary }>("PATCH", `/api/rooms/${encodeURIComponent(id)}`, roomBody(form)),
  remove: (id: string) => call<void>("DELETE", `/api/rooms/${encodeURIComponent(id)}`),
};
