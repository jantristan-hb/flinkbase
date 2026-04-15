import { defineConfig } from "vitest/config";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvFile(envPath: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!existsSync(envPath)) return env;
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
  }
  return env;
}

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 10000,
    env: loadEnvFile(resolve(process.cwd(), ".env")),
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/db/queries.ts", "scripts/hn-client.mts", "scripts/ai-filter.mts", "scripts/ai-summarize.mts", "scripts/ai-embed.mts", "scripts/ai-verify.mts"],
      exclude: ["src/db/schema.ts", "src/db/client.ts", "src/env.d.ts", "src/middleware.ts", "src/pages/**", "src/components/**", "drizzle.config.ts", "tests/**", "scripts/generate-digest.mts", "scripts/verify-digest.mts", "scripts/send-newsletter.mts", "scripts/seed.mts"],
      reporter: ["text", "text-summary"],
    },
  },
  resolve: {
    alias: {
      "@": "./src",
    },
  },
});
