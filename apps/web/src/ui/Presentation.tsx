import type { PresentationView, PresentMode, PresentRequest } from "@ghostel/shared";
import { useEffect, useRef, useState } from "react";
import type { CallClient, CallSnapshot } from "../net/call";
import type { PresenceClient } from "../net/presence";
import { StreamVideo } from "./MeetingView";

type PdfDoc = { numPages: number; getPage: (n: number) => Promise<PdfPage>; destroy: () => Promise<void> };
type PdfPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvas: HTMLCanvasElement; viewport: { width: number; height: number } }) => { promise: Promise<void>; cancel: () => void };
};

/** pdf.js is loaded only when someone shows slides. No scripting, no XFA, no WebAssembly (CSP). */
async function openPdf(data: ArrayBuffer): Promise<PdfDoc> {
  const [pdfjs, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({
    data,
    enableXfa: false,
    useWasm: false,
    maxImageSize: 16_000_000,
    stopAtErrors: false,
    standardFontDataUrl: "/pdfjs/standard_fonts/",
  });
  return (await task.promise) as unknown as PdfDoc;
}

/** One page of the room's slides, drawn into a canvas. The presenter gets page buttons. */
function PdfStage({
  roomId,
  view,
  isPresenter,
  presence,
  onCanvas,
}: {
  roomId: string;
  view: PresentationView;
  isPresenter: boolean;
  presence: PresenceClient;
  onCanvas: (c: HTMLCanvasElement | null) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendered, setRendered] = useState(0);

  useEffect(() => {
    if (!view.file) return;
    let cancelled = false;
    let loaded: PdfDoc | null = null;
    setError(null);
    (async () => {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/slides/${encodeURIComponent(view.file as string)}`, { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      loaded = await openPdf(await res.arrayBuffer());
      if (cancelled) return void loaded.destroy();
      setDoc(loaded);
      if (isPresenter) presence.sendPresent({ t: "present_page", page: 1, pages: Math.max(1, loaded.numPages) });
    })().catch(() => !cancelled && setError("Could not open these slides."));
    return () => {
      cancelled = true;
      setDoc(null);
      void loaded?.destroy();
    };
  }, [roomId, view.file, isPresenter, presence]);

  useEffect(() => {
    const c = canvas.current;
    if (!doc || !c) return;
    let task: { cancel: () => void } | null = null;
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(Math.min(Math.max(1, view.page), doc.numPages));
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(2, 1280 / base.width) });
      if (cancelled) return;
      // pdf.js draws at the viewport size; the canvas must be given that size first.
      c.width = Math.floor(viewport.width);
      c.height = Math.floor(viewport.height);
      const t = page.render({ canvas: c, viewport });
      task = t;
      await t.promise;
      if (!cancelled) setRendered((n) => n + 1);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, view.page]);

  useEffect(() => {
    onCanvas(canvas.current);
    return () => onCanvas(null);
  }, [onCanvas]);

  const pages = doc?.numPages ?? view.pages ?? 1;
  const go = (page: number) => presence.sendPresent({ t: "present_page", page, pages });
  return (
    <div className="stage-pdf" data-testid="slides" data-page={view.page} data-rendered={rendered > 0 ? "yes" : "no"}>
      {!view.file ? (
        <p className="stage-wait">{isPresenter ? "Choose a PDF to show." : `Waiting for ${view.name}'s slides…`}</p>
      ) : error ? (
        <p className="stage-wait">{error}</p>
      ) : (
        <canvas ref={canvas} className="stage-canvas" aria-label={`Slide ${view.page} of ${pages}`} />
      )}
      {isPresenter && view.file && (
        <div className="stage-pager">
          <button type="button" className="btn btn--ghost call-btn" aria-label="Previous slide" disabled={view.page <= 1} onClick={() => go(view.page - 1)}>
            ◀
          </button>
          <span className="stage-page" data-testid="slide-number">
            {view.page} / {pages}
          </span>
          <button type="button" className="btn btn--ghost call-btn" aria-label="Next slide" disabled={view.page >= pages} onClick={() => go(view.page + 1)}>
            ▶
          </button>
        </div>
      )}
      {!isPresenter && view.file && (
        <span className="stage-page stage-page--viewer" data-testid="slide-number">
          {view.page} / {pages}
        </span>
      )}
    </div>
  );
}

/** The shared screen or slides, wherever they are shown (meeting view or the room's floating panel). */
export function Stage({
  roomId,
  view,
  selfId,
  state,
  presence,
  onSource,
}: {
  roomId: string;
  view: PresentationView;
  selfId: string | null;
  state: CallSnapshot;
  presence: PresenceClient;
  /** The element the 3D room screen copies (a <video> or the slide <canvas>). */
  onSource: (el: HTMLVideoElement | HTMLCanvasElement | null) => void;
}) {
  const isPresenter = view.presenter === selfId;
  if (view.mode === "pdf") return <PdfStage roomId={roomId} view={view} isPresenter={isPresenter} presence={presence} onCanvas={onSource} />;
  const stream = isPresenter ? state.localScreen : (state.remote.get(view.presenter)?.screen ?? null);
  return (
    <div className="stage-screen" data-testid="shared-screen" data-live={stream ? "yes" : "no"}>
      {stream ? (
        <ScreenVideo stream={stream} name={view.name} onVideo={onSource} />
      ) : (
        <p className="stage-wait">{isPresenter ? "Press “Share your screen” to start." : `Waiting for ${view.name}'s screen…`}</p>
      )}
    </div>
  );
}

function ScreenVideo({ stream, name, onVideo }: { stream: MediaStream; name: string; onVideo: (v: HTMLVideoElement | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    onVideo(box.current?.querySelector("video") ?? null);
    return () => onVideo(null);
  }, [stream, onVideo]);
  return (
    <div ref={box} className="stage-video">
      <StreamVideo stream={stream} label={`${name}'s screen`} fit="contain" />
    </div>
  );
}

/** Present / stop buttons for the call bars, plus the presenter's start button and PDF picker. */
export function PresentControls({
  roomId,
  view,
  selfId,
  owner,
  call,
  state,
  presence,
}: {
  roomId: string;
  view: PresentationView | null;
  selfId: string | null;
  owner: boolean;
  call: CallClient;
  state: CallSnapshot;
  presence: PresenceClient;
}) {
  const [menu, setMenu] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const isPresenter = view?.presenter === selfId;
  const canShare = typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";

  const ask = (mode: PresentMode) => {
    setMenu(false);
    presence.sendPresent({ t: "present_request", mode });
  };
  const stop = () => {
    if (isPresenter) call.stopScreen();
    presence.sendPresent({ t: "present_stop" });
  };
  const upload = async (f: File) => {
    setUploadError(null);
    if (f.size > 10 * 1024 * 1024) return setUploadError("Slides can be at most 10 MB.");
    setUploading(true);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/slides`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/pdf" },
        body: f,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setUploadError(body.message ?? `Upload failed (${res.status}).`);
      }
    } catch {
      setUploadError("Upload failed. Check your connection.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      {!view && (
        <button type="button" className="btn btn--ghost call-btn" aria-label={owner ? "Present" : "Ask to present"} onClick={() => setMenu(!menu)}>
          🖥️ <span className="btn-label">{owner ? "Present" : "Ask to present"}</span>
        </button>
      )}
      {menu && !view && (
        <div className="panel present-menu" role="menu" data-testid="present-menu">
          <button type="button" role="menuitem" className="btn btn--ghost" disabled={!canShare} onClick={() => ask("screen")}>
            🖥️ Share my screen{!canShare && " (desktop browsers)"}
          </button>
          <button type="button" role="menuitem" className="btn btn--ghost" onClick={() => ask("pdf")}>
            📄 Show PDF slides
          </button>
        </div>
      )}
      {isPresenter && view?.mode === "screen" && !state.screen && (
        <button type="button" className="btn btn--primary call-btn" aria-label="Share your screen" disabled={state.starting === "screen"} onClick={() => void call.startScreen()}>
          🖥️ <span className="btn-label">Share your screen</span>
        </button>
      )}
      {isPresenter && view?.mode === "pdf" && (
        <>
          <input
            ref={file}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            data-testid="slides-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
          <button type="button" className="btn btn--primary call-btn" aria-label="Choose PDF" disabled={uploading} onClick={() => file.current?.click()}>
            📄 <span className="btn-label">{uploading ? "Uploading…" : view.file ? "Another PDF" : "Choose PDF"}</span>
          </button>
        </>
      )}
      {view && (isPresenter || owner) && (
        <button type="button" className="btn btn--danger call-btn" aria-label="Stop presenting" onClick={stop}>
          ⏹ <span className="btn-label">{isPresenter ? "Stop presenting" : "Stop presentation"}</span>
        </button>
      )}
      {uploadError && (
        <span className="meeting-error" role="alert">
          {uploadError}
        </span>
      )}
    </>
  );
}

/** Owner only: who is asking to present. */
export function PresentRequests({ requests, presence }: { requests: readonly PresentRequest[]; presence: PresenceClient }) {
  if (requests.length === 0) return null;
  return (
    <div className="panel present-requests" data-testid="present-requests" role="status">
      {requests.map((r) => (
        <div key={r.id} className="present-request" data-testid="present-request">
          <span>
            <strong>{r.name}</strong> wants to {r.mode === "screen" ? "share their screen" : "show PDF slides"}.
          </span>
          <button type="button" className="btn btn--primary call-btn" onClick={() => presence.sendPresent({ t: "present_decide", id: r.id, allow: true })}>
            Allow
          </button>
          <button type="button" className="btn btn--ghost call-btn" onClick={() => presence.sendPresent({ t: "present_decide", id: r.id, allow: false })}>
            Not now
          </button>
        </div>
      ))}
    </div>
  );
}
