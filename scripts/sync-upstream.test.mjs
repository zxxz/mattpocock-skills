import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("./sync-upstream.sh", import.meta.url));
const branch = "codex/sync-upstream";

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), "skills-sync-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-b", "main");
  git("config", "user.name", "Sync test");
  git("config", "user.email", "sync@example.invalid");
  const commit = (path, text) => {
    writeFileSync(join(cwd, path), text);
    git("add", path);
    git("commit", "-m", path);
    return git("rev-parse", "HEAD");
  };
  const base = commit("shared.txt", "base\n");
  git("update-ref", "refs/remotes/origin/main", base);
  git("update-ref", "refs/remotes/upstream/main", base);
  const sync = () => spawnSync("bash", [script], { cwd, encoding: "utf8" });
  return { cwd, git, commit, base, sync };
}

test("no-op synchronization creates no commits and leaves fork main intact", (t) => {
  const { git, base, sync } = fixture(t);
  const result = sync();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(git("branch", "--show-current"), branch);
  assert.equal(git("rev-parse", "HEAD"), base);
  assert.equal(git("rev-parse", "main"), base);
});

test("upstream updates preserve fork commits and merge ancestry", (t) => {
  const { cwd, git, commit, base, sync } = fixture(t);
  const fork = commit("fork.txt", "fork customization\n");
  git("update-ref", "refs/remotes/origin/main", fork);
  git("switch", "--detach", base);
  const upstream = commit("upstream.txt", "upstream addition\n");
  git("update-ref", "refs/remotes/upstream/main", upstream);
  const result = sync();
  assert.equal(result.status, 0, result.stderr);
  git("merge-base", "--is-ancestor", fork, "HEAD");
  git("merge-base", "--is-ancestor", upstream, "HEAD");
  assert.equal(git("rev-list", "--parents", "-n", "1", "HEAD").split(" ").length, 3);
  assert.equal(readFileSync(join(cwd, "fork.txt"), "utf8"), "fork customization\n");
  assert.equal(git("rev-parse", "main"), fork);
});

test("an existing sync branch advances without rewriting previous commits", (t) => {
  const { git, commit, sync } = fixture(t);
  git("switch", "-c", "previous-sync");
  const previous = commit("generated.txt", "previous plugin\n");
  git("update-ref", `refs/remotes/origin/${branch}`, previous);
  git("switch", "main");
  const fork = commit("fork.txt", "new fork change\n");
  git("update-ref", "refs/remotes/origin/main", fork);
  const result = sync();
  assert.equal(result.status, 0, result.stderr);
  git("merge-base", "--is-ancestor", previous, "HEAD");
  git("merge-base", "--is-ancestor", fork, "HEAD");
  assert.equal(git("rev-parse", "main"), fork);
});

test("merge conflicts stop and abort without changing fork main", (t) => {
  const { cwd, git, commit, base, sync } = fixture(t);
  const fork = commit("shared.txt", "fork edit\n");
  git("update-ref", "refs/remotes/origin/main", fork);
  git("switch", "--detach", base);
  const upstream = commit("shared.txt", "upstream edit\n");
  git("update-ref", "refs/remotes/upstream/main", upstream);
  const result = sync();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Resolve.*codex\/sync-upstream/);
  assert.equal(git("rev-parse", "main"), fork);
  assert.equal(git("status", "--porcelain"), "");
  assert.equal(readFileSync(join(cwd, "shared.txt"), "utf8"), "fork edit\n");
});

test("a previously merged sync branch becomes a no-op without another commit", (t) => {
  const { git, commit, sync } = fixture(t);
  git("switch", "-c", "previous-sync");
  const previous = commit("generated.txt", "accepted plugin\n");
  git("update-ref", `refs/remotes/origin/${branch}`, previous);
  git("switch", "main");
  git("merge", "--no-ff", "--no-edit", previous);
  const accepted = git("rev-parse", "HEAD");
  git("update-ref", "refs/remotes/origin/main", accepted);
  const result = sync();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(git("rev-parse", "HEAD"), accepted);
  assert.equal(git("rev-list", "--count", "origin/main..HEAD"), "0");
});

test("dirty checkouts are rejected before switching branches", (t) => {
  const { cwd, git, sync } = fixture(t);
  writeFileSync(join(cwd, "unrelated.txt"), "keep this\n");
  const result = sync();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /clean checkout/);
  assert.equal(git("branch", "--show-current"), "main");
  assert.equal(readFileSync(join(cwd, "unrelated.txt"), "utf8"), "keep this\n");
});
