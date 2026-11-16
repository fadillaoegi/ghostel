import * as THREE from "three";
import { SIGN } from "../timeline";

export const PALETTE = {
  night: "#0b0614",
  wall: "#2a1b3d",
  stone: "#4b3f5c",
  tomb: "#5a5470",
  pumpkin: "#ff7a1a",
  pumpkinGlow: "#ff9a2e",
  flame: "#ffcf5a",
  violet: "#8b5cf6",
  ecto: "#43ffb0",
  ghost: "#f4f1de",
  moon: "#fff3d6",
  gold: "#c9a227",
} as const;

export const SIGN_CANVAS = { width: 1536, height: 384 } as const;

/** The neon "GHOSTEL" sign on a canvas, drawn the same way as the lobby's HotelSign (Creepster, orange glow). */
export function drawSignCanvas(glow: boolean): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = SIGN_CANVAS.width;
  c.height = SIGN_CANVAS.height;
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  ctx.font = "300px Creepster";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (glow) {
    ctx.shadowColor = PALETTE.pumpkin;
    ctx.shadowBlur = 70;
  }
  ctx.fillStyle = "#ffcf7a";
  for (let i = 0; i < (glow ? 3 : 1); i++) ctx.fillText(SIGN.text, c.width / 2, c.height / 2 + 12);
  return c;
}

export function canvasTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Soft radial glow for halos, flashes and fog puffs. */
export function glowTexture(inner: string, outer = "rgba(0,0,0,0)", size = 256): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvasTexture(c);
}

/** Night ground: dark checker with faint grid lines, like the lobby floor. */
export function groundTexture(): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  const half = size / 2;
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#1d1430" : "#140c22";
      ctx.fillRect(x * half, y * half, half, half);
    }
  }
  ctx.strokeStyle = "#2f2247";
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, size, size);
  const t = canvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(24, 24);
  return t;
}
