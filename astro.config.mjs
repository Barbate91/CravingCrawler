import { defineConfig } from "astro/config";
import scraper from "./src/integrations/scraper.ts";

export default defineConfig({
  output: "server",
  integrations: [scraper()],
});
