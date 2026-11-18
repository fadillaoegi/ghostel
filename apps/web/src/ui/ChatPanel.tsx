import { CHAT_MAX, CHAT_PAGE, COLORS, validateChat } from "@ghostel/shared";
import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type UIEvent } from "react";
import type { ChatLine, PlayerView } from "../net/presence";
import { visibleStart } from "./chatView";

const time = (at: number) => new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function ChatPanel({
  title,
  lines,
  players,
  selfId,
  notice,
  onSend,
  variant,
  onClose,
  focusOnEnter,
  more,
  loading,
  onLoadOlder,
}: {
  title: string;
  lines: readonly ChatLine[];
  players: readonly PlayerView[];
  selfId: string | null;
  notice: string | null;
  onSend: (text: string) => boolean;
  variant: "docked" | "sheet";
  onClose?: () => void;
  /** Desktop: pressing Enter anywhere in the lobby focuses the chat field. */
  focusOnEnter: boolean;
  /** The server has older messages than `lines` (M23). */
  more: boolean;
  loading: boolean;
  onLoadOlder: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLOListElement>(null);
  const inputId = useId();

  // M23: show the newest CHAT_PAGE messages; scrolling to the top (or the button) shows CHAT_PAGE more.
  const [visible, setVisible] = useState(CHAT_PAGE);
  const stick = useRef(true);
  const anchor = useRef<{ height: number; top: number } | null>(null);
  const wantOlder = useRef(false);
  const start = visibleStart(lines, visible);
  const shown = lines.slice(start);
  const canShowMore = start > 0 || more;

  function showOlder() {
    const el = log.current;
    if (!el || anchor.current) return;
    if (start > 0) {
      anchor.current = { height: el.scrollHeight, top: el.scrollTop };
      setVisible((v) => v + CHAT_PAGE);
    } else if (more && !loading) {
      wantOlder.current = true;
      onLoadOlder();
    }
  }

  // A page from the server was prepended (hidden at first, since the count is from the end): reveal it.
  const oldestId = lines[0]?.id;
  useEffect(() => {
    if (!wantOlder.current || loading) return;
    wantOlder.current = false;
    const el = log.current;
    if (el) anchor.current = { height: el.scrollHeight, top: el.scrollTop };
    setVisible((v) => v + CHAT_PAGE);
  }, [oldestId, loading]);

  // Following the conversation at the bottom keeps the view at the newest CHAT_PAGE messages.
  const newestId = lines.at(-1)?.id;
  useEffect(() => {
    if (stick.current) setVisible(CHAT_PAGE);
  }, [newestId]);

  useLayoutEffect(() => {
    const el = log.current;
    if (!el) return;
    if (anchor.current) {
      // Keep the reader's place when older lines appear above.
      el.scrollTop = anchor.current.top + (el.scrollHeight - anchor.current.height);
      anchor.current = null;
    } else if (stick.current) {
      el.scrollTop = el.scrollHeight;
    }
  });

  function onScroll(e: UIEvent<HTMLOListElement>) {
    const el = e.currentTarget;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 12;
    if (el.scrollTop < 24 && canShowMore && el.scrollHeight > el.clientHeight) showOlder();
  }

  useEffect(() => {
    if (variant === "sheet") input.current?.focus();
  }, [variant]);

  useEffect(() => {
    if (!focusOnEnter) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return;
      e.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusOnEnter]);

  const colorOf = (id: string) => {
    const p = players.find((pl) => pl.id === id);
    return p ? COLORS[p.look.accent] : "var(--violet-soft)";
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    const check = validateChat(draft);
    if (!check.ok) {
      setLocalError(check.message);
      return;
    }
    if (!onSend(check.value)) {
      setLocalError("Not connected yet. Try again in a moment.");
      return;
    }
    setLocalError(null);
    setDraft("");
    // Your own message always brings the log back to the newest lines.
    stick.current = true;
    // Desktop: hand the keyboard back to walking; Enter focuses the field again.
    if (variant === "docked") input.current?.blur();
  }

  const error = localError ?? notice;

  return (
    <section className={`panel chat chat--${variant}`} aria-label={title} data-testid="chat">
      <header className="chat-head">
        <span>💬 {title}</span>
        {onClose && (
          <button type="button" className="chat-close" onClick={onClose} aria-label="Close chat">
            ✕
          </button>
        )}
      </header>
      <ol className="chat-log" ref={log} role="log" aria-live="polite" data-testid="chat-log" onScroll={onScroll}>
        {canShowMore && (
          <li className="chat-more-row">
            <button type="button" className="chat-more" onClick={showOlder} disabled={loading} data-testid="chat-more">
              {loading ? "Summoning older messages…" : "↑ Earlier messages"}
            </button>
          </li>
        )}
        {shown.length === 0 && <li className="chat-empty">It's quiet here… say boo!</li>}
        {shown.map((line) =>
          line.kind === "notice" ? (
            <li key={line.id} className="chat-notice">
              {line.text}
            </li>
          ) : (
            <li key={line.id} className={line.msg.from === selfId ? "chat-line chat-line--self" : "chat-line"}>
              <span className="chat-name" style={{ color: colorOf(line.msg.from) }}>
                {line.msg.name}
              </span>
              <span className="chat-text">{line.msg.text}</span>
              <time className="chat-time" dateTime={new Date(line.msg.at).toISOString()}>
                {time(line.msg.at)}
              </time>
            </li>
          ),
        )}
      </ol>
      {error && (
        <p className="chat-error" role="alert">
          {error}
        </p>
      )}
      <form className="chat-form" onSubmit={submit}>
        <label htmlFor={inputId} className="visually-hidden">
          Message
        </label>
        <input
          id={inputId}
          ref={input}
          value={draft}
          maxLength={CHAT_MAX + 50}
          autoComplete="off"
          enterKeyHint="send"
          placeholder={focusOnEnter ? "Press Enter to say something spooky…" : "Say something spooky…"}
          onChange={(e) => {
            setDraft(e.target.value);
            if (localError) setLocalError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") e.currentTarget.blur();
          }}
        />
        <button type="submit" className="btn btn--primary chat-send" aria-label="Send message">
          Send
        </button>
      </form>
    </section>
  );
}

/**
 * Chat lines from other guests after both the last line the user has seen and the
 * history received on connect (history is context, not news).
 */
export function unreadCount(
  lines: readonly ChatLine[],
  marks: readonly (string | null)[],
  selfId: string | null,
): number {
  const start = Math.max(0, ...marks.map((id) => (id ? lines.findIndex((l) => l.id === id) + 1 : 0)));
  return lines.slice(start).filter((l) => l.kind === "chat" && l.msg.from !== selfId).length;
}
