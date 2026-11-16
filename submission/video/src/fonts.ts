import "@fontsource/creepster/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/800.css";
import { useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";

let ready: Promise<void> | null = null;

function loadFonts(): Promise<void> {
  ready ??= Promise.all([document.fonts.load("120px Creepster"), document.fonts.load("800 40px Nunito"), document.fonts.load("600 40px Nunito")]).then(
    () => undefined,
  );
  return ready;
}

/** Holds the frame until Creepster and Nunito are loaded, so canvas text is never drawn in a fallback font. */
export function useFontsReady(): boolean {
  const [state, setState] = useState<{ ok: boolean; handle: number | null }>(() => {
    const handle = delayRender("Loading Creepster and Nunito");
    loadFonts().then(
      () => {
        setState({ ok: true, handle: null });
        continueRender(handle);
      },
      (err: unknown) => cancelRender(err),
    );
    return { ok: false, handle };
  });
  return state.ok;
}
