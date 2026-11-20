import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";

/**
 * Records a page with Chrome's screencast (JPEG frames with timestamps) and turns it into a 30 fps H.264 MP4
 * with ffmpeg. Sharper than Playwright's built-in video at 1080p. No audio: Chrome's screencast has none.
 */
export async function startRecording(page: Page, name: string) {
  const dir = join("/tmp", `ghostel-footage-${name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames: { file: string; t: number }[] = [];
  let stopped = false;
  cdp.on("Page.screencastFrame", (f) => {
    // Chrome can deliver one more frame after stopScreencast; the folder may be gone by then.
    if (stopped) return;
    const file = join(dir, `f${String(frames.length).padStart(6, "0")}.jpg`);
    writeFileSync(file, Buffer.from(f.data, "base64"));
    frames.push({ file, t: f.metadata.timestamp ?? Date.now() / 1000 });
    void cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => undefined);
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });

  return async function stop(out: string): Promise<{ frames: number; seconds: number }> {
    stopped = true;
    await cdp.send("Page.stopScreencast").catch(() => undefined);
    if (frames.length < 2) throw new Error("No frames recorded");
    // ffmpeg concat with each frame's real duration, then resampled to a constant 30 fps.
    const lines: string[] = [];
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i] as { file: string; t: number };
      const next = frames[i + 1];
      lines.push(`file '${frame.file}'`, `duration ${Math.max(0.001, (next ? next.t : frame.t + 1 / 30) - frame.t).toFixed(4)}`);
    }
    lines.push(`file '${(frames.at(-1) as { file: string }).file}'`);
    const list = join(dir, "frames.txt");
    writeFileSync(list, `${lines.join("\n")}\n`);
    execFileSync(
      "ffmpeg",
      ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-vf", "fps=30,scale=1920:1080:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-movflags", "+faststart", out],
      { stdio: "inherit" },
    );
    const seconds = (frames.at(-1) as { t: number }).t - (frames[0] as { t: number }).t;
    rmSync(dir, { recursive: true, force: true });
    return { frames: frames.length, seconds };
  };
}
