import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import vue from "@astrojs/vue";

export default defineConfig({
  integrations: [vue()],
  output: "server",
  adapter: node({ mode: "standalone" }),
  server: { host: true, port: 4321 },
});
