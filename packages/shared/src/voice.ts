import { z } from "zod";

/** SDP grows with every track (audio, camera, screen) on the connection. */
export const SDP_MAX = 14_000;
export const ICE_MAX = 1_000;

export const voiceSignalDataSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.enum(["offer", "answer"]), sdp: z.string().min(1).max(SDP_MAX) }),
  z.strictObject({
    kind: z.literal("ice"),
    candidate: z.string().max(ICE_MAX),
    sdpMid: z.string().max(64).nullable(),
    sdpMLineIndex: z.number().int().min(0).max(64).nullable(),
  }),
]);
export type VoiceSignalData = z.infer<typeof voiceSignalDataSchema>;

/** One ICE server entry as served by GET /api/voice (same shape as RTCIceServer). */
export const iceServerSchema = z.strictObject({
  urls: z.union([z.string().min(1).max(300), z.array(z.string().min(1).max(300)).min(1).max(5)]),
  username: z.string().max(300).optional(),
  credential: z.string().max(300).optional(),
});
export const iceServersSchema = z.array(iceServerSchema).max(5);
export type IceServer = z.infer<typeof iceServerSchema>;
