import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages serves project sites under /<repo>/. Set PAGES_BASE in CI;
  // local dev and root deployments stay at /.
  base: process.env.PAGES_BASE ?? "/",
  build: {
    // Top-level await is used to load the music font before the first render.
    target: "es2022",
  },
});
