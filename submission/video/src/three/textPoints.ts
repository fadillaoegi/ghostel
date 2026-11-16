import { SIGN } from "../timeline";
import { seeded } from "./random";
import { SIGN_CANVAS, drawSignCanvas } from "./textures";

export type Vec3 = [number, number, number];

/**
 * World points inside the letters of the sign: the lit pixels of the same canvas the sign texture uses,
 * so the shards land exactly on the letters. Always returns `count` points (seeded order).
 */
export function signPoints(count: number, seed = 13): Vec3[] {
  const c = drawSignCanvas(false);
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  const hits: Vec3[] = [];
  const step = 5;
  for (let y = 0; y < c.height; y += step) {
    for (let x = 0; x < c.width; x += step) {
      if ((data[(y * c.width + x) * 4 + 3] ?? 0) > 180) {
        hits.push([(x / SIGN_CANVAS.width - 0.5) * SIGN.width, SIGN.y + (0.5 - y / SIGN_CANVAS.height) * SIGN.height, SIGN.z + 0.05]);
      }
    }
  }
  if (hits.length === 0) throw new Error("The sign text drew no pixels (is Creepster loaded?)");
  const rng = seeded(seed);
  for (let i = hits.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [hits[i], hits[j]] = [hits[j] as Vec3, hits[i] as Vec3];
  }
  return Array.from({ length: count }, (_, i) => hits[i % hits.length] as Vec3);
}
