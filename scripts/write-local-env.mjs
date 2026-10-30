import { execFileSync } from "node:child_process";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import dotenv from "dotenv";

const { parse } = dotenv;

const status = execFileSync("npx", ["supabase", "status", "--output", "env"], {
  encoding: "utf8",
});
const values = Object.fromEntries(
  status
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value]),
);

for (const key of ["API_URL", "ANON_KEY", "DB_URL"]) {
  if (!values[key]) {
    throw new Error(`Supabase status did not provide ${key}. Start Supabase first.`);
  }
}

let existing = {};
try {
  existing = parse(readFileSync(".env.local"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const env = {
  ...existing,
  NEXT_PUBLIC_SUPABASE_URL: values.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: values.ANON_KEY,
  SUPABASE_DB_URL: values.DB_URL,
};
const contents = Object.entries(env)
  .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
  .join("\n");
writeFileSync(".env.local", `${contents}\n`, { mode: 0o600 });
chmodSync(".env.local", 0o600);
console.log("Wrote local Supabase URL, publishable key, and database URL to .env.local.");
