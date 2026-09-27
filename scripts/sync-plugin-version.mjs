#!/usr/bin/env node
// Keep Claude's version tied to changesets, then regenerate the Codex distribution.
// With --check, validate both distributions without changing files.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateCodexPlugin } from "./generate-codex-plugin.mjs";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const pluginPath = join(repo, ".claude-plugin", "plugin.json");
const check = process.argv.includes("--check");

try {
  const { version } = JSON.parse(readFileSync(join(repo, "package.json"), "utf8"));
  const source = readFileSync(pluginPath, "utf8");
  const plugin = JSON.parse(source);
  if (plugin.version === version) {
    console.log(`Claude plugin version is ${version} (already in sync)`);
  } else {
    if (check) throw new Error(`Claude plugin version is ${plugin.version}, package.json is ${version}. Run node scripts/sync-plugin-version.mjs.`);
    // Rewrite only the version line, preserving the original key order and formatting.
    const updated = source.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`);
    if (JSON.parse(updated).version !== version) throw new Error(`Could not find a version field to replace in ${pluginPath}.`);
    writeFileSync(pluginPath, updated);
    console.log(`Claude plugin version ${plugin.version} -> ${version}`);
  }
  const result = generateCodexPlugin({ repo, check });
  console.log(`Codex ${result.version}: ${result.skillCount} promoted skills, ${result.changedFiles} changed files`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
