import assert from "node:assert/strict";
import { chmodSync, cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { load, JSON_SCHEMA } from "js-yaml";
import { generateCodexPlugin } from "./generate-codex-plugin.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = "plugins/mattpocock-skills";
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const saveJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
function fixture(t) {
  const repo = mkdtempSync(join(tmpdir(), "codex-package-test-"));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  for (const path of ["skills", ".claude-plugin", ".agents/plugins", "package.json", "LICENSE"]) cpSync(join(root, path), join(repo, path), { recursive: true });
  return repo;
}
function edit(path, transform) { writeFileSync(path, transform(readFileSync(path, "utf8"))); }

// These exercise the generator's public boundary against copies of real canonical sources.
test("complete promoted inventory, metadata parity, no-op determinism and resource integrity", (t) => {
  const repo = fixture(t);
  const manifest = readJson(join(repo, ".claude-plugin/plugin.json"));
  const sourceBytes = new Map(manifest.skills.flatMap((source) => ["SKILL.md", "agents/openai.yaml"].map((name) => {
    const path = join(repo, source, name);
    return [path, readFileSync(path, "utf8")];
  })));
  const initial = generateCodexPlugin({ repo });
  assert.equal(initial.skillCount, manifest.skills.length);
  const provenance = readJson(join(repo, packagePath, "provenance.json"));
  assert.deepEqual(provenance.skills.map(({ source }) => source).sort(), [...manifest.skills].sort());
  assert.equal(initial.version, readJson(join(repo, "package.json")).version);
  assert.equal(generateCodexPlugin({ repo }).changedFiles, 0);
  assert.equal(generateCodexPlugin({ repo, check: true }).changedFiles, 0);
  for (const { name, source } of provenance.skills) {
    assert.equal(readFileSync(join(repo, source, "agents/openai.yaml"), "utf8"), readFileSync(join(repo, packagePath, "skills", name, "agents/openai.yaml"), "utf8"));
    const frontmatter = (path) => load(readFileSync(path, "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/)[1], { schema: JSON_SCHEMA });
    const canonical = frontmatter(join(repo, source, "SKILL.md"));
    const packaged = frontmatter(join(repo, packagePath, "skills", name, "SKILL.md"));
    const policy = load(readFileSync(join(repo, packagePath, "skills", name, "agents/openai.yaml"), "utf8"), { schema: JSON_SCHEMA });
    assert.equal(canonical["disable-model-invocation"] === true, policy.policy?.allow_implicit_invocation === false);
    const { "disable-model-invocation": _claudeOnly, ...portable } = canonical;
    assert.deepEqual(packaged, portable);
    assert.equal(packaged["disable-model-invocation"], undefined);
  }
  for (const [path, content] of sourceBytes) assert.equal(readFileSync(path, "utf8"), content, "Generation must not modify canonical invocation metadata or source skills");
  const portable = readJson(join(repo, packagePath, "plugin.json"));
  const compatibility = readJson(join(repo, packagePath, ".codex-plugin/plugin.json"));
  assert.equal(portable.$schema, "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
  assert.equal(portable.version, compatibility.version);
  assert.equal(portable.version, provenance.pluginVersion);
  assert.deepEqual(portable.extensions["com.openai"].interface, compatibility.interface);
  assert.equal(portable.skills, undefined);
  assert.equal(compatibility.skills, "./skills/");
  assert.equal(readFileSync(join(repo, packagePath, "skills/wizard/template.sh"), "utf8"), readFileSync(join(repo, "skills/engineering/wizard/template.sh"), "utf8"));
});

test("source changes get one newer version without a source package version bump", (t) => {
  const repo = fixture(t);
  const before = generateCodexPlugin({ repo });
  const resource = join(repo, "skills/engineering/tdd/tests.md");
  edit(resource, (value) => `${value}\nA focused fixture change.\n`);
  assert.throws(() => generateCodexPlugin({ repo, check: true }), /package drift/);
  const after = generateCodexPlugin({ repo });
  const [major, minor, patch] = before.version.split(".").map(Number);
  assert.equal(after.version, `${major}.${minor}.${patch + 1}`);
  assert.notEqual(after.contentSha256, before.contentSha256);
  assert.equal(generateCodexPlugin({ repo }).version, after.version);
  assert.equal(generateCodexPlugin({ repo, check: true }).changedFiles, 0);
  const nextSourceVersion = `${major + 1}.0.0`;
  for (const file of ["package.json", ".claude-plugin/plugin.json"]) {
    const path = join(repo, file), data = readJson(path);
    saveJson(path, { ...data, version: nextSourceVersion });
  }
  assert.equal(generateCodexPlugin({ repo }).version, nextSourceVersion);
});

test("packaged tampering, additions, policy changes and executable-bit drift are rejected", async (t) => {
  for (const [name, change] of [
    ["extra unpromoted skill", (repo) => {
      const dir = join(repo, packagePath, "skills/unwanted");
      mkdirSync(dir);
      writeFileSync(join(dir, "SKILL.md"), "unwanted");
    }],
    ["resource bytes", (repo) => edit(join(repo, packagePath, "skills/tdd/tests.md"), (value) => `${value}\nmanual edit\n`)],
    ["invocation metadata", (repo) => edit(join(repo, packagePath, "skills/ask-matt/agents/openai.yaml"), (value) => value.replace("false", "true"))],
    ["script executable bit", (repo) => {
      const path = join(repo, packagePath, "skills/wizard/template.sh");
      chmodSync(path, statSync(path).mode & 0o111 ? 0o644 : 0o755);
    }],
    ["compatibility manifest version", (repo) => {
      const path = join(repo, packagePath, ".codex-plugin/plugin.json");
      saveJson(path, { ...readJson(path), version: "0.0.1" });
    }],
  ]) await t.test(name, (t) => {
    const repo = fixture(t);
    generateCodexPlugin({ repo });
    change(repo);
    assert.throws(() => generateCodexPlugin({ repo, check: true }), /package drift/);
    generateCodexPlugin({ repo });
    assert.equal(generateCodexPlugin({ repo, check: true }).changedFiles, 0);
  });
});

test("invalid canonical selection and metadata fail before generating", async (t) => {
  for (const [name, change, expected] of [
    ["non-promoted source", (repo) => {
      const path = join(repo, ".claude-plugin/plugin.json"), data = readJson(path);
      data.skills.push("./skills/misc/extra");
      saveJson(path, data);
    }, /exactly/],
    ["missing promoted source", (repo) => {
      const path = join(repo, ".claude-plugin/plugin.json"), data = readJson(path);
      data.skills.pop();
      saveJson(path, data);
    }, /exactly/],
    ["duplicate source", (repo) => {
      const path = join(repo, ".claude-plugin/plugin.json"), data = readJson(path);
      data.skills.push(data.skills[0]);
      saveJson(path, data);
    }, /Duplicate/],
    ["duplicate skill identity", (repo) => edit(join(repo, "skills/engineering/tdd/SKILL.md"), (value) => value.replace("name: tdd", "name: grilling")), /Unique skill name/],
    ["missing UI metadata", (repo) => edit(join(repo, "skills/engineering/tdd/agents/openai.yaml"), (value) => value.replace(/  display_name:.*\n/, "")), /display_name/],
    ["invalid policy object", (repo) => edit(join(repo, "skills/engineering/tdd/agents/openai.yaml"), (value) => `${value}policy: false\n`), /must be an object/],
    ["marketplace points to canonical tree", (repo) => {
      const path = join(repo, ".agents/plugins/marketplace.json"), data = readJson(path);
      data.plugins[0].source.path = "./";
      saveJson(path, data);
    }, /must point only/],
    ["string policy", (repo) => edit(join(repo, "skills/engineering/ask-matt/agents/openai.yaml"), (value) => value.replace("false", '"false"')), /must be boolean/],
    ["user-only policy made implicit", (repo) => edit(join(repo, "skills/engineering/ask-matt/agents/openai.yaml"), (value) => value.replace("false", "true")), /policy mismatch/],
    ["implicit skill made explicit-only", (repo) => edit(join(repo, "skills/engineering/tdd/agents/openai.yaml"), (value) => `${value}policy:\n  allow_implicit_invocation: false\n`), /policy mismatch/],
    ["duplicate YAML key", (repo) => edit(join(repo, "skills/engineering/tdd/agents/openai.yaml"), (value) => `${value}interface: {}\n`), /duplicated mapping key/],
    ["missing resource link", (repo) => edit(join(repo, "skills/engineering/tdd/SKILL.md"), (value) => `${value}\nRead [missing](missing.md).\n`), /Missing packaged resource/],
    ["escaping resource link", (repo) => edit(join(repo, "skills/engineering/tdd/SKILL.md"), (value) => `${value}\nRead [outside](..\/..\/outside.md).\n`), /escapes its skill/],
    ["resource symlink", (repo) => symlinkSync(join(repo, "LICENSE"), join(repo, "skills/engineering/tdd/linked.txt")), /Symlinks/],
    ["nested identity", (repo) => {
      mkdirSync(join(repo, "skills/engineering/tdd/nested"));
      writeFileSync(join(repo, "skills/engineering/tdd/nested/SKILL.md"), "nested");
    }, /Nested skill/],
    ["Claude version mismatch", (repo) => {
      const path = join(repo, ".claude-plugin/plugin.json"), data = readJson(path);
      saveJson(path, { ...data, version: "0.0.1" });
    }, /version differs/],
  ]) await t.test(name, (t) => {
    const repo = fixture(t);
    change(repo);
    assert.throws(() => generateCodexPlugin({ repo }), expected);
  });
});
