import { FLOORS, type FloorNumber } from "@ghostel/shared";
import { useEffect } from "react";

const ICONS: Record<FloorNumber, string> = { 1: "🛎", 2: "🖼", 3: "🎃", 4: "🍽", 5: "🌕" };

export function ElevatorPanel({ current, onPick, onClose }: { current: FloorNumber | null; onPick: (floor: FloorNumber) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      const n = Number(e.key);
      if (n >= 1 && n <= 5 && n !== current) onPick(n as FloorNumber);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, onPick, onClose]);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Elevator" data-testid="elevator-panel">
      <div className="panel modal-panel elevator">
        <header className="modal-head">
          <h2>🛗 Elevator</h2>
          <button type="button" className="chat-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </header>
        <ol className="floor-list">
          {[...FLOORS].reverse().map((f) => (
            <li key={f.floor}>
              <button
                type="button"
                className={f.floor === current ? "floor-btn floor-btn--here" : "floor-btn"}
                disabled={f.floor === current}
                aria-label={`Floor ${f.floor}: ${f.name}`}
                onClick={() => onPick(f.floor)}
              >
                <span className="floor-num">{f.floor}</span>
                <span className="floor-icon" aria-hidden>
                  {ICONS[f.floor]}
                </span>
                <span className="floor-text">
                  <strong>{f.name}</strong>
                  <small>{f.floor === current ? "You are here" : f.tagline}</small>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
