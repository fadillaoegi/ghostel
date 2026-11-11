import type { TriviaView } from "@ghostel/shared";
import { useEffect, useRef, useState } from "react";
import { Podium, ranked, useRemaining } from "./GameParts";
import { setSfxMuted, sfx, sfxMuted } from "./sfx";

const OPTIONS = [
  { icon: "🎃", cls: "opt--pumpkin" },
  { icon: "👻", cls: "opt--ghost" },
  { icon: "🦇", cls: "opt--bat" },
  { icon: "🕸️", cls: "opt--web" },
] as const;

function Scoreboard({ view, selfId }: { view: TriviaView; selfId: string | null }) {
  const gained = view.reveal?.gained ?? {};
  return (
    <ol className="scoreboard" data-testid="scoreboard">
      {ranked(view.players).map((p) => (
        <li key={p.id} className={[p.id === selfId ? "me" : "", p.gone ? "gone" : ""].join(" ")}>
          <span className="sb-name">
            {p.bot ? "🤖 " : ""}
            {p.name}
            {view.answered?.includes(p.id) && <span className="sb-tick" aria-label="answered"> ✓</span>}
          </span>
          <span className="sb-score">
            {p.score}
            {view.phase === "reveal" && (gained[p.id] ?? 0) > 0 && <em className="sb-gain">+{gained[p.id]}</em>}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function TriviaPanel({
  view,
  receivedAt,
  selfId,
  onAnswer,
  onPlayAgain,
  onClose,
}: {
  view: TriviaView;
  receivedAt: number;
  selfId: string | null;
  onAnswer?: (round: number, choice: number) => void;
  /** Only for the final results card after a game ends. */
  onPlayAgain?: () => void;
  onClose?: () => void;
}) {
  const remaining = useRemaining(view.remainingMs, receivedAt);
  const [muted, setMuted] = useState(sfxMuted);
  const me = view.players.find((p) => p.id === selfId);
  const playing = !!me && !me.gone;
  const picked = view.myChoice ?? null;
  const canAnswer = view.phase === "question" && playing && picked === null && !!onAnswer;

  // Sounds on phase changes and the last three seconds.
  const lastKey = useRef("");
  useEffect(() => {
    const key = `${view.phase}:${view.round}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    if (view.phase === "reveal" && playing) {
      const mine = view.reveal?.picks[selfId ?? ""];
      if (mine === view.reveal?.correct) sfx.correct();
      else sfx.wrong();
    }
    if (view.phase === "podium" && ranked(view.players)[0]?.id === selfId) sfx.fanfare();
  }, [view, playing, selfId]);
  const seconds = Math.ceil(remaining / 1000);
  const lastTick = useRef(0);
  useEffect(() => {
    if (view.phase !== "question" || seconds > 3 || seconds < 1 || seconds === lastTick.current) return;
    lastTick.current = seconds;
    sfx.tick();
  }, [seconds, view.phase]);

  // Keys 1–4 answer on desktop.
  useEffect(() => {
    if (!canAnswer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 4) {
        sfx.pick();
        onAnswer?.(view.round - 1, n - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canAnswer, onAnswer, view.round]);

  const pct = view.durationMs > 0 ? (remaining / view.durationMs) * 100 : 0;
  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? "?";

  return (
    <section className="panel trivia" aria-label="Pumpkin Trivia" data-testid="trivia" data-phase={view.phase}>
      <header className="trivia-head">
        <span className="trivia-title">🎃 Pumpkin Trivia</span>
        {(view.phase === "question" || view.phase === "reveal") && (
          <span className="trivia-round" data-testid="trivia-round">
            Question {view.round}/{view.rounds}
          </span>
        )}
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
        <div className="timer" aria-hidden>
          <div className={seconds <= 3 && view.phase === "question" ? "timer-bar timer-bar--hurry" : "timer-bar"} style={{ width: `${pct}%` }} />
        </div>
      )}

      {view.phase === "intro" && (
        <div className="trivia-intro">
          <p className="trivia-countdown">{seconds}</p>
          <p>Get ready! {view.rounds} spooky questions.</p>
          <p className="trivia-vs">{view.players.map((p) => `${p.bot ? "🤖 " : ""}${p.name}`).join("  vs  ")}</p>
        </div>
      )}

      {(view.phase === "question" || view.phase === "reveal") && view.question && (
        <>
          <p className="trivia-question" data-testid="trivia-question">
            {view.question.text}
          </p>
          <div className="trivia-options">
            {view.question.options.map((text, i) => {
              const style = OPTIONS[i] ?? OPTIONS[0];
              const reveal = view.reveal;
              const isCorrect = reveal?.correct === i;
              const mine = reveal ? reveal.picks[selfId ?? ""] === i : picked === i;
              const pickers = reveal ? Object.entries(reveal.picks).filter(([, c]) => c === i).map(([id]) => nameOf(id)) : [];
              const cls = [
                "opt",
                style.cls,
                mine ? "opt--mine" : "",
                reveal ? (isCorrect ? "opt--correct" : "opt--wrong") : "",
                !reveal && picked !== null && !mine ? "opt--dim" : "",
              ].join(" ");
              return (
                <button
                  key={i}
                  type="button"
                  className={cls}
                  disabled={!canAnswer}
                  data-testid="trivia-option"
                  aria-pressed={mine}
                  onClick={() => {
                    sfx.pick();
                    onAnswer?.(view.round - 1, i);
                  }}
                >
                  <span className="opt-icon" aria-hidden>
                    {reveal ? (isCorrect ? "✔" : mine ? "✖" : style.icon) : style.icon}
                  </span>
                  <span className="opt-text">{text}</span>
                  <kbd className="opt-key" aria-hidden>
                    {i + 1}
                  </kbd>
                  {pickers.length > 0 && <span className="opt-pickers">{pickers.join(", ")}</span>}
                </button>
              );
            })}
          </div>
          <p className="trivia-status" data-testid="trivia-status">
            {view.phase === "question"
              ? !playing
                ? "You're watching this round."
                : picked === null
                  ? `${seconds}s left · pick an answer${onAnswer ? " (keys 1–4)" : ""}`
                  : `Locked in! Waiting for others… ${seconds}s`
              : playing && view.reveal
                ? view.reveal.picks[selfId ?? ""] === view.reveal.correct
                  ? `Correct! +${view.reveal.gained[selfId ?? ""] ?? 0}`
                  : view.reveal.picks[selfId ?? ""] === null
                    ? "Too slow! The answer was:"
                    : "Not this time."
                : "Here's the answer."}
            {view.phase === "reveal" && view.reveal && (
              <strong className="trivia-answer"> {view.question.options[view.reveal.correct]}</strong>
            )}
          </p>
          <Scoreboard view={view} selfId={selfId} />
        </>
      )}

      {view.phase === "podium" && (
        <Podium players={view.players} selfId={selfId} testId="trivia-podium" playAgainLabel="🎃 Play again" onPlayAgain={onPlayAgain} onClose={onClose} />
      )}
    </section>
  );
}
