// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// Never set ssr.external or resolve.external: the Worker has no runtime module resolution, so
// the build fails. Never add compression (compressPublicAssets, vite-plugin-compression):
// hosting already compresses at the edge.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        // Offline bay support. Registration happens only via src/lib/pwa.ts (guarded).
        injectRegister: null,
        registerType: "autoUpdate",
        manifest: false, // static public/manifest.webmanifest
        filename: "sw.js",
        devOptions: { enabled: false },
        workbox: {
          navigateFallback: null,
          globPatterns: ["assets/**/*.{js,css,woff2}"],
          runtimeCaching: [
            { urlPattern: ({ url }) => /\/(rest|auth|functions|storage)\/v1\//.test(url.pathname), handler: "NetworkOnly" },
            { urlPattern: ({ url }) => url.pathname.startsWith("/~oauth"), handler: "NetworkOnly" },
            { urlPattern: ({ request }) => request.mode === "navigate", handler: "NetworkFirst", options: { cacheName: "pages", networkTimeoutSeconds: 4 } },
            { urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/assets/"), handler: "CacheFirst", options: { cacheName: "assets" } },
          ],
        },
      }),
    ],
  },
});
