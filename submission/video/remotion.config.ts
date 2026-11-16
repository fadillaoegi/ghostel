import { Config } from "@remotion/cli/config";

// WebGL scenes: ANGLE uses the GPU on a desktop (Remotion's recommendation for Three.js in 4.x).
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setOverwriteOutput(true);
