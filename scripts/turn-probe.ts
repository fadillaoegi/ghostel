// Checks that a TURN server accepts the credentials Ghostel's server hands out (M22).
// It uses the server's own turnCredentials() and headless Chromium (Playwright), so nothing is reimplemented.
//
//   TURN_URLS=turn:127.0.0.1:3478 TURN_SECRET=... apps/server/node_modules/.bin/tsx scripts/turn-probe.ts [--connect]
//
// 1. Gathers ICE candidates with iceTransportPolicy "relay" using the right secret: a "relay" candidate means
//    coturn accepted the credentials and allocated a relay.
// 2. Does the same with a wrong secret: there must be no relay candidate.
// 3. With --connect: two peer connections in one page, both relay-only, open a data channel through the relay
//    and exchange a message. (Locally both relay addresses are private Docker addresses, so this needs a test
//    config that allows private peers; the VPS config does not.)

import { chromium } from "@playwright/test";
import { turnCredentials } from "../apps/server/src/http/turn.ts";

const urls = (process.env["TURN_URLS"] ?? "").split(",").map((u) => u.trim()).filter(Boolean);
const secret = process.env["TURN_SECRET"] ?? "";
if (urls.length === 0 || secret === "") {
  console.error("Set TURN_URLS and TURN_SECRET.");
  process.exit(2);
}
const connect = process.argv.includes("--connect");
const right = turnCredentials({ urls, secret, ttlSeconds: 3600 }, Date.now());
const wrong = turnCredentials({ urls, secret: `${secret}-wrong`, ttlSeconds: 3600 }, Date.now());

const browser = await chromium.launch();
const page = await browser.newPage();
// tsx (esbuild keepNames) wraps named functions in __name(), which does not exist inside the page.
await page.addInitScript("globalThis.__name = (f) => f;");
await page.goto("about:blank");

async function gather(server: typeof right): Promise<string[]> {
  return page.evaluate(async (ice) => {
    const pc = new RTCPeerConnection({ iceServers: [ice], iceTransportPolicy: "relay" });
    pc.createDataChannel("probe");
    const types: string[] = [];
    const done = new Promise<void>((resolve) => {
      pc.onicecandidate = (e) => {
        if (e.candidate) types.push(`${e.candidate.type} ${e.candidate.protocol} ${e.candidate.address ?? ""}`);
        else resolve();
      };
      setTimeout(resolve, 8000);
    });
    await pc.setLocalDescription(await pc.createOffer());
    await done;
    pc.close();
    return types;
  }, server);
}

let failed = false;
const good = await gather(right);
console.log(`right secret: ${good.length} candidate(s)`, good);
if (!good.some((c) => c.startsWith("relay"))) {
  console.log("FAIL: no relay candidate with the right secret");
  failed = true;
}
const bad = await gather(wrong);
console.log(`wrong secret: ${bad.length} candidate(s)`, bad);
if (bad.some((c) => c.startsWith("relay"))) {
  console.log("FAIL: a relay candidate with a wrong secret");
  failed = true;
}

if (connect) {
  const result = await page.evaluate(async (ice) => {
    const cfg: RTCConfiguration = { iceServers: [ice], iceTransportPolicy: "relay" };
    // Like a phone on carrier-grade NAT (relay only) calling a laptop on Wi-Fi (any candidate).
    const a = new RTCPeerConnection({ iceServers: [ice] });
    const b = new RTCPeerConnection(cfg);
    // No trickle: wait until all candidates are in the SDP, so none can arrive before the remote description.
    const gathered = (pc: RTCPeerConnection) =>
      new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") return resolve();
        pc.addEventListener("icegatheringstatechange", () => pc.iceGatheringState === "complete" && resolve());
        setTimeout(resolve, 8000);
      });
    const channel = a.createDataChannel("hello");
    const received = new Promise<string>((resolve) => {
      b.ondatachannel = (e) => {
        e.channel.onmessage = (m) => resolve(String(m.data));
      };
      setTimeout(() => resolve("(timeout)"), 15000);
    });
    channel.onopen = () => channel.send("boo through the relay");
    await a.setLocalDescription(await a.createOffer());
    await gathered(a);
    await b.setRemoteDescription(a.localDescription as RTCSessionDescriptionInit);
    await b.setLocalDescription(await b.createAnswer());
    await gathered(b);
    await a.setRemoteDescription(b.localDescription as RTCSessionDescriptionInit);
    const message = await received;
    const stats = await a.getStats();
    let pair = "";
    stats.forEach((s) => {
      if (s.type === "candidate-pair" && s.state === "succeeded" && s.nominated) {
        const local = stats.get(s.localCandidateId);
        const remote = stats.get(s.remoteCandidateId);
        pair = `${local?.candidateType} -> ${remote?.candidateType}`;
      }
    });
    const state = `${a.connectionState}/${b.connectionState}`;
    a.close();
    b.close();
    return { message, state, pair };
  }, right);
  console.log("connect:", result);
  if (result.message !== "boo through the relay") {
    console.log("FAIL: no message through the relay");
    failed = true;
  }
}

await browser.close();
console.log(failed ? "RESULT: FAIL" : "RESULT: OK");
process.exit(failed ? 1 : 0);
