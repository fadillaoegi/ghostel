import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

export function makeCheckerTexture(a: string, b: string, line: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const half = size / 2;
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? a : b;
      ctx.fillRect(x * half, y * half, half, half);
    }
  }
  ctx.strokeStyle = line;
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, size, size);
  ctx.beginPath();
  ctx.moveTo(half, 0);
  ctx.lineTo(half, size);
  ctx.moveTo(0, half);
  ctx.lineTo(size, half);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function makeGlowTexture(inner: string, outer: string): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface LabelOptions {
  font: string;
  size: number;
  color: string;
  glow: string;
  width: number;
  height: number;
}

/** Text drawn on a canvas once the web font is ready (no runtime font fetching from 3D libs). */
export function useLabelTexture(text: string, options: LabelOptions): THREE.CanvasTexture {
  const { font, size, color, glow, width, height } = options;
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    return c;
  }, [width, height]);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [canvas]);
  const [, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fontSpec = `${size}px ${font}`;
    const draw = () => {
      if (cancelled) return;
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      ctx.clearRect(0, 0, width, height);
      ctx.font = fontSpec;
      // Long names (room signs) shrink to fit instead of running off the canvas.
      const fit = (width * 0.94) / Math.max(1, ctx.measureText(text).width);
      const drawSize = fit < 1 ? size * fit : size;
      if (fit < 1) ctx.font = `${drawSize}px ${font}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = glow;
      ctx.shadowBlur = drawSize * 0.35;
      ctx.fillStyle = color;
      for (let i = 0; i < 2; i++) ctx.fillText(text, width / 2, height / 2);
      texture.needsUpdate = true;
      setVersion((v) => v + 1);
    };
    draw();
    document.fonts.load(fontSpec).then(draw, draw);
    return () => {
      cancelled = true;
    };
  }, [canvas, texture, text, font, size, color, glow, width, height]);

  return texture;
}
