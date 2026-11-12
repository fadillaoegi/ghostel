import { COLORS, type CallMember, type Look } from "@ghostel/shared";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { CallClient, CallSnapshot } from "../net/call";
import type { PlayerView } from "../net/presence";

export function useCall(call: CallClient): CallSnapshot {
  return useSyncExternalStore(call.subscribe, call.getSnapshot);
}

/** A <video> bound to a MediaStream. Our own camera is mirrored, like a mirror. */
export function StreamVideo({ stream, mirror = false, label, fit = "cover" }: { stream: MediaStream; mirror?: boolean; label: string; fit?: "cover" | "contain" }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.srcObject = stream;
    void v.play().catch(() => undefined);
    return () => {
      v.srcObject = null;
    };
  }, [stream]);
  return <video ref={ref} className={mirror ? "tile-video tile-video--mirror" : "tile-video"} style={{ objectFit: fit }} autoPlay playsInline muted aria-label={label} />;
}

const HEAD_EMOJI: Record<string, string> = {
  round: "🙂",
  pumpkin: "🎃",
  skull: "💀",
  cat: "🐱",
  vampire: "🧛",
  werewolf: "🐺",
  frankenstein: "🧟‍♂️",
  zombie: "🧟",
  alien: "👽",
};

function AvatarBadge({ look, name }: { look: Look | undefined; name: string }) {
  const body = look ? COLORS[look.body] : "#6c757d";
  const accent = look ? COLORS[look.accent] : "#2b2d42";
  return (
    <div className="tile-avatar" style={{ background: `radial-gradient(circle at 35% 30%, ${body}, ${accent})` }} aria-hidden>
      <span className="tile-avatar-face">{look ? (HEAD_EMOJI[look.head] ?? "👻") : name.slice(0, 1)}</span>
    </div>
  );
}

export type VoiceMark = "on" | "muted" | "speaking";

export function voiceMarkOf(member: CallMember, speaking: boolean): VoiceMark {
  if (!member.mic) return "muted";
  return speaking ? "speaking" : "on";
}

function Tile({ member, self, state, look }: { member: CallMember; self: boolean; state: CallSnapshot; look: Look | undefined }) {
  const speaking = state.speaking.has(self ? "self" : member.id);
  const cam = self ? state.localCam : (state.remote.get(member.id)?.cam ?? null);
  return (
    <li
      className={speaking && member.mic ? "meeting-tile meeting-tile--speaking" : "meeting-tile"}
      data-testid="meeting-tile"
      data-member={member.name}
      data-cam={cam ? "on" : "off"}
      data-voice={voiceMarkOf(member, speaking)}
    >
      {cam ? <StreamVideo stream={cam} mirror={self} label={`${member.name}'s camera`} /> : <AvatarBadge look={look} name={member.name} />}
      <span className="tile-name">
        <span aria-label={member.mic ? "microphone on" : "muted"}>{member.mic ? "🎙️" : "🔇"}</span> {member.name}
        {self && " (you)"}
      </span>
    </li>
  );
}

export function CallControls({ call, state }: { call: CallClient; state: CallSnapshot }) {
  const micLabel = state.starting === "mic" ? "Starting microphone…" : state.mic ? "Mute" : "Unmute";
  const camLabel = state.starting === "cam" ? "Starting camera…" : state.cam ? "Turn camera off" : "Turn camera on";
  return (
    <>
      <button
        type="button"
        className={state.mic ? "btn btn--ghost call-btn" : "btn btn--primary call-btn"}
        aria-label={micLabel}
        aria-pressed={state.mic}
        disabled={state.starting === "mic"}
        onClick={() => void call.toggleMic()}
      >
        {state.mic ? "🎙️" : "🔇"}
        <span className="btn-label">{state.mic ? "Mute" : "Unmute"}</span>
      </button>
      <button
        type="button"
        className={state.cam ? "btn btn--primary call-btn" : "btn btn--ghost call-btn"}
        aria-label={camLabel}
        aria-pressed={state.cam}
        disabled={state.starting === "cam"}
        onClick={() => void call.toggleCam()}
      >
        {state.cam ? "🎥" : "📷"}
        <span className="btn-label">{state.cam ? "Camera off" : "Camera"}</span>
      </button>
    </>
  );
}

/**
 * The Zoom-like view shown while seated: one tile per call member (camera or costume badge),
 * a stage for presentations, and the call controls. It can be folded away to see the hotel.
 */
export function MeetingView({
  call,
  state,
  players,
  selfId,
  title,
  onStand,
  stage,
  extraControls,
}: {
  call: CallClient;
  state: CallSnapshot;
  players: readonly PlayerView[];
  selfId: string | null;
  title: string;
  onStand: () => void;
  /** Presentation (screen or slides), shown big above the tiles. */
  stage?: ReactNode;
  extraControls?: ReactNode;
}) {
  const [folded, setFolded] = useState(false);
  const members = state.call?.members ?? [];
  const lookOf = (id: string) => players.find((p) => p.id === id)?.look;
  return (
    <section className={folded ? "meeting meeting--folded" : "meeting"} data-testid="meeting" aria-label="Meeting">
      <header className="meeting-head">
        <strong className="meeting-title">{title}</strong>
        <span className="meeting-count" data-testid="meeting-count">
          {members.length} {members.length === 1 ? "person" : "people"}
        </span>
        <span className={state.speaking.has("self") ? "meeting-voice meeting-voice--live" : "meeting-voice"} data-testid="voice-status">
          {state.mic ? "🎙️" : "🔇"} {state.connected} connected
        </span>
        <button type="button" className="btn btn--ghost call-btn" onClick={() => setFolded(!folded)} aria-label={folded ? "Show meeting" : "Show the hotel"}>
          {folded ? "▴" : "▾"}
        </button>
      </header>
      {/* Folded: the stage stays mounted as a thumbnail so the room's TV keeps showing it. */}
      {folded && stage && <div className="meeting-stage meeting-stage--mini">{stage}</div>}
      {!folded && (
        <>
          {stage && <div className="meeting-stage">{stage}</div>}
          <ul className={stage ? "meeting-grid meeting-grid--strip" : "meeting-grid"} data-count={Math.min(members.length, 9)}>
            {members.map((m) => (
              <Tile key={m.id} member={m} self={m.id === selfId} state={state} look={lookOf(m.id)} />
            ))}
          </ul>
        </>
      )}
      {state.error && (
        <p className="meeting-error" role="alert" onClick={() => call.clearError()}>
          {state.error}
        </p>
      )}
      <footer className="meeting-bar">
        <CallControls call={call} state={state} />
        {extraControls}
        <button type="button" className="btn btn--danger call-btn" aria-label="Stand up" onClick={onStand}>
          🚶 <span className="btn-label">Stand up</span>
        </button>
      </footer>
    </section>
  );
}
