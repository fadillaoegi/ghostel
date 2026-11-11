import { useEffect, useState } from "react";

// Pieces every Ghostel game panel shares (part of the Game Kit, see docs/GAME-KIT.md).

export interface RankedPlayer {
  id: string;
  name: string;
  bot: boolean;
  score: number;
  gone: boolean;
}

const MEDALS = ["🥇", "🥈", "🥉"];

/** Time left, counted down locally from the server's `remainingMs` at the moment the view arrived. */
export function useRemaining(remainingMs: number, receivedAt: number): number {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(performance.now()), 100);
    return () => window.clearInterval(timer);
  }, []);
  return Math.max(0, remainingMs - (now - receivedAt));
}

export function ranked<P extends RankedPlayer>(players: readonly P[]): P[] {
  return [...players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

/** Final standings with confetti, used by every game. */
export function Podium({
  players,
  selfId,
  testId,
  scoreText = (n) => String(n),
  playAgainLabel,
  onPlayAgain,
  onClose,
}: {
  players: readonly RankedPlayer[];
  selfId: string | null;
  testId: string;
  scoreText?: (score: number) => string;
  playAgainLabel: string;
  onPlayAgain?: () => void;
  onClose?: () => void;
}) {
  const order = ranked(players);
  const winner = order[0];
  const tie = order.length > 1 && order[1]?.score === winner?.score;
  return (
    <div className="podium" data-testid={testId}>
      <div className="confetti" aria-hidden>
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 6) * 0.25}s` }}>
            {["🎃", "🍬", "🦇", "⭐", "👻", "🕯️"][i % 6]}
          </span>
        ))}
      </div>
      <h3>{tie ? "It's a tie! 🎉" : winner?.id === selfId ? "You win! 🎉" : `${winner?.name ?? "Nobody"} wins!`}</h3>
      <ol className="podium-list">
        {order.map((p, i) => (
          <li key={p.id} className={p.id === selfId ? "me" : ""} data-testid="podium-row">
            <span className="medal">{MEDALS[i] ?? `${i + 1}.`}</span>
            <span className="podium-name">
              {p.bot ? "🤖 " : ""}
              {p.name}
            </span>
            <span className="podium-score">{scoreText(p.score)}</span>
          </li>
        ))}
      </ol>
      {(onPlayAgain || onClose) && (
        <div className="actions">
          {onClose && (
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Close
            </button>
          )}
          {onPlayAgain && (
            <button type="button" className="btn btn--primary" onClick={onPlayAgain}>
              {playAgainLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
