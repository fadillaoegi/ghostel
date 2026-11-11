import { PAIRS_FACES, type PairsCardView, type PairsView } from "@ghostel/shared";
import { useEffect, useRef, useState } from "react";
import { Podium, useRemaining } from "./GameParts";
import { setSfxMuted, sfx, sfxMuted } from "./sfx";

const FACE = new Map<string, { emoji: string; name: string }>(PAIRS_FACES.map((f) => [f.id, { emoji: f.emoji, name: f.name }]));
/** One colour per seat, for the badge on the pairs a player found. */
const SEAT_COLOURS = ["#ff9a2e", "#7ed957", "#8b5cf6", "#43c6ff"];

function Card({
  card,
  index,
  canFlip,
  ownerName,
  ownerColour,
  flash,
  onFlip,
}: {
  card: PairsCardView;
  index: number;
  canFlip: boolean;
  ownerName: string | null;
  ownerColour: string;
  flash: boolean;
  onFlip: () => void;
}) {
  const face = card.state === "down" ? null : FACE.get(card.face);
  const label =
    card.state === "down" ? `Card ${index + 1}, face down` : card.state === "up" ? `Card ${index + 1}, ${face?.name ?? "?"}` : `${face?.name ?? "?"}, found by ${ownerName ?? "?"}`;
  return (
    <button
      type="button"
      className={["pairs-card", card.state !== "down" ? "is-up" : "", card.state === "matched" ? "is-matched" : "", flash ? "is-flash" : ""].join(" ")}
      data-testid="pairs-card"
      data-state={card.state}
      data-face={card.state === "down" ? undefined : card.face}
      aria-label={label}
      disabled={!canFlip || card.state !== "down"}
      onClick={onFlip}
    >
      <span className="pairs-card-inner">
        <span className="pairs-card-back" aria-hidden>
          <span>🕸️</span>
        </span>
        <span className="pairs-card-front" aria-hidden>
          <span className="pairs-emoji">{face?.emoji}</span>
          <span className="pairs-name">{face?.name}</span>
          {card.state === "matched" && ownerName && (
            <span className="pairs-owner" style={{ background: ownerColour }}>
              {ownerName.slice(0, 1).toUpperCase()}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

/** Monster Pairs: flip two cards per turn, keep the pairs you match. The server owns the board. */
export function PairsPanel({
  view,
  receivedAt,
  selfId,
  onFlip,
  onPlayAgain,
  onClose,
}: {
  view: PairsView;
  receivedAt: number;
  selfId: string | null;
  onFlip?: (turn: number, card: number) => void;
  onPlayAgain?: () => void;
  onClose?: () => void;
}) {
  const remaining = useRemaining(view.remainingMs, receivedAt);
  const [muted, setMuted] = useState(sfxMuted);
  const me = view.players.find((p) => p.id === selfId);
  const playing = !!me && !me.gone;
  const myTurn = view.phase === "play" && view.current === selfId && playing;
  const upCount = view.cards.filter((c) => c.state === "up").length;
  const canFlip = myTurn && !view.peek && upCount < 2 && !!onFlip;
  const current = view.players.find((p) => p.id === view.current);
  const seat = (id: string) => Math.max(0, view.players.findIndex((p) => p.id === id));
  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? null;

  // Sounds: a match, a miss (for the player who missed), the winner's fanfare.
  const lastKey = useRef("");
  useEffect(() => {
    const key = `${view.phase}:${view.turn}:${view.peek}:${view.lastMatch?.face ?? ""}:${view.cards.filter((c) => c.state === "matched").length}`;
    if (key === lastKey.current) return;
    const before = lastKey.current;
    lastKey.current = key;
    if (!before) return;
    if (view.lastMatch && before.split(":")[4] !== key.split(":")[4]) sfx.correct();
    else if (view.peek && view.current === selfId) sfx.wrong();
    if (view.phase === "podium" && [...view.players].sort((a, b) => b.score - a.score)[0]?.id === selfId) sfx.fanfare();
  }, [view, selfId]);

  const pct = view.durationMs > 0 ? (remaining / view.durationMs) * 100 : 0;
  const seconds = Math.ceil(remaining / 1000);
  const status =
    view.phase === "intro"
      ? `Shuffling ${view.cards.length / 2} pairs… ${seconds}`
      : view.lastMatch
        ? `${view.lastMatch.by === selfId ? "You" : (nameOf(view.lastMatch.by) ?? "?")} found the ${FACE.get(view.lastMatch.face)?.name ?? ""} pair! ${view.lastMatch.by === selfId ? "Go again." : ""}`
        : view.peek
          ? "No match. The cards flip back…"
          : myTurn
            ? `Your turn! Flip ${upCount === 0 ? "two cards" : "one more"} · ${seconds}s`
            : !playing
              ? `You're watching. ${current?.name ?? "?"} is playing.`
              : `${current?.bot ? "🤖 " : ""}${current?.name ?? "?"}'s turn · ${seconds}s`;

  return (
    <section className="panel trivia pairs" aria-label="Monster Pairs" data-testid="pairs" data-phase={view.phase} data-turn={myTurn ? "mine" : "other"}>
      <header className="trivia-head">
        <span className="trivia-title">🃏 Monster Pairs</span>
        <button
          type="button"
          className="chat-close"
          aria-label={muted ? "Turn sounds on" : "Turn sounds off"}
          onClick={() => {
            setSfxMuted(!muted);
            setMuted(!muted);
          }}
        >
          {muted ? "🔇" : "🔊"}
        </button>
      </header>

      {view.phase !== "podium" && (
        <>
          <div className="timer" aria-hidden>
            <div className={view.peek ? "timer-bar timer-bar--peek" : seconds <= 3 && myTurn ? "timer-bar timer-bar--hurry" : "timer-bar"} style={{ width: `${pct}%` }} />
          </div>
          <p className={myTurn ? "pairs-status pairs-status--mine" : "pairs-status"} data-testid="pairs-status" role="status">
            {status}
          </p>
          <div className={view.cards.length > 8 ? "pairs-grid" : "pairs-grid pairs-grid--small"}>
            {view.cards.map((card, i) => (
              <Card
                key={i}
                card={card}
                index={i}
                canFlip={canFlip}
                ownerName={card.state === "matched" ? nameOf(card.owner) : null}
                ownerColour={card.state === "matched" ? (SEAT_COLOURS[seat(card.owner) % SEAT_COLOURS.length] ?? "#ff9a2e") : "#ff9a2e"}
                flash={card.state === "matched" && view.lastMatch?.face === card.face}
                onFlip={() => {
                  sfx.pick();
                  onFlip?.(view.turn, i);
                }}
              />
            ))}
          </div>
          <ol className="scoreboard" data-testid="pairs-scores">
            {view.players.map((p, i) => (
              <li key={p.id} className={[p.id === selfId ? "me" : "", p.gone ? "gone" : "", p.id === view.current ? "pairs-turn" : ""].join(" ")}>
                <span className="sb-name">
                  <span className="pairs-seat" style={{ background: SEAT_COLOURS[i % SEAT_COLOURS.length] }} aria-hidden />
                  {p.bot ? "🤖 " : ""}
                  {p.name}
                </span>
                <span className="sb-score">
                  {p.score} {p.score === 1 ? "pair" : "pairs"}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}

      {view.phase === "podium" && (
        <Podium
          players={view.players}
          selfId={selfId}
          testId="pairs-podium"
          scoreText={(n) => `${n} ${n === 1 ? "pair" : "pairs"}`}
          playAgainLabel="🃏 Play again"
          onPlayAgain={onPlayAgain}
          onClose={onClose}
        />
      )}
    </section>
  );
}
