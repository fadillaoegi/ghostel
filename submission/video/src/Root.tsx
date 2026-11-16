import { Composition } from "remotion";
import { Intro } from "./Intro";
import { Outro } from "./Outro";
import { FPS, HEIGHT, INTRO, OUTRO, WIDTH } from "./timeline";

export function Root() {
  return (
    <>
      <Composition id="Intro" component={Intro} durationInFrames={INTRO.frames} fps={FPS} width={WIDTH} height={HEIGHT} />
      <Composition id="Outro" component={Outro} durationInFrames={OUTRO.frames} fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={{ appUrl: "" }} />
    </>
  );
}
