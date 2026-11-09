import { useRef, useState, type PointerEvent } from "react";
import { input } from "../input/controls";

const RADIUS = 52;

/**
 * Floating analog stick for touch screens: touch anywhere in the left part of the screen and the stick
 * appears under your thumb. Writes a world-space vector into `input.joystick`.
 */
export function Joystick() {
  const origin = useRef<{ x: number; y: number; pointer: number } | null>(null);
  const [base, setBase] = useState<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  function update(e: PointerEvent<HTMLDivElement>) {
    const o = origin.current;
    if (!o || o.pointer !== e.pointerId) return;
    let dx = e.clientX - o.x;
    let dy = e.clientY - o.y;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    input.joystick.x = dx / RADIUS;
    input.joystick.z = dy / RADIUS;
  }

  function end(e: PointerEvent<HTMLDivElement>) {
    if (origin.current?.pointer !== e.pointerId) return;
    origin.current = null;
    setBase(null);
    setKnob({ x: 0, y: 0 });
    input.joystick.x = 0;
    input.joystick.z = 0;
  }

  return (
    <div
      className="pad-zone"
      data-testid="pad-zone"
      onPointerDown={(e) => {
        if (origin.current) return;
        const zone = e.currentTarget.getBoundingClientRect();
        origin.current = { x: e.clientX, y: e.clientY, pointer: e.pointerId };
        setBase({ x: e.clientX - zone.left, y: e.clientY - zone.top });
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={update}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div
        className={base ? "joystick joystick--active" : "joystick"}
        data-testid="joystick"
        aria-label="Movement stick"
        role="presentation"
        style={base ? { left: base.x, top: base.y, bottom: "auto" } : undefined}
      >
        <div className="joystick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
    </div>
  );
}

/** The big round "A" button: does whatever the current prompt offers (enter, ride, order, sit…). */
export function ActionButton({ icon, label, onPress }: { icon: string; label: string | null; onPress: () => void }) {
  return (
    <button
      type="button"
      className={label ? "pad-action" : "pad-action pad-action--idle"}
      data-testid="action-button"
      aria-label={label ? `Action: ${label}` : "Action (nothing here)"}
      disabled={!label}
      onClick={onPress}
    >
      <span className="pad-action-icon" aria-hidden>
        {label ? icon : "Ⓐ"}
      </span>
      {label && <span className="pad-action-label">{label}</span>}
    </button>
  );
}
