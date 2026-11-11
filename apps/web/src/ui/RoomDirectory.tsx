import {
  DOOR_SLOTS,
  ROOM_ACCESS,
  ROOM_CAPACITY,
  ROOM_CAPACITY_DEFAULT,
  ROOM_CAPACITY_MIN,
  ROOM_DECORS,
  ROOM_FLOORS,
  ROOM_GAMES,
  ROOM_NAME_MAX,
  ROOM_PASSWORD_MAX,
  isRoomFloor,
  type RoomAccess,
  type RoomDecor,
  type RoomFloor,
  type RoomGame,
  type RoomSummary,
} from "@ghostel/shared";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { roomsApi, type RoomForm } from "../api";

export const ACCESS_LABELS: Record<RoomAccess, string> = { open: "🔓 Open", locked: "🔒 Locked", password: "🔑 Password" };
export const DECOR_LABELS: Record<RoomDecor, string> = { crypt: "⚰️ Crypt", library: "📚 Haunted library", ballroom: "🕯️ Ballroom" };
export const GAME_LABELS: Record<RoomGame, string> = { none: "💬 Just hang out", pumpkin_trivia: "🎃 Pumpkin Trivia", monster_pairs: "🃏 Monster Pairs" };

function Choice<T extends string>({
  label,
  options,
  labels,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <fieldset className="field">
      <legend id={id}>{label}</legend>
      <div className="chips" role="radiogroup" aria-labelledby={id}>
        {options.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={value === o} className={value === o ? "chip chip--on" : "chip"} onClick={() => onChange(o)}>
            {labels[o]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Shared by "create room" and "room settings". Passwords live only in this form's state until submit. */
export function RoomFormFields({
  form,
  setForm,
  error,
  hasPassword,
}: {
  form: RoomForm;
  setForm: (f: RoomForm) => void;
  error: { field: string; message: string } | null;
  /** Editing a room that already has a password: leaving the field empty keeps it. */
  hasPassword: boolean;
}) {
  const nameId = useId();
  const pwId = useId();
  return (
    <>
      <div className="field">
        <label htmlFor={nameId}>Room name</label>
        <input
          id={nameId}
          value={form.name}
          maxLength={ROOM_NAME_MAX + 10}
          placeholder="e.g. The Pumpkin Patch"
          aria-invalid={error?.field === "name"}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        {error?.field === "name" && (
          <p className="field-error" role="alert">
            {error.message}
          </p>
        )}
      </div>
      <Choice label="Theme" options={ROOM_DECORS} labels={DECOR_LABELS} value={form.decor} onChange={(decor) => setForm({ ...form, decor })} />
      <Choice label="Activity" options={ROOM_GAMES} labels={GAME_LABELS} value={form.game} onChange={(game) => setForm({ ...form, game })} />
      <Choice label="Who can enter" options={ROOM_ACCESS} labels={ACCESS_LABELS} value={form.access} onChange={(access) => setForm({ ...form, access })} />
      {form.access === "password" && (
        <div className="field">
          <label htmlFor={pwId}>Room password</label>
          <input
            id={pwId}
            type="password"
            autoComplete="new-password"
            value={form.password}
            maxLength={ROOM_PASSWORD_MAX + 10}
            placeholder={hasPassword ? "Leave empty to keep the current password" : "4–64 characters"}
            aria-invalid={error?.field === "password"}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          {error?.field === "password" && (
            <p className="field-error" role="alert">
              {error.message}
            </p>
          )}
        </div>
      )}
      {error && error.field !== "name" && error.field !== "password" && (
        <p className="field-error" role="alert">
          {error.message}
        </p>
      )}
    </>
  );
}

function PasswordPrompt({
  room,
  error,
  onSubmit,
  onCancel,
}: {
  room: RoomSummary;
  error: string | null;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  useEffect(() => input.current?.focus(), []);
  // Clear the field after a failed attempt so the old guess does not linger.
  useEffect(() => {
    if (error) setPassword("");
  }, [error]);
  return (
    <form
      className="password-prompt"
      onSubmit={(e) => {
        e.preventDefault();
        if (password) onSubmit(password);
      }}
    >
      <h3>🔑 {room.name}</h3>
      <label htmlFor={id}>Password</label>
      <input id={id} ref={input} type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Back
        </button>
        <button type="submit" className="btn btn--primary" disabled={!password}>
          Unlock
        </button>
      </div>
    </form>
  );
}

const EMPTY_FORM: RoomForm = { name: "", access: "open", decor: "crypt", game: "pumpkin_trivia", password: "" };

/** Why the directory was opened from a door: book that vacant door, or unlock that room. */
export type DirectoryIntent = { kind: "create"; floor: RoomFloor; slot: string } | { kind: "unlock"; roomId: string };

const FLOOR_LABELS: Record<RoomFloor, string> = { 1: "1F · Lobby", 2: "2F · Portraits", 3: "3F · Greenhouse" };

export const roomCode = (room: { floor: number; slot: string }) => `${room.floor}${room.slot}`;

/** Floor and door choice for a new room. Taken doors come from the room list; the server has the final say. */
function DoorPicker({
  rooms,
  where,
  setWhere,
}: {
  rooms: readonly RoomSummary[] | null;
  where: { floor: RoomFloor; slot: string | null };
  setWhere: (w: { floor: RoomFloor; slot: string | null }) => void;
}) {
  const floorId = useId();
  const doorId = useId();
  const taken = new Set((rooms ?? []).map(roomCode));
  const free = (f: RoomFloor) => DOOR_SLOTS[f].filter((s) => !taken.has(`${f}${s}`)).length;
  return (
    <>
      <fieldset className="field">
        <legend id={floorId}>Floor</legend>
        <div className="chips" role="radiogroup" aria-labelledby={floorId}>
          {ROOM_FLOORS.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={where.floor === f}
              className={where.floor === f ? "chip chip--on" : "chip"}
              onClick={() => setWhere({ floor: f, slot: null })}
            >
              {FLOOR_LABELS[f]} <span className="chip-note">{free(f)} free</span>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="field">
        <legend id={doorId}>Door</legend>
        <div className="chips" role="radiogroup" aria-labelledby={doorId}>
          <button
            type="button"
            role="radio"
            aria-checked={where.slot === null}
            className={where.slot === null ? "chip chip--on" : "chip"}
            onClick={() => setWhere({ ...where, slot: null })}
          >
            Any free door
          </button>
          {DOOR_SLOTS[where.floor].map((s) => {
            const code = `${where.floor}${s}`;
            const isTaken = taken.has(code);
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={where.slot === s}
                aria-label={isTaken ? `Door ${code} (taken)` : `Door ${code}`}
                disabled={isTaken}
                className={where.slot === s ? "chip chip--on" : "chip"}
                onClick={() => setWhere({ ...where, slot: s })}
              >
                {code}
              </button>
            );
          })}
        </div>
      </fieldset>
    </>
  );
}

/** How many guests the room holds; its long table gets that many chairs. */
function CapacityPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const id = useId();
  const sizes = Array.from({ length: ROOM_CAPACITY - ROOM_CAPACITY_MIN + 1 }, (_, i) => ROOM_CAPACITY_MIN + i);
  return (
    <fieldset className="field">
      <legend id={id}>Seats at the long table</legend>
      <div className="chips" role="radiogroup" aria-labelledby={id}>
        {sizes.map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} seats`} className={value === n ? "chip chip--on" : "chip"} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
      </div>
      <p className="field-hint">Also the most guests the room lets in. It cannot change later.</p>
    </fieldset>
  );
}

export function RoomDirectory({
  onEnter,
  onClose,
  enterError,
  intent = null,
  currentFloor = 1,
}: {
  onEnter: (roomId: string, password?: string) => void;
  onClose: () => void;
  enterError: { seq: number; roomId: string; code: string; message: string } | null;
  intent?: DirectoryIntent | null;
  /** New rooms default to this floor when it has rooms (floor 4 has none). */
  currentFloor?: number;
}) {
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "create">(intent?.kind === "create" ? "create" : "list");
  const [form, setForm] = useState<RoomForm>(EMPTY_FORM);
  const [where, setWhere] = useState<{ floor: RoomFloor; slot: string | null }>(
    intent?.kind === "create"
      ? { floor: intent.floor, slot: intent.slot }
      : { floor: isRoomFloor(currentFloor) ? currentFloor : 1, slot: null },
  );
  const [formError, setFormError] = useState<{ field: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [unlocking, setUnlocking] = useState<RoomSummary | null>(null);
  const [lastSeq, setLastSeq] = useState(enterError?.seq ?? 0);
  const [intentDone, setIntentDone] = useState(false);
  const [capacity, setCapacity] = useState(ROOM_CAPACITY_DEFAULT);

  const refresh = useCallback(async () => {
    const result = await roomsApi.list();
    if (result.ok) {
      setRooms(result.value.rooms);
      setLoadError(null);
    } else setLoadError(result.message);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // A fresh failure from the server for a password room opens (or keeps open) the prompt.
  const freshError = enterError && enterError.seq > lastSeq ? enterError : null;
  useEffect(() => {
    if (!freshError) return;
    if (freshError.code === "password_required" || freshError.code === "wrong_password" || freshError.code === "too_many_attempts") {
      const room = rooms?.find((r) => r.id === freshError.roomId);
      if (room) setUnlocking(room);
    }
  }, [freshError, rooms]);

  // Opened from a password door: go straight to that room's password prompt once the list is in.
  useEffect(() => {
    if (intentDone || !rooms) return;
    setIntentDone(true);
    if (intent?.kind === "unlock") {
      const room = rooms.find((r) => r.id === intent.roomId);
      if (room) setUnlocking(room);
    }
    // Not opened from a door: if this floor is fully booked, suggest the first floor with a free door.
    if (!intent) {
      const taken = new Set(rooms.map(roomCode));
      const hasFree = (f: RoomFloor) => DOOR_SLOTS[f].some((s) => !taken.has(`${f}${s}`));
      setWhere((w) => (hasFree(w.floor) ? w : { floor: ROOM_FLOORS.find(hasFree) ?? w.floor, slot: null }));
    }
  }, [intent, intentDone, rooms]);

  function enter(room: RoomSummary) {
    setLastSeq(enterError?.seq ?? 0);
    if (room.access === "password" && !room.mine) setUnlocking(room);
    else onEnter(room.id);
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await roomsApi.create(form, where.slot ? { floor: where.floor, slot: where.slot, capacity } : { floor: where.floor, capacity });
    setBusy(false);
    if (!result.ok) {
      setFormError(result);
      void refresh();
      return;
    }
    setForm(EMPTY_FORM);
    setFormError(null);
    // Owners walk straight into their new room.
    onEnter(result.value.room.id);
  }

  const promptError =
    enterError && unlocking && enterError.roomId === unlocking.id && enterError.seq > lastSeq ? enterError.message : null;
  const listError =
    enterError && enterError.seq > lastSeq && !unlocking ? enterError.message : null;

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Room directory" data-testid="room-directory">
      <div className="panel modal-panel">
        <header className="modal-head">
          <h2>{mode === "list" ? "🚪 Rooms" : where.slot ? `✨ New room · door ${where.floor}${where.slot}` : "✨ New room"}</h2>
          <button type="button" className="chat-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </header>

        {unlocking ? (
          <PasswordPrompt
            room={unlocking}
            error={promptError}
            onCancel={() => setUnlocking(null)}
            onSubmit={(password) => {
              setLastSeq(enterError?.seq ?? 0);
              onEnter(unlocking.id, password);
            }}
          />
        ) : mode === "list" ? (
          <>
            {listError && (
              <p className="field-error" role="alert">
                {listError}
              </p>
            )}
            {loadError && <p className="field-error">{loadError}</p>}
            {rooms === null ? (
              <p className="field-hint">Looking for open doors…</p>
            ) : rooms.length === 0 ? (
              <p className="empty-rooms">No rooms yet. Be the first to open one!</p>
            ) : (
              <ul className="room-list">
                {rooms.map((room) => (
                  <li key={room.id} className="room-card" data-testid="room-card">
                    <span className="room-code" title={`Door ${roomCode(room)}, floor ${room.floor}`}>
                      {roomCode(room)}
                    </span>
                    <div className="room-main">
                      <strong className="room-name">{room.name}</strong>
                      <span className="room-meta">
                        {ACCESS_LABELS[room.access]} · {DECOR_LABELS[room.decor]} · {GAME_LABELS[room.game]}
                      </span>
                      <span className="room-meta">
                        by {room.mine ? "you" : room.ownerName} · {room.occupants}/{room.capacity} inside
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={(room.access === "locked" && !room.mine) || (room.occupants >= room.capacity && !room.mine)}
                      onClick={() => enter(room)}
                      aria-label={`Enter ${room.name}`}
                    >
                      {room.access === "locked" && !room.mine ? "Locked" : "Enter"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="actions">
              <button type="button" className="btn btn--primary" disabled={rooms === null} onClick={() => setMode("create")}>
                ✨ Create a room
              </button>
            </div>
          </>
        ) : (
          <form className="room-form" onSubmit={create} noValidate>
            <DoorPicker rooms={rooms} where={where} setWhere={setWhere} />
            <CapacityPicker value={capacity} onChange={setCapacity} />
            <RoomFormFields form={form} setForm={setForm} error={formError} hasPassword={false} />
            <div className="actions">
              <button type="button" className="btn btn--ghost" onClick={() => setMode("list")}>
                Back
              </button>
              <button type="submit" className="btn btn--primary" disabled={busy}>
                {busy ? "Opening…" : "Open the room"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
