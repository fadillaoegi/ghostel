import { SNACKS, type SnackId } from "@ghostel/shared";
import { useEffect } from "react";

/** Ghoul's Diner menu. The server checks that the guest is really at the counter. */
export function SnackMenu({ onOrder, onClose }: { onOrder: (snack: SnackId) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      const n = Number(e.key);
      const pick = SNACKS[n - 1];
      if (pick) onOrder(pick.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOrder, onClose]);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Ghoul's Diner menu" data-testid="snack-menu">
      <div className="panel modal-panel">
        <header className="modal-head">
          <h2>🍽️ Midnight menu</h2>
          <button type="button" className="chat-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </header>
        <p className="field-hint">Everything is free. Chef Bones insists. Your snack stays in your hand for about a minute.</p>
        <ul className="snack-list">
          {SNACKS.map((s, i) => (
            <li key={s.id}>
              <button type="button" className="snack-btn" onClick={() => onOrder(s.id)} aria-label={`Order ${s.name}`}>
                <span className="snack-emoji" aria-hidden>
                  {s.emoji}
                </span>
                <span>{s.name}</span>
                <kbd aria-hidden>{i + 1}</kbd>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
