import type { Profile } from "@ghostel/shared";
import { useCallback, useEffect, useState } from "react";
import { fetchMe } from "./api";
import { Creator } from "./ui/Creator";
import { Lobby } from "./ui/Lobby";

type Screen =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "creator" }
  | { kind: "lobby"; profile: Profile };

function Loading() {
  return (
    <div className="splash" role="status" data-testid="loading">
      <div className="splash-ghost" aria-hidden>
        👻
      </div>
      <p>Waking the ghosts…</p>
    </div>
  );
}

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });

  const load = useCallback(() => {
    setScreen({ kind: "loading" });
    fetchMe()
      .then((profile) => setScreen(profile ? { kind: "lobby", profile } : { kind: "creator" }))
      .catch(() => setScreen({ kind: "error", message: "The hotel did not answer. It may still be waking up." }));
  }, []);

  useEffect(load, [load]);

  switch (screen.kind) {
    case "loading":
      return <Loading />;
    case "error":
      return (
        <div className="splash" role="alert">
          <div className="splash-ghost" aria-hidden>
            🕯️
          </div>
          <p>{screen.message}</p>
          <button type="button" className="btn btn--primary" onClick={load}>
            Knock again
          </button>
        </div>
      );
    case "creator":
      return <Creator mode="checkin" initial={null} onSaved={(profile) => setScreen({ kind: "lobby", profile })} />;
    case "lobby":
      return <Lobby profile={screen.profile} onProfile={(profile) => setScreen({ kind: "lobby", profile })} />;
  }
}
