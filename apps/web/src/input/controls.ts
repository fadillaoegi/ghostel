import { useEffect, useRef } from "react";

/** Shared, mutable input state read every frame by the local player. */
export const input = {
  keys: new Set<string>(),
  joystick: { x: 0, z: 0 },
  /** Left stick or d-pad of a physical gamepad (Gamepad API). */
  pad: { x: 0, z: 0 },
};

const KEY_CODES = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

export function useKeyboardControls(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const down = (e: KeyboardEvent) => {
      if (!KEY_CODES.has(e.code) || isTyping(e.target)) return;
      e.preventDefault();
      input.keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => input.keys.delete(e.code);
    const clear = () => input.keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      input.keys.clear();
    };
  }, [enabled]);
}

/** World-space direction (camera looks toward −z). Magnitude ≤ 1. */
export function readMoveVector(): { x: number; z: number } {
  const k = input.keys;
  const x = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);
  const z = (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0) - (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0);
  if (x !== 0 || z !== 0) {
    const len = Math.hypot(x, z);
    return { x: x / len, z: z / len };
  }
  const j = Math.hypot(input.joystick.x, input.joystick.z) > 0 ? input.joystick : input.pad;
  const len = Math.hypot(j.x, j.z);
  return len > 1 ? { x: j.x / len, z: j.z / len } : { x: j.x, z: j.z };
}

const DEADZONE = 0.22;
/** Standard mapping: 0 = A / Cross, 1 = B / Circle, 12–15 = d-pad up, down, left, right. */
const BUTTON_A = 0;
const BUTTON_B = 1;

/**
 * Polls connected gamepads every animation frame: the left stick and d-pad move the character,
 * A does the current action and B goes back (closes a panel, stands up). Browsers only report a
 * gamepad after one of its buttons was pressed while the page had focus.
 */
export function useGamepad(handlers: { onAction: () => void; onBack: () => void }, enabled: boolean): void {
  // The latest handlers, without restarting the polling loop on every render.
  const latest = useRef(handlers);
  latest.current = handlers;
  useEffect(() => {
    if (!enabled || typeof navigator.getGamepads !== "function") return;
    let frame = 0;
    const was = { a: false, b: false };
    const poll = () => {
      frame = requestAnimationFrame(poll);
      const pad = [...navigator.getGamepads()].find((g): g is Gamepad => g !== null && g.connected);
      if (!pad) {
        input.pad.x = 0;
        input.pad.z = 0;
        return;
      }
      const pressed = (i: number) => pad.buttons[i]?.pressed ?? false;
      let x = pad.axes[0] ?? 0;
      let z = pad.axes[1] ?? 0;
      if (Math.hypot(x, z) < DEADZONE) x = z = 0;
      if (pressed(14)) x = -1;
      if (pressed(15)) x = 1;
      if (pressed(12)) z = -1;
      if (pressed(13)) z = 1;
      input.pad.x = x;
      input.pad.z = z;
      const a = pressed(BUTTON_A);
      const b = pressed(BUTTON_B);
      if (a && !was.a) latest.current.onAction();
      if (b && !was.b) latest.current.onBack();
      was.a = a;
      was.b = b;
    };
    frame = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(frame);
      input.pad.x = 0;
      input.pad.z = 0;
    };
  }, [enabled]);
}
