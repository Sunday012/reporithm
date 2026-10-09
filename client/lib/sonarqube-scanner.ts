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

type WorkerJob = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  error?: string;
};

const wait = (milliseconds: number) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));

function workerConfiguration() {
  const url = process.env.SCAN_WORKER_URL?.trim().replace(/\/$/, "");
  const secret = process.env.SCAN_WORKER_SECRET?.trim();

  if (!url && !secret) return null;
  if (!url || !secret) {
    throw new Error("SCAN_WORKER_URL and SCAN_WORKER_SECRET must be configured together.");
  }

  const parsedUrl = new URL(url);
  if (process.env.NODE_ENV === "production" && parsedUrl.protocol !== "https:") {
    throw new Error("SCAN_WORKER_URL must use HTTPS in production.");
  }

  return { url, secret };
}

function workerTimeout() {
  const configured = Number(process.env.SCAN_WORKER_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return 220_000;
  return Math.min(260_000, Math.max(30_000, configured));
}

async function workerFetch(url: string, secret: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${secret}`,
      ...init?.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Scan worker request failed with status ${response.status}${detail ? `: ${detail}` : "."}`);
  }

  return response;
}

async function scanWithRemoteWorker(repositoryUrl: string, configuration: { url: string; secret: string }) {
  const createResponse = await workerFetch(`${configuration.url}/v1/scans`, configuration.secret, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repositoryUrl }),
  });
  const created = (await createResponse.json()) as WorkerJob;

  if (!created.id) throw new Error("Scan worker returned an invalid job response.");

  const deadline = Date.now() + workerTimeout();
  while (Date.now() < deadline) {
    const statusResponse = await workerFetch(
      `${configuration.url}/v1/scans/${encodeURIComponent(created.id)}`,
      configuration.secret,
    );
    const job = (await statusResponse.json()) as WorkerJob;

    if (job.status === "completed") return;
    if (job.status === "failed") throw new Error(job.error || "The scan worker could not analyze this repository.");
    await wait(1_500);
  }

  throw new Error("The scan is still running but the request reached its waiting limit. Try the repository again shortly.");
}

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
    const worker = workerConfiguration();
    if (worker) {
      await scanWithRemoteWorker(repositoryUrl, worker);
      return;
    }

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
