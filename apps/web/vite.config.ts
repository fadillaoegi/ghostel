import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig, type Plugin } from "vite";

/**
 * pdf.js needs its standard font files (Helvetica, Times…) to draw text in slides. They are copied
 * from the pdfjs-dist package into /pdfjs/standard_fonts/ (Foxit fonts: BSD-3-Clause; Liberation: OFL-1.1).
 */
function pdfStandardFonts(): Plugin {
  const require = createRequire(import.meta.url);
  const dir = join(dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts");
  const prefix = "/pdfjs/standard_fonts/";
  return {
    name: "pdf-standard-fonts",
    configureServer(dev) {
      dev.middlewares.use((req, res, next) => {
        const name = req.url?.startsWith(prefix) ? req.url.slice(prefix.length) : null;
        if (!name || !/^[A-Za-z0-9_.-]+$/.test(name) || !readdirSync(dir).includes(name)) return next();
        res.setHeader("Content-Type", "application/octet-stream");
        res.end(readFileSync(join(dir, name)));
      });
    },
    generateBundle() {
      for (const name of readdirSync(dir)) {
        this.emitFile({ type: "asset", fileName: `pdfjs/standard_fonts/${name}`, source: readFileSync(join(dir, name)) });
      }
    },
  };
}

const server = "http://127.0.0.1:2590";

/**
 * `pnpm dev:lan` sets GHOSTEL_LAN=1: the dev web server listens on the local network (so a phone on the
 * same Wi-Fi can open it) and uses HTTPS with a self-signed certificate, because browsers only allow
 * camera, microphone and screen share on HTTPS (or localhost). The API server itself stays on 127.0.0.1;
 * only this proxy is reachable from the network.
 */
const lan = process.env["GHOSTEL_LAN"] === "1";

export default defineConfig({
  plugins: [react(), pdfStandardFonts(), ...(lan ? [basicSsl({ name: "ghostel-dev" })] : [])],
  server: {
    host: lan ? "0.0.0.0" : "127.0.0.1",
    port: 5290,
    strictPort: true,
    proxy: {
      "/api": { target: server },
      "/ws": { target: server, ws: true },
    },
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1500,
  },
});
