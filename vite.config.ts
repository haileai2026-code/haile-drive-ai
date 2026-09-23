import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

/** Vercel + Nitro. Cloudflare Workers (wrangler.jsonc) is frozen until Assets token exists. */
export default defineConfig({
  plugins: [tanstackStart(), nitro(), viteReact(), tailwindcss(), tsconfigPaths()],
});
