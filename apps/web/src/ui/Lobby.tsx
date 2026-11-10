import { CROWN_CANDIES, floorName, floorOfPlace, parseSeatCode, sceneKeyFor, type DoorInfo, type FloorNumber, type GameView, type PromptKind, type Profile } from "@ghostel/shared";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useGamepad, useKeyboardControls } from "../input/controls";
import { PresenceClient, type PlayerView } from "../net/presence";
import { CallClient } from "../net/call";
import { WorldScene, type ScenePrompt } from "../three/WorldScene";
import { ChatPanel, unreadCount } from "./ChatPanel";
import { Creator } from "./Creator";
import { ActionButton, Joystick } from "./Joystick";
import { RoomDirectory, type DirectoryIntent } from "./RoomDirectory";
import { RoomSettings } from "./RoomSettings";
import { TriviaPanel } from "./TriviaPanel";
import { ElevatorPanel } from "./ElevatorPanel";
import { SnackMenu } from "./SnackMenu";
import { NightDesk } from "./NightDesk";
import { mirrorCam } from "./mirrorCam";
import { HotelMusic, musicEnabled, setMusicEnabled, themeFor } from "./music";
import { CallBar, MeetingView, useCall, voiceMarkOf, type VoiceMark } from "./MeetingView";
import { PresentControls, PresentRequests, Stage } from "./Presentation";

function useCoarsePointer(): boolean {
  const query = "(pointer: coarse)";
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
  );
}

const STATUS_TEXT = { connecting: "Connecting…", online: "Live", reconnecting: "Reconnecting…" } as const;

export function Lobby({ profile, onProfile }: { profile: Profile; onProfile: (p: Profile) => void }) {
  // Created in an effect (not during render) so StrictMode's double mount cannot leak or close a live socket.
  const [client, setClient] = useState<PresenceClient | null>(null);
  useEffect(() => {
    const c = new PresenceClient();
    setClient(c);
    return () => c.close();
  }, []);
  if (!client) return null;
  return <LobbyView client={client} profile={profile} onProfile={onProfile} />;
}

type Modal = null | "costume" | "rooms" | "settings" | "elevator" | "snack" | "terminal";

const PROMPT_TEXT: Record<Exclude<PromptKind, "door">, { icon: string; desktop: string; touch: string }> = {
  elevator: { icon: "🛗", desktop: "to call the elevator", touch: "Tap to call the elevator" },
  mirror: { icon: "🪞", desktop: "to try on costumes", touch: "Tap to try on costumes" },
  counter: { icon: "🍽️", desktop: "to order a snack", touch: "Tap to order a snack" },
  seat: { icon: "🪑", desktop: "to sit down", touch: "Tap to sit down" },
  terminal: { icon: "🖥️", desktop: "to log in to the Night Desk", touch: "Tap to log in to the Night Desk" },
};

/** A chair someone already sits on shows no prompt. */
function seatPromptText(code: string, players: readonly PlayerView[]): { icon: string; desktop: string; touch: string } | null {
  const seat = parseSeatCode(code);
  if (!seat) return null;
  const taken = players.some((p) => p.seat?.table === seat.table && p.seat.seat === seat.seat);
  return taken ? null : PROMPT_TEXT.seat;
}

const ACCESS_ICON = { open: "🔓", locked: "🔒", password: "🔑" } as const;

/** Prompt copy for a door: enter the room behind it, or book it when vacant. */
function doorPromptText(code: string, info: DoorInfo | undefined): { icon: string; desktop: string; touch: string } {
  const room = info?.room;
  if (!room) return { icon: "🚪", desktop: `to book room ${code}`, touch: `Tap to book room ${code}` };
  return { icon: ACCESS_ICON[room.access], desktop: `to enter ${code} · ${room.name}`, touch: `Tap to enter ${code} · ${room.name}` };
}

type Prompt = { scene: string } & ScenePrompt;

