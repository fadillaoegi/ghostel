import type { PublicRoom } from "@ghostel/shared";
import { useEffect, useState, type FormEvent } from "react";
import { roomsApi, type RoomForm } from "../api";
import { RoomFormFields } from "./RoomDirectory";

/** Owner-only settings. The server re-checks ownership on every request. */
export function RoomSettings({ room, onClose }: { room: PublicRoom; onClose: () => void }) {
  const [form, setForm] = useState<RoomForm>({ name: room.name, access: room.access, decor: room.decor, game: room.game, password: "" });
  const [error, setError] = useState<{ field: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await roomsApi.update(room.id, form);
    setBusy(false);
    if (result.ok) onClose();
    else setError(result);
  }

  async function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    const result = await roomsApi.remove(room.id);
    setBusy(false);
    if (!result.ok) setError(result);
    // On success the server moves everyone (including us) back to the lobby.
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Room settings" data-testid="room-settings">
      <form className="panel modal-panel room-form" onSubmit={save} noValidate>
        <header className="modal-head">
          <h2>⚙️ Room settings</h2>
          <button type="button" className="chat-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </header>
        <RoomFormFields form={form} setForm={setForm} error={error} hasPassword={room.access === "password"} />
        <div className="actions">
          <button type="button" className="btn btn--danger" onClick={remove} disabled={busy}>
            {confirmDelete ? "Really delete?" : "🗑️ Delete room"}
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
