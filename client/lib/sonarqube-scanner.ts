import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const execFileAsync = promisify(execFile);

type ScanRegistry = Map<string, Promise<void>>;

const globalWithScans = globalThis as typeof globalThis & {
  reporithmScans?: ScanRegistry;
};

const activeScans = globalWithScans.reporithmScans ?? new Map<string, Promise<void>>();
globalWithScans.reporithmScans = activeScans;

function scannerScriptPath() {
  const workspaceRoot = process.cwd().endsWith("client")
    ? resolve(process.cwd(), "..")
    : process.cwd();
  return resolve(workspaceRoot, "scripts/scan-github.mjs");
}

export function automaticScanningEnabled() {
  return process.env.SONARQUBE_AUTO_SCAN === "true";
}

export async function scanGitHubRepository(repositoryUrl: string, projectKey: string) {
  const running = activeScans.get(projectKey);
  if (running) return running;

  const scan = (async () => {
    const script = scannerScriptPath();
    await access(script);

    await execFileAsync(process.execPath, [script, repositoryUrl], {
      cwd: resolve(script, "../.."),
      env: process.env,
      maxBuffer: 8 * 1024 * 1024,
      timeout: 5 * 60 * 1000,
    });
  })();

  activeScans.set(projectKey, scan);

  try {
    await scan;
  } finally {
    activeScans.delete(projectKey);
  }
}
