#!/usr/bin/env node
// The promoted bucket sources own this package. Never edit generated files.
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { load, JSON_SCHEMA } from "js-yaml";
import { adaptCodexContent } from "./codex-compatibility.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageName = "mattpocock-skills";
const packagePath = `plugins/${packageName}`;
const schema = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
const upstream = "https://github.com/mattpocock/skills";
const fork = "https://github.com/zxxz/mattpocock-skills";
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const parseJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const requireCondition = (condition, message) => { if (!condition) throw new Error(message); };
const semver = (version) => {
  requireCondition(typeof version === "string" && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version), `Expected a stable semantic version, got ${version}`);
  return version.split(".").map(Number);
};
const newer = (a, b) => {
  const left = semver(a), right = semver(b);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i];
  return false;
};

function filesIn(path, prefix = "") {
  requireCondition(!lstatSync(path).isSymbolicLink(), `Symlinks are not distributable: ${path}`);
  return readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "en")).flatMap((entry) => {
    const child = join(path, entry.name), name = prefix + entry.name;
    requireCondition(!entry.isSymbolicLink(), `Symlinks are not distributable: ${child}`);
    if (entry.isDirectory()) return filesIn(child, `${name}/`);
    requireCondition(entry.isFile(), `Unsupported resource type: ${child}`);
    return [name];
  });
}

function readEntry(path) {
  requireCondition(lstatSync(path).isFile(), `Resource must be a regular file: ${path}`);
  return { content: readFileSync(path), mode: lstatSync(path).mode & 0o111 ? 0o755 : 0o644 };
}

function digest(entries) {
  const hash = createHash("sha256");
  for (const [name, { content, mode }] of [...entries].sort(([a], [b]) => a.localeCompare(b, "en"))) {
    hash.update(`${name}\0${mode}\0${content.length}\0`).update(content);
  }
  return hash.digest("hex");
}

