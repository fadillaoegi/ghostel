import { useCallback, useEffect, useRef, useState } from "react";

/** How long to wait for the browser to restore a lost context before mounting a fresh canvas. */
const RESTORE_WAIT_MS = 2000;
/** Fresh canvases allowed per minute before we stop and offer a reload. */
const MAX_REMOUNTS_PER_MINUTE = 3;

export type SceneStatus = "ok" | "recovering" | "failed";

/**
 * M24: Android Chrome drops WebGL contexts (app in the background, memory pressure, GPU process restart) and
 * does not always give them back. The canvas then stays blank while the rest of the page works.
 * This watches the 3D canvas: it waits briefly for a restore, and otherwise remounts the canvas (via `canvasKey`)
 * with a new context. Presence, the call and the HUD live outside the canvas and are not touched.
 */
export function useContextGuard(): { canvasKey: number; status: SceneStatus; watch: (canvas: HTMLCanvasElement) => void; reload: () => void } {
  const [canvasKey, setCanvasKey] = useState(0);
  const [status, setStatus] = useState<SceneStatus>("ok");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timer = useRef<number | null>(null);
  const remounts = useRef<number[]>([]);
  const detach = useRef<(() => void) | null>(null);

  const clearTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  const remount = useCallback(() => {
    clearTimer();
    const now = Date.now();
    remounts.current = remounts.current.filter((t) => now - t < 60_000);
    if (remounts.current.length >= MAX_REMOUNTS_PER_MINUTE) {
      setStatus("failed");
      return;
    }
    remounts.current.push(now);
    setStatus("recovering");
    setCanvasKey((k) => k + 1);
  }, []);

  const watch = useCallback(
    (canvas: HTMLCanvasElement) => {
      detach.current?.();
      canvasRef.current = canvas;
      const onLost = (e: Event) => {
        // Without preventDefault the browser never restores the context.
        e.preventDefault();
        setStatus("recovering");
        clearTimer();
        timer.current = window.setTimeout(remount, RESTORE_WAIT_MS);
      };
      const onRestored = () => {
        clearTimer();
        setStatus("ok");
      };
      canvas.addEventListener("webglcontextlost", onLost);
      canvas.addEventListener("webglcontextrestored", onRestored);
      detach.current = () => {
        canvas.removeEventListener("webglcontextlost", onLost);
        canvas.removeEventListener("webglcontextrestored", onRestored);
      };
      // A fresh canvas has been created: the scene is back.
      setStatus("ok");
    },
    [remount],
  );

  // Coming back to the tab with a lost context: do not wait for an event that may never come.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const gl = (canvasRef.current?.getContext("webgl2") ?? canvasRef.current?.getContext("webgl")) as WebGLRenderingContext | null;
      if (gl?.isContextLost()) remount();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      detach.current?.();
      clearTimer();
    };
  }, [remount]);

  const reload = useCallback(() => window.location.reload(), []);
  return { canvasKey, status, watch, reload };
}
