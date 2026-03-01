import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import scraper from "./src/integrations/scraper.ts";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [scraper()],
});
