import { NIGHT_DESK_INPUT_MAX, NIGHT_DESK_LOG_MAX, nightDeskStep, startNightDesk, type NightDeskContext, type NightDeskState } from "@ghostel/shared";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { sfx } from "./sfx";

interface Line {
  id: number;
  text: string;
  kind: "out" | "echo";
}

const QUICK = ["LOOK", "N", "S", "E", "W", "HELP"] as const;

/**
 * The Night Desk: the lobby's 1987 green-screen terminal with a short text adventure.
 * Runs in the browser only (rules in `packages/shared/src/nightdesk.ts`); nothing is sent to the server.
 */
export function NightDesk({ context, touch, onClose }: { context: NightDeskContext; touch: boolean; onClose: () => void }) {
  const nextId = useRef(0);
  const toLines = (texts: readonly string[], kind: Line["kind"] = "out"): Line[] => texts.map((text) => ({ id: nextId.current++, text, kind }));
  const [game, setGame] = useState<NightDeskState>(() => startNightDesk().state);
  const [log, setLog] = useState<Line[]>(() => toLines(startNightDesk().lines));
  const [input, setInput] = useState("");
  const screen = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const closing = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (closing.current !== null) window.clearTimeout(closing.current);
    };
  }, [onClose]);

  useEffect(() => {
    const el = screen.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  const run = (command: string) => {
    const result = nightDeskStep(game, command, context);
    setGame(result.state);
    const echo = command.trim() ? toLines([`> ${command.trim().toUpperCase().slice(0, NIGHT_DESK_INPUT_MAX + 1)}`], "echo") : [];
    setLog((old) => (result.clear ? toLines(result.lines) : [...old, ...echo, ...toLines(result.lines)]).slice(-NIGHT_DESK_LOG_MAX));
    if (result.exit) closing.current = window.setTimeout(onClose, 450);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(input);
    setInput("");
  };

  const click = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter") sfx.key();
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Night Desk terminal" data-testid="night-desk">
      <div className="crt">
        <header className="crt-head">
          <span>NIGHT DESK · TERMINAL 1</span>
          <button type="button" className="crt-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="crt-screen" onClick={() => field.current?.focus()}>
          <div className="crt-log" ref={screen} role="log" aria-live="polite" data-testid="night-desk-log">
            {log.map((l) => (
              <p key={l.id} className={l.kind === "echo" ? "crt-line crt-line--echo" : "crt-line"}>
                {l.text || "\u00a0"}
              </p>
            ))}
          </div>
          <form className="crt-input-row" onSubmit={submit}>
            <span aria-hidden>&gt;</span>
            <input
              ref={field}
              className="crt-input"
              aria-label="Command"
              value={input}
              maxLength={NIGHT_DESK_INPUT_MAX}
              autoFocus={!touch}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              enterKeyHint="send"
              onKeyDown={click}
              onChange={(e) => setInput(e.target.value)}
            />
          </form>
        </div>
        <div className="crt-keys" aria-label="Quick commands">
          {QUICK.map((q) => (
            <button key={q} type="button" className="crt-key" onClick={() => run(q)}>
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
