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
  },
  resolve: {
    alias: {
      "@": "./src",
    },
  },
});
