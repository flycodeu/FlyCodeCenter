import { watch } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const nodeBin = process.execPath;
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
const forwardedArgs = process.argv.slice(2);
const args = ["run", "dev:astro", ...(forwardedArgs.length ? ["--", ...forwardedArgs] : [])];
const warmupDisabled = process.env.FLY_DEV_WARMUP === "0";
const warmupPaths = String(process.env.FLY_DEV_WARMUP_PATHS || "/")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

let warmed = false;
let childExited = false;
let restarting = false;
let shuttingDown = false;
let child;
let themeRestartTimer;

const syncResult = spawnSync(nodeBin, ["./scripts/fix-frontmatter-normalization.mjs"], {
  cwd: rootDir,
  env: process.env,
  stdio: "inherit"
});

if (syncResult.status !== 0) {
  process.exit(syncResult.status ?? 1);
}

function normalizeWarmupUrl(baseUrl, targetPath) {
  try {
    return new URL(targetPath, baseUrl).toString();
  } catch {
    return "";
  }
}

async function runWarmup(baseUrl) {
  if (warmed || warmupDisabled) return;
  warmed = true;

  for (const targetPath of warmupPaths) {
    const url = normalizeWarmupUrl(baseUrl, targetPath);
    if (!url) continue;

    const startedAt = Date.now();
    process.stdout.write(`\n[dev:warmup] prewarming ${targetPath}\n`);
    try {
      const response = await fetch(url, {
        headers: {
          "x-fly-dev-warmup": "1"
        }
      });
      const elapsed = Date.now() - startedAt;
      process.stdout.write(`[dev:warmup] ${response.status} ${targetPath} ${elapsed}ms\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stdout.write(`[dev:warmup] failed ${targetPath}: ${message}\n`);
    }
  }
}

function tryWarmFromOutput(text) {
  if (warmed || warmupDisabled) return;
  const match = text.match(/https?:\/\/[^\s]+/);
  if (!match?.[0]) return;
  void runWarmup(match[0]);
}

function pipeOutput(stream, target) {
  stream.on("data", (chunk) => {
    const text = String(chunk);
    target.write(text);
    tryWarmFromOutput(text);
  });
}

function cleanAstroCache() {
  const result = spawnSync(nodeBin, ["./scripts/clean-astro-cache.mjs"], {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit"
  });
  return result.status === 0;
}

function startAstro() {
  const nextChild = spawn(npmBin, args, {
    cwd: rootDir,
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
    shell: process.platform === "win32"
  });

  pipeOutput(nextChild.stdout, process.stdout);
  pipeOutput(nextChild.stderr, process.stderr);

  nextChild.on("exit", (code, signal) => {
    if (shuttingDown) {
      childExited = true;
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      process.exit(code ?? 0);
    }

    if (restarting) {
      if (!cleanAstroCache()) {
        restarting = false;
        childExited = true;
        process.exit(1);
      }
      restarting = false;
      childExited = false;
      child = startAstro();
      return;
    }

    childExited = true;
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });

  return nextChild;
}

function requestThemeRestart(filename) {
  if (childExited || restarting) return;
  if (themeRestartTimer) clearTimeout(themeRestartTimer);
  themeRestartTimer = setTimeout(() => {
    themeRestartTimer = undefined;
    if (childExited || restarting) return;
    restarting = true;
    process.stdout.write(`\n[dev] theme changed (${filename || "theme css"}), restarting Astro and clearing cache...\n`);
    child?.kill();
  }, 240);
}

function forwardSignal(signal) {
  if (childExited) return;
  shuttingDown = true;
  child.kill(signal);
}

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

child = startAstro();
const themeWatcher = watch(path.join(rootDir, "src", "themes"), { recursive: true }, (_eventType, filename) => {
  if (!filename || /\.css$/i.test(String(filename))) requestThemeRestart(String(filename || ""));
});
process.on("exit", () => themeWatcher.close());