/** Short label for the touch / gamepad action button. */
function actionLabel(p: ScenePrompt, doors: readonly DoorInfo[]): string {
  switch (p.kind) {
    case "door":
      return doors.find((d) => d.code === p.code)?.room ? `Enter ${p.code ?? ""}` : `Book ${p.code ?? ""}`;
    case "elevator":
      return "Elevator";
    case "mirror":
      return "Costumes";
    case "counter":
      return "Order";
    case "seat":
      return "Sit";
    case "terminal":
      return "Terminal";
  }
}

const fullscreenAvailable = typeof document !== "undefined" && document.fullscreenEnabled === true;

async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen({ navigationUI: "hide" });
  } catch {
    // Some browsers refuse (e.g. not triggered by a tap); nothing to do.
  }
}

function useFullscreen(): boolean {
  return useSyncExternalStore(
    (cb) => {
      document.addEventListener("fullscreenchange", cb);
      return () => document.removeEventListener("fullscreenchange", cb);
    },
    () => document.fullscreenElement !== null,
  );
}

function LobbyView({ client, profile, onProfile }: { client: PresenceClient; profile: Profile; onProfile: (p: Profile) => void }) {
  const presence = useSyncExternalStore(client.subscribe, client.getSnapshot);
  const [modal, setModal] = useState<Modal>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [promptState, setPrompt] = useState<Prompt | null>(null);
  const [intent, setIntent] = useState<DirectoryIntent | null>(null);
  /** A door entry waiting for the server's answer (seq = last enter error seen before sending). */
  const [doorEntry, setDoorEntry] = useState<{ roomId: string; seq: number } | null>(null);
  const [doorError, setDoorError] = useState<{ id: number; text: string } | null>(null);
  const touch = useCoarsePointer();
  useKeyboardControls(modal === null);
  const fullscreen = useFullscreen();

  const place = presence.place ?? { kind: "lobby" as const };
  const inRoom = place.kind === "room";
  const sceneKey = sceneKeyFor(place);
  const floor = floorOfPlace(place);
  // Only a prompt raised in the current scene counts (scene changes can deliver a stale one late).
  const prompt = promptState?.scene === sceneKey ? promptState : null;
  const promptText =
    prompt === null
      ? null
      : prompt.kind === "door"
        ? doorPromptText(prompt.code ?? "", presence.doors.find((d) => d.code === prompt.code))
        : prompt.kind === "seat"
          ? seatPromptText(prompt.code ?? "", presence.players)
          : PROMPT_TEXT[prompt.kind];

  // One call client for the whole visit: the server decides which call (room or table) we are in.
  const [call] = useState(() => new CallClient(client));
  useEffect(() => () => call.dispose(), [call]);
  // Browsers only let audio analysis start after a gesture: the first tap or key press does it.
  useEffect(() => {
    const prime = () => call.prime();
    window.addEventListener("pointerdown", prime);
    window.addEventListener("keydown", prime);
    return () => {
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
    };
  }, [call]);
  const callState = useCall(call);
  const selfView = presence.players.find((p) => p.id === presence.selfId);
  const seated = selfView?.seat ?? null;

  const voiceMarks = new Map<string, VoiceMark>();
  for (const m of callState.call?.members ?? []) {
    const self = m.id === presence.selfId;
    voiceMarks.set(self ? "self" : m.id, voiceMarkOf(m, callState.speaking.has(self ? "self" : m.id)));
  }

  const sitOrStand = (code: string | undefined) => {
    const parsed = code ? parseSeatCode(code) : null;
    if (!parsed) return;
    call.prime();
    client.sendSit(parsed.table, parsed.seat);
  };
  const stand = () => client.sendStand();

  // The Haunted Mirror (floor 2): a local camera of its own, only while standing at the mirror.
  const mirror = useSyncExternalStore(mirrorCam.subscribe, mirrorCam.getSnapshot);
  const atMirror = prompt?.kind === "mirror" && !seated;
  useEffect(() => {
    if (!atMirror) mirrorCam.stop();
  }, [atMirror]);
  useEffect(() => () => mirrorCam.stop(), []);
  useEffect(() => {
    if (mirror.status !== "error") return;
    const timer = window.setTimeout(() => mirrorCam.stop(), 5000);
    return () => window.clearTimeout(timer);
  }, [mirror.status]);

  // Presentation: one stage element, shown in the meeting view (seated) or a floating panel; the 3D
  // room screen copies whatever it shows.
  const presentation = inRoom ? presence.presentation : null;
  const [stageSource, setStageSource] = useState<HTMLVideoElement | HTMLCanvasElement | null>(null);
  const onStageSource = useCallback((el: HTMLVideoElement | HTMLCanvasElement | null) => setStageSource(el), []);
  const [stageMin, setStageMin] = useState(false);
  // A new presentation (or none) opens full size again.
  const presentationKey = presentation ? `${presentation.presenter}:${presentation.mode}` : null;
  useEffect(() => setStageMin(false), [presentationKey]);
  const stage =
    presentation && place.kind === "room" ? (
      <Stage roomId={place.room.id} view={presentation} selfId={presence.selfId} state={callState} presence={client} onSource={onStageSource} />
    ) : null;

  // Live hotel music: one theme per floor, cross-fading on every change, with a remembered on/off choice.
  const [musicOn, setMusicOn] = useState(musicEnabled);
  const [music] = useState(() => new HotelMusic());
  useEffect(() => {
    if (musicOn) music.play(themeFor(sceneKey));
  }, [music, musicOn, sceneKey]);
  useEffect(() => {
    if (!musicOn) music.stop();
  }, [music, musicOn]);
  useEffect(() => () => music.stop(), [music]);

  // Keep the final standings on screen after the server ends the game, until closed or a new game starts.
  const [lastResult, setLastResult] = useState<GameView | null>(null);
  const game = presence.game;
  useEffect(() => {
    if (game?.view.phase === "podium") setLastResult(game.view);
    else if (game) setLastResult(null);
  }, [game]);
  useEffect(() => setLastResult(null), [sceneKey]);
  const canStartGame = place.kind === "room" && place.room.game === "pumpkin_trivia" && !game;
  const startGame = () => {
    setLastResult(null);
    client.sendGame({ t: "game_start" });
  };

  // Entering or leaving a room closes the directory and settings.
  useEffect(() => {
    setModal((m) => (m === "costume" ? m : null));
    setDoorEntry(null);
  }, [sceneKey]);

  const openRooms = (next: DirectoryIntent | null) => {
    setIntent(next);
    setModal("rooms");
  };

  // Walking through a door: the server decides. A password room answers "password_required",
  // which opens that room's password prompt; any other refusal shows as a toast.
  const enterError = presence.enterError;
  useEffect(() => {
    if (!doorEntry || !enterError || enterError.seq <= doorEntry.seq || enterError.roomId !== doorEntry.roomId) return;
    setDoorEntry(null);
    if (enterError.code === "password_required") {
      openRooms({ kind: "unlock", roomId: doorEntry.roomId });
      return;
    }
    setDoorError({ id: enterError.seq, text: enterError.message });
  }, [doorEntry, enterError]);
  useEffect(() => {
    if (!doorError) return;
    const timer = window.setTimeout(() => setDoorError(null), 4000);
    return () => window.clearTimeout(timer);
  }, [doorError]);

  const openPrompt = (p: ScenePrompt) => {
    if (p.kind === "elevator") return setModal("elevator");
    if (p.kind === "mirror") return setModal("costume");
    if (p.kind === "counter") return setModal("snack");
    if (p.kind === "terminal") return setModal("terminal");
    if (p.kind === "seat") return sitOrStand(p.code);
    const door = presence.doors.find((d) => d.code === p.code);
    if (!door) return;
    if (!door.room) return openRooms({ kind: "create", floor: door.floor, slot: door.slot });
    setDoorError(null);
    setDoorEntry({ roomId: door.room.id, seq: enterError?.seq ?? 0 });
    client.sendEnter(door.room.id);
  };
  // Desktop: E at a door, the elevator, the mirror, the counter or a chair; E again stands up.
  useEffect(() => {
    if ((!prompt && !seated) || modal !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyE" || e.repeat || e.target instanceof HTMLInputElement) return;
      e.preventDefault();
      if (seated) stand();
      else if (prompt) openPrompt(prompt);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // openPrompt reads the live door labels and the last enter error.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, modal, presence.doors, enterError, seated]);

  const lastLine = presence.chat.at(-1)?.id ?? null;
  const sheetOpen = touch && chatOpen;
  // A physical gamepad: A does the prompt's action, B closes whatever is open.
  useGamepad(
    {
      onAction: () => {
        if (modal !== null) return;
        if (seated) stand();
        else if (prompt) openPrompt(prompt);
      },
      onBack: () => {
        if (modal !== null) setModal(null);
        else if (chatOpen) setChatOpen(false);
        else if (seated) stand();
      },
    },
    true,
  );
  // While the phone chat sheet is open everything is being read, so nothing is unread.
  useEffect(() => {
    if (sheetOpen) setLastSeen(lastLine);
  }, [sheetOpen, lastLine]);
  const unread = touch && !chatOpen ? unreadCount(presence.chat, [lastSeen, presence.historyMark], presence.selfId) : 0;

  const chat = (variant: "docked" | "sheet") => (
    <ChatPanel
      variant={variant}
      title={inRoom ? "Room chat" : floor === 1 ? "Lobby chat" : floor === 4 ? "Diner chat" : "Floor chat"}
      lines={presence.chat}
      players={presence.players}
      selfId={presence.selfId}
      notice={presence.notice?.text ?? null}
      onSend={(text) => client.sendChat(text)}
      onClose={variant === "sheet" ? () => setChatOpen(false) : undefined}
      focusOnEnter={variant === "docked" && modal === null}
    />
  );

  const count = presence.players.length;
  // The server echoes profile changes to every tab of this guest, so prefer its view of us.
  const self = presence.players.find((p) => p.id === presence.selfId);
  const me: Profile = self ? { name: self.name, look: self.look } : profile;

  return (
    <div className="lobby" data-testid="lobby">
      <WorldScene
        client={client}
        place={place}
        selfId={presence.selfId}
        players={presence.players}
        bubbles={presence.bubbles}
        look={me.look}
        name={me.name}
        onPrompt={setPrompt}
        voiceMarks={voiceMarks}
        candies={presence.candies}
        doors={presence.doors}
        onStand={stand}
        screen={presentation ? stageSource : null}
      />
      <div key={sceneKey} className="scene-fade" aria-hidden />

      <header className="hud hud-top">
        <div className="panel hud-title">
          <span className="hud-logo">Ghostel</span>
          <span className="hud-place" data-testid="place-name">
            {place.kind === "room"
              ? `${ACCESS_ICON[place.room.access]} ${place.room.floor}${place.room.slot} · ${place.room.name}`
              : floor === 1
                ? "Grand Lobby"
                : `${floor}F · ${floorName(floor ?? 1)}`}
          </span>
        </div>
        <div className="panel hud-status">
          <span className={`dot dot--${presence.status}`} aria-hidden />
          <span className="status-label" data-testid="connection-status">
            {STATUS_TEXT[presence.status]}
          </span>
          <span className="hud-sep" aria-hidden>
            ·
          </span>
          <span data-testid="guest-count">
            {count} {count === 1 ? "guest" : "guests"} {inRoom ? "here" : "haunting"}
          </span>
          <button
            type="button"
            className="ambience-toggle"
            aria-label="Music"
            aria-pressed={musicOn}
            title={musicOn ? "Turn music off" : "Turn music on"}
            onClick={() => {
              setMusicEnabled(!musicOn);
              setMusicOn(!musicOn);
            }}
          >
            {musicOn ? "🎵" : "🔇"}
          </button>
        </div>
      </header>

      {inRoom && !seated && (
        <CallBar
          call={call}
          state={callState}
          extraControls={
            <PresentControls
              roomId={place.room.id}
              view={presentation}
              selfId={presence.selfId}
              owner={place.owner}
              call={call}
              state={callState}
              presence={client}
            />
          }
        />
      )}
      {inRoom && !seated && stage && (
        // Minimized, the panel shrinks to a corner thumbnail instead of closing: the room's TV copies it.
        <div className={stageMin ? "stage-float stage-float--min panel" : "stage-float panel"} data-testid="stage-float" data-min={stageMin ? "yes" : "no"}>
          <button
            type="button"
            className="stage-toggle"
            aria-label={stageMin ? "Show presentation" : "Minimize presentation"}
            title={stageMin ? "Show presentation" : "Minimize: watch it on the room's TV"}
            onClick={() => setStageMin(!stageMin)}
          >
            {stageMin ? "⤢" : "–"}
          </button>
          {stage}
        </div>
      )}
      {inRoom && place.owner && <PresentRequests requests={presence.presentRequests} presence={client} />}
      {seated && callState.call && (
        <MeetingView
          stage={inRoom ? (stage ?? undefined) : undefined}
          call={call}
          state={callState}
          players={presence.players}
          selfId={presence.selfId}
          title={place.kind === "room" ? `${place.room.floor}${place.room.slot} · ${place.room.name}` : `Table ${seated.table.replace("t", "")} · ${floorName(floor ?? 1)}`}
          onStand={stand}
          extraControls={
            <>
              {place.kind === "room" && (
                <PresentControls
                  roomId={place.room.id}
                  view={presentation}
                  selfId={presence.selfId}
                  owner={place.owner}
                  call={call}
                  state={callState}
                  presence={client}
                />
              )}
              {touch && (
                <button type="button" className="btn btn--ghost call-btn hud-icon" onClick={() => setChatOpen(true)} aria-label={unread ? `Open chat, ${unread} unread` : "Open chat"}>
                  💬{unread > 0 && <span className="badge">{unread}</span>}
                </button>
              )}
            </>
          }
        />
      )}

      {canStartGame && !lastResult && (
        <button type="button" className="btn btn--primary hud-game" onClick={startGame}>
          🎃 Play Pumpkin Trivia
        </button>
      )}
      {game ? (
        <div className="hud-trivia">
          <TriviaPanel
            view={game.view}
            receivedAt={game.receivedAt}
            selfId={presence.selfId}
            onAnswer={(round, choice) => client.sendGame({ t: "game_action", action: { round, choice } })}
          />
        </div>
      ) : (
        lastResult && (
          <div className="hud-trivia">
            <TriviaPanel
              view={lastResult}
              receivedAt={0}
              selfId={presence.selfId}
              onPlayAgain={canStartGame ? startGame : undefined}
              onClose={() => setLastResult(null)}
            />
          </div>
        )
      )}

      {presence.info && (
        <p className="panel toast" role="status" data-testid="info">
          {presence.info.text}
        </p>
      )}
      {doorError && !presence.info && (
        <p className="panel toast" role="alert" data-testid="door-error">
          {doorError.text}
        </p>
      )}

      {!inRoom && (
        <button
          type="button"
          className="panel hud-candies"
          data-testid="candy-count"
          title="Candies hide on every floor. Find all 12 to unlock the Golden Crown."
          onClick={() => setModal("costume")}
        >
          🍬 {presence.candies.length}/{CROWN_CANDIES}
          {presence.candies.length >= CROWN_CANDIES && " 👑"}
        </button>
      )}

      {prompt && promptText && modal === null && !seated && (
        <button
          type="button"
          className="panel door-prompt"
          onClick={() => openPrompt(prompt)}
          data-testid="door-prompt"
          data-prompt={prompt.kind}
          data-door={prompt.code}
        >
          {promptText.icon}{" "}
          {touch ? (
            promptText.touch
          ) : (
            <>
              Press <kbd>E</kbd> {promptText.desktop}
            </>
          )}
        </button>
      )}

      {atMirror && modal === null && mirrorCam.available() && (
        <button
          type="button"
          className="panel mirror-cam"
          data-testid="mirror-cam"
          data-cam={mirror.status}
          aria-pressed={mirror.status === "on"}
          onClick={() => (mirror.status === "on" || mirror.status === "starting" ? mirrorCam.stop() : void mirrorCam.start())}
        >
          <span>{mirror.status === "on" ? "🙈 Stop the mirror" : mirror.status === "starting" ? "👁️ Waking the mirror…" : "👁️ Look into the mirror"}</span>
          <small>Uses your camera. Only you see it; nothing is sent.</small>
        </button>
      )}
      {mirror.error && (
        <p className="panel toast" role="alert" data-testid="mirror-error">
          {mirror.error}
        </p>
      )}

      {!touch && <div className="hud-chat">{chat("docked")}</div>}

      <footer className="hud hud-bottom">
        {touch ? (
          sheetOpen ? null : <Joystick />
        ) : (
          <p className="panel hud-hint">
            Walk with <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd> · <kbd>Enter</kbd> to chat
          </p>
        )}
        {!sheetOpen && (
          <div className={touch ? "hud-actions hud-actions--touch" : "hud-actions"}>
            <div className="hud-icons">
            {touch && (
              <button type="button" className="btn btn--ghost hud-icon" onClick={() => setChatOpen(true)} aria-label={unread ? `Open chat, ${unread} unread` : "Open chat"}>
                💬{unread > 0 && <span className="badge" data-testid="unread">{unread}</span>}
              </button>
            )}
            {inRoom ? (
              <>
                <button type="button" className="btn btn--ghost hud-icon" aria-label="Leave room" onClick={() => client.sendExit()}>
                  ← <span className="btn-label">Leave room</span>
                </button>
                {place.owner && (
                  <button type="button" className="btn btn--ghost hud-icon" aria-label="Room settings" onClick={() => setModal("settings")}>
                    ⚙️ <span className="btn-label">Settings</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <button type="button" className="btn btn--ghost hud-icon" aria-label="Rooms" onClick={() => openRooms(null)}>
                  🚪 <span className="btn-label">Rooms</span>
                </button>
                <button type="button" className="btn btn--ghost hud-icon" aria-label="Elevator" onClick={() => setModal("elevator")}>
                  🛗 <span className="btn-label">Floors</span>
                </button>
              </>
            )}
            <button type="button" className="btn btn--primary hud-icon" aria-label="Edit costume" onClick={() => setModal("costume")}>
              🎭 <span className="btn-label">Edit costume</span>
            </button>
            {touch && fullscreenAvailable && (
              <button
                type="button"
                className="btn btn--ghost hud-icon"
                aria-label={fullscreen ? "Exit full screen" : "Full screen"}
                onClick={() => void toggleFullscreen()}
              >
                {fullscreen ? "🗗" : "⛶"}
              </button>
            )}
            </div>
            {touch && (
              <ActionButton
                icon={seated ? "🚶" : (promptText?.icon ?? "Ⓐ")}
                label={seated ? "Stand" : prompt && promptText ? actionLabel(prompt, presence.doors) : null}
                onPress={() => {
                  if (modal !== null) return;
                  if (seated) stand();
                  else if (prompt) openPrompt(prompt);
                }}
              />
            )}
          </div>
        )}
      </footer>

      {sheetOpen && <div className="hud-sheet">{chat("sheet")}</div>}

      {modal === "rooms" && (
        <RoomDirectory
          enterError={presence.enterError}
          intent={intent}
          currentFloor={floor ?? 1}
          onClose={() => setModal(null)}
          onEnter={(roomId, password) => client.sendEnter(roomId, password)}
        />
      )}
      {modal === "settings" && place.kind === "room" && <RoomSettings room={place.room} onClose={() => setModal(null)} />}
      {modal === "elevator" && (
        <ElevatorPanel
          current={floor}
          onClose={() => setModal(null)}
          onPick={(f: FloorNumber) => {
            setModal(null);
            client.sendFloor(f);
          }}
        />
      )}
      {modal === "snack" && (
        <SnackMenu
          onClose={() => setModal(null)}
          onOrder={(snack) => {
            client.sendOrder(snack);
            setModal(null);
          }}
        />
      )}
      {modal === "terminal" && (
        <NightDesk
          touch={touch}
          context={{
            guests: presence.players.map((p) => p.name),
            doors: presence.doors.filter((d) => d.floor === (floor ?? 0)).map((d) => ({ code: d.code, name: d.room?.name ?? null })),
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "costume" && (
        <Creator
          mode="edit"
          initial={me}
          candies={presence.candies}
          onCancel={() => setModal(null)}
          onSaved={(p) => {
            onProfile(p);
            setModal(null);
          }}
        />
      )}
    </div>
  );
}