function validateResourceLinks(path, text, resources) {
  // Fenced and inline examples describe files in the user's project, not package resources.
  const prose = text.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, "").replace(/`[^`\n]+`/g, "");
  for (const [, target] of prose.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(target)) continue;
    const decoded = decodeURIComponent(target.split(/[?#]/)[0]);
    const resource = relative("/", resolve("/", dirname(path), decoded)).split(sep).join("/");
    requireCondition(!decoded.startsWith("/") && !decoded.split("/").includes(".."), `Resource link escapes its skill: ${path} -> ${target}`);
    requireCondition(resources.includes(resource), `Missing packaged resource: ${path} -> ${target}`);
  }
}

function loadSkills(repo, claude) {
  requireCondition(Array.isArray(claude.skills), "Claude manifest skills must be an array");
  const promoted = ["engineering", "productivity"].flatMap((bucket) => {
    const root = join(repo, "skills", bucket);
    requireCondition(!lstatSync(root).isSymbolicLink(), `Symlink source bucket: ${root}`);
    return readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .map((entry) => `./skills/${bucket}/${entry.name}`);
  }).sort();
  requireCondition(new Set(claude.skills).size === claude.skills.length, "Duplicate Claude skill paths");
  requireCondition(json([...claude.skills].sort()) === json(promoted), "Claude allowlist must match exactly skills/engineering and skills/productivity; non-promoted skills are forbidden");
  const names = new Set();
  return [...claude.skills].sort().map((source) => {
    requireCondition(/^\.\/skills\/(engineering|productivity)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source), `Invalid promoted source: ${source}`);
    const path = join(repo, source), resources = filesIn(path);
    requireCondition(resources.includes("SKILL.md") && resources.includes("agents/openai.yaml"), `Skill and invocation metadata required: ${source}`);
    requireCondition(!resources.some((name) => name !== "SKILL.md" && name.endsWith("/SKILL.md")), `Nested skill identities are forbidden: ${source}`);
    const content = readFileSync(join(path, "SKILL.md"), "utf8");
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    requireCondition(match, `Missing skill frontmatter: ${source}`);
    const metadata = load(match[1], { schema: JSON_SCHEMA });
    const name = source.split("/").at(-1);
    requireCondition(metadata?.name === name && !names.has(name), `Unique skill name must match directory: ${source}`);
    requireCondition(`${packageName}:${name}`.length <= 64, `Plugin and skill identity exceeds 64 characters: ${name}`);
    requireCondition(typeof metadata.description === "string" && metadata.description.trim(), `Skill description required: ${source}`);
    requireCondition(metadata["disable-model-invocation"] === undefined || typeof metadata["disable-model-invocation"] === "boolean", `disable-model-invocation must be boolean: ${source}`);
    names.add(name);
    const yaml = load(readFileSync(join(path, "agents/openai.yaml"), "utf8"), { schema: JSON_SCHEMA });
    for (const key of ["display_name", "short_description"]) requireCondition(typeof yaml?.interface?.[key] === "string" && yaml.interface[key].trim(), `interface.${key} required: ${source}`);
    requireCondition(yaml.policy === undefined || (yaml.policy !== null && typeof yaml.policy === "object" && !Array.isArray(yaml.policy)), `policy must be an object: ${source}`);
    const policy = yaml?.policy?.allow_implicit_invocation;
    requireCondition(policy === undefined || typeof policy === "boolean", `allow_implicit_invocation must be boolean: ${source}`);
    const userInvoked = metadata["disable-model-invocation"] === true;
    requireCondition(userInvoked ? policy === false : policy !== false, `Claude/Codex invocation policy mismatch: ${source}`);
    for (const file of resources.filter((file) => file.endsWith(".md"))) validateResourceLinks(file, readFileSync(join(path, file), "utf8"), resources);
    return { name, userInvoked, source, path, resources };
  });
}

export function generateCodexPlugin({ repo = repoRoot, check = false } = {}) {
  const destination = join(repo, packagePath), provenancePath = join(destination, "provenance.json");
  // Refuse output paths or resources redirected outside the package by symlinks.
  for (const path of [join(repo, "plugins"), destination]) if (existsSync(path)) requireCondition(!lstatSync(path).isSymbolicLink(), `Symlink output path: ${path}`);
  const existing = existsSync(destination) ? filesIn(destination) : [];
  const claude = parseJson(join(repo, ".claude-plugin/plugin.json"));
  requireCondition(claude.name === packageName, "Claude/Codex plugin identity mismatch");
  requireCondition(typeof claude.description === "string" && claude.description.trim(), "Plugin description required");
  requireCondition(claude.author && typeof claude.author.name === "string" && claude.author.name.trim(), "Plugin author name required");
  requireCondition(Object.entries(claude.author).every(([key, value]) => ["name", "url", "email"].includes(key) && typeof value === "string" && value.trim()), "Invalid plugin author metadata");
  requireCondition(typeof claude.license === "string" && claude.license.trim(), "Plugin license required");
  requireCondition(Array.isArray(claude.keywords) && claude.keywords.every((value) => typeof value === "string"), "Plugin keywords must be strings");
  const marketplace = parseJson(join(repo, ".agents/plugins/marketplace.json"));
  const entry = marketplace.plugins?.[0];
  requireCondition(marketplace.name === "mattpocock-fork" && Array.isArray(marketplace.plugins) && marketplace.plugins.length === 1 && entry?.name === packageName && entry.source?.source === "local" && entry.source.path === `./${packagePath}`, "Codex marketplace must point only to the generated package");
  requireCondition(entry.policy?.installation === "AVAILABLE" && entry.policy?.authentication === "ON_INSTALL" && entry.category === "Productivity", "Invalid Codex marketplace policy");
  const { version: sourceVersion } = parseJson(join(repo, "package.json"));
  semver(sourceVersion);
  requireCondition(claude.version === sourceVersion, "Claude plugin version differs from package.json; run npm run version or scripts/sync-plugin-version.mjs");
  const skills = loadSkills(repo, claude);
  const output = new Map(), sources = new Map();
  const add = (name, content, mode = 0o644) => output.set(name, { content: Buffer.from(content), mode });
  for (const skill of skills) {
    for (const resource of skill.resources) {
      const entry = readEntry(join(skill.path, resource));
      sources.set(`${skill.source}/${resource}`, entry);
      const content = resource.endsWith(".md") ? adaptCodexContent({ skillName: skill.name, relativePath: resource, content: entry.content.toString("utf8"), skills, pluginName: packageName }) : entry.content;
      add(`skills/${skill.name}/${resource}`, content, entry.mode);
    }
  }
  const license = readEntry(join(repo, "LICENSE"));
  output.set("LICENSE", license);
  sources.set("LICENSE", license);
  sources.set(".claude-plugin/plugin.json", { content: Buffer.from(json(claude)), mode: 0o644 });
  const { name: _name, version: _version, skills: _skills, ...metadata } = claude;
  const identity = {
    name: packageName,
    description: metadata.description,
    author: metadata.author,
    homepage: `${fork}#readme`,
    repository: fork,
    license: metadata.license,
    keywords: metadata.keywords,
  };
  const interfaceMetadata = {
    displayName: "Matt Pocock Skills",
    shortDescription: "Engineering and productivity workflows from Matt Pocock",
    longDescription: metadata.description,
    developerName: "Matt Pocock (skills), zxxz (Codex distribution)",
    category: "Productivity",
    capabilities: ["Interactive", "Read", "Write"],
    websiteURL: `${fork}#readme`,
    defaultPrompt: ["Use $mattpocock-skills:ask-matt to help me choose the right workflow."],
  };
  // Exclude version from the digest so a release does not recursively cause another release.
  add("plugin.json", json({ $schema: schema, ...identity, extensions: { "com.openai": { interface: interfaceMetadata } } }));
  add(".codex-plugin/plugin.json", json({ ...identity, skills: "./skills/", interface: interfaceMetadata }));
  const contentSha256 = digest(output), sourceSha256 = digest(sources);
  const previous = existsSync(provenancePath) ? parseJson(provenancePath) : null;
  let version = sourceVersion;
  if (previous) {
    semver(previous.pluginVersion);
    version = previous.pluginVersion;
    if (newer(sourceVersion, version)) version = sourceVersion;
    else if (previous.contentSha256 !== contentSha256) {
      const [major, minor, patch] = semver(version);
      version = `${major}.${minor}.${patch + 1}`;
    }
  }
  add("plugin.json", json({ $schema: schema, ...identity, version, extensions: { "com.openai": { interface: interfaceMetadata } } }));
  add(".codex-plugin/plugin.json", json({ ...identity, version, skills: "./skills/", interface: interfaceMetadata }));
  add("provenance.json", json({
    generatedBy: "scripts/generate-codex-plugin.mjs",
    pluginVersion: version,
    contentSha256,
    source: { version: sourceVersion, sha256: sourceSha256 },
    upstream: { repository: upstream },
    skills: skills.map(({ name, source, userInvoked }) => ({ name, source, userInvoked })),
  }));
  const changed = new Set([...existing, ...output.keys()].filter((name) => {
    const expected = output.get(name);
    if (!expected || !existing.includes(name)) return true;
    const actual = readEntry(join(destination, name));
    return !actual.content.equals(expected.content) || actual.mode !== expected.mode;
  }));
  if (check) requireCondition(changed.size === 0, `Codex package drift (${changed.size} files). Run npm run generate:codex.\n${[...changed].slice(0, 10).join("\n")}`);
  else if (changed.size) {
    rmSync(destination, { recursive: true, force: true });
    for (const [name, { content, mode }] of output) {
      const path = join(destination, name);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content);
      chmodSync(path, mode);
    }
  }
  return { version, skillCount: skills.length, changedFiles: changed.size, contentSha256 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    requireCondition(process.argv.slice(2).every((arg) => arg === "--check"), "Usage: node scripts/generate-codex-plugin.mjs [--check]");
    const result = generateCodexPlugin({ check: process.argv.includes("--check") });
    console.log(`Codex ${result.version}: ${result.skillCount} promoted skills, ${result.changedFiles} changed files${process.argv.includes("--check") ? " (check only)" : ""}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
