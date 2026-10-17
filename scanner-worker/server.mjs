import { spawn } from "node:child_process";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = integerEnvironment("PORT", 8787, 1, 65_535);
const maximumConcurrentScans = integerEnvironment("MAX_CONCURRENT_SCANS", 1, 1, 4);
const maximumQueuedScans = integerEnvironment("MAX_QUEUED_SCANS", 10, 1, 100);
const maximumCheckoutMb = integerEnvironment("MAX_CHECKOUT_MB", 500, 10, 2_000);
const scanTimeoutMs = integerEnvironment("SCAN_TIMEOUT_MS", 240_000, 30_000, 900_000);
const jobRetentionMs = integerEnvironment("JOB_RETENTION_MS", 3_600_000, 60_000, 86_400_000);
const maximumFreeAnalyses = integerEnvironment("MAX_FREE_ANALYSES", 1, 1, 100);
const workerSecret = requiredEnvironment("SCAN_WORKER_SECRET");
const sonarHostUrl = requiredEnvironment("SONAR_HOST_URL").replace(/\/$/, "");
const sonarToken = requiredEnvironment("SONAR_TOKEN");
const quotaFile = process.env.QUOTA_FILE?.trim() || "/data/analysis-quota.json";

if (Buffer.byteLength(workerSecret) < 32) {
  throw new Error("SCAN_WORKER_SECRET must contain at least 32 bytes.");
}

const jobs = new Map();
const queue = [];
const usage = new Map();
const reservations = new Map();
let activeScans = 0;
let quotaWrite = Promise.resolve();

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function integerEnvironment(name, fallback, minimum, maximum) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}

function authorized(request) {
  const authorization = request.headers.authorization ?? "";
  const candidate = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const expectedBuffer = Buffer.from(workerSecret);
  const candidateBuffer = Buffer.from(candidate);
  return expectedBuffer.length === candidateBuffer.length && timingSafeEqual(expectedBuffer, candidateBuffer);
}

function json(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(payload),
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(payload);
}

function persistQuota() {
  const directory = quotaFile.slice(0, quotaFile.lastIndexOf("/")) || ".";
  const temporaryFile = `${quotaFile}.tmp`;
  const payload = JSON.stringify({ usage: Object.fromEntries(usage), reservations: Object.fromEntries(reservations) });
  quotaWrite = quotaWrite.catch(() => undefined).then(async () => {
    await mkdir(directory, { recursive: true });
    await writeFile(temporaryFile, payload, { mode: 0o600 });
    await rename(temporaryFile, quotaFile);
  });
  return quotaWrite;
}

async function loadQuota() {
  try {
    const stored = JSON.parse(await readFile(quotaFile, "utf8"));
    for (const [visitorId, count] of Object.entries(stored.usage ?? {})) {
      if (/^[a-f0-9]{64}$/.test(visitorId) && Number.isInteger(count) && count >= 0) usage.set(visitorId, count);
    }
    for (const [reservationId, reservation] of Object.entries(stored.reservations ?? {})) {
      if (
        /^[0-9a-f-]{36}$/i.test(reservationId) &&
        reservation &&
        /^[a-f0-9]{64}$/.test(reservation.visitorId) &&
        Number.isFinite(Date.parse(reservation.createdAt))
      ) {
        reservations.set(reservationId, reservation);
      }
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function validVisitorId(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

async function reserveAnalysis(request, response) {
  try {
    const { visitorId } = await readJson(request);
    if (!validVisitorId(visitorId)) {
      json(response, 400, { error: "A valid visitor identifier is required." });
      return;
    }

    const alreadyReserved = [...reservations.values()].some((reservation) => reservation.visitorId === visitorId);
    if ((usage.get(visitorId) ?? 0) >= maximumFreeAnalyses || alreadyReserved) {
      json(response, 429, {
        code: "free_analysis_used",
        error: "Your free repository analysis has already been used.",
      });
      return;
    }

    const reservationId = randomUUID();
    reservations.set(reservationId, { visitorId, createdAt: new Date().toISOString() });
    await persistQuota();
    json(response, 201, { reservationId, remaining: Math.max(0, maximumFreeAnalyses - 1) });
  } catch (error) {
    json(response, 400, { error: error instanceof Error ? error.message : "Invalid quota request." });
  }
}

async function finishReservation(reservationId, commit, response) {
  const reservation = reservations.get(reservationId);
  if (!reservation) {
    json(response, 404, { error: "Analysis reservation not found." });
    return;
  }

  if (commit) usage.set(reservation.visitorId, (usage.get(reservation.visitorId) ?? 0) + 1);
  reservations.delete(reservationId);
  await persistQuota();
  json(response, 200, {
    remaining: Math.max(0, maximumFreeAnalyses - (usage.get(reservation.visitorId) ?? 0)),
  });
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > 4_096) throw new Error("Request body is too large.");
  }
  return JSON.parse(body || "{}");
}

function parseRepository(repositoryInput) {
  if (typeof repositoryInput !== "string") throw new Error("repositoryUrl must be a GitHub URL.");

  const url = new URL(repositoryInput);
  const segments = url.pathname.replace(/\.git$/, "").split("/").filter(Boolean);
  const validOwner = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
  const validRepository = /^(?!\.{1,2}$)[A-Za-z0-9_.-]{1,100}$/;

  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.port ||
    url.username ||
    url.password ||
    segments.length !== 2 ||
    !validOwner.test(segments[0]) ||
    !validRepository.test(segments[1])
  ) {
    throw new Error("Only public HTTPS GitHub URLs in the form https://github.com/owner/repository are supported.");
  }

  const [owner, repository] = segments;
  return {
    cloneUrl: `https://github.com/${owner}/${repository}.git`,
    fullName: `${owner}/${repository}`,
    projectKey: `${owner}_${repository}`,
  };
}

function publicJob(job) {
  return {
    id: job.id,
    status: job.status,
    repository: job.repository.fullName,
    projectKey: job.repository.projectKey,
    createdAt: job.createdAt,
    startedAt: job.startedAt ?? null,
    finishedAt: job.finishedAt ?? null,
    ...(job.status === "failed" ? { error: job.error } : {}),
  };
}

function run(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const capture = (chunk) => {
      output = `${output}${chunk}`.slice(-16_384);
    };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
    }, options.timeoutMs ?? scanTimeoutMs);
    timer.unref();

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolveRun(output);
      else reject(new Error(`${command} failed (${signal ?? `status ${code ?? "unknown"}`}). ${output}`.trim()));
    });
  });
}

async function scan(job) {
  const checkout = await mkdtemp(join(tmpdir(), "reporithm-scan-"));
  const deadline = Date.now() + scanTimeoutMs;
  const remainingTime = () => Math.max(1, deadline - Date.now());
  try {
    await run("git", ["clone", "--depth", "1", "--no-tags", job.repository.cloneUrl, checkout], {
      timeoutMs: remainingTime(),
    });

    const diskUsage = await run("du", ["-sm", checkout], { timeoutMs: 30_000 });
    const checkoutMb = Number.parseInt(diskUsage, 10);
    if (!Number.isFinite(checkoutMb) || checkoutMb > maximumCheckoutMb) {
      throw new Error(`Repository checkout exceeds the ${maximumCheckoutMb} MB scan limit.`);
    }

    await run(
      "sonar-scanner",
      [
        `-Dsonar.host.url=${sonarHostUrl}`,
        `-Dsonar.projectKey=${job.repository.projectKey}`,
        `-Dsonar.projectName=${job.repository.fullName}`,
        "-Dsonar.sources=.",
        "-Dsonar.exclusions=**/.git/**,**/node_modules/**,**/.next/**,**/dist/**,**/build/**,**/coverage/**",
        "-Dsonar.scm.disabled=true",
        "-Dsonar.sourceEncoding=UTF-8",
      ],
      {
        cwd: checkout,
        env: { ...process.env, SONAR_HOST_URL: sonarHostUrl, SONAR_TOKEN: sonarToken },
        timeoutMs: remainingTime(),
      },
    );
  } finally {
    await rm(checkout, { recursive: true, force: true });
  }
}

function drainQueue() {
  while (activeScans < maximumConcurrentScans && queue.length > 0) {
    const job = queue.shift();
    activeScans += 1;
    job.status = "running";
    job.startedAt = new Date().toISOString();
    console.log(`[scan:${job.id}] started ${job.repository.fullName}`);

    scan(job)
      .then(() => {
        job.status = "completed";
        console.log(`[scan:${job.id}] completed ${job.repository.fullName}`);
      })
      .catch((error) => {
        job.status = "failed";
        job.error = error instanceof Error ? error.message.slice(0, 1_000) : "The scan failed.";
        console.error(`[scan:${job.id}] failed ${job.repository.fullName}:`, error);
      })
      .finally(() => {
        job.finishedAt = new Date().toISOString();
        activeScans -= 1;
        drainQueue();
      });
  }
}

async function createScan(request, response) {
  try {
    const body = await readJson(request);
    const repository = parseRepository(body.repositoryUrl);
    const existing = [...jobs.values()].find(
      (job) => job.repository.projectKey === repository.projectKey && job.status !== "failed",
    );
    if (existing) {
      json(response, 202, publicJob(existing));
      return;
    }

    if (queue.length >= maximumQueuedScans) {
      json(response, 429, { error: "The scan queue is full. Try again later." });
      return;
    }

    const job = {
      id: randomUUID(),
      status: "queued",
      repository,
      createdAt: new Date().toISOString(),
    };
    jobs.set(job.id, job);
    queue.push(job);
    drainQueue();
    json(response, 202, publicJob(job));
  } catch (error) {
    json(response, 400, { error: error instanceof Error ? error.message : "Invalid scan request." });
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "GET" && url.pathname === "/health") {
    json(response, 200, { status: "ok", activeScans, queuedScans: queue.length });
    return;
  }

  if (!authorized(request)) {
    json(response, 401, { error: "Unauthorized." });
    return;
  }

  if (request.method === "POST" && url.pathname === "/v1/scans") {
    await createScan(request, response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/v1/quota/reservations") {
    await reserveAnalysis(request, response);
    return;
  }

  const quotaMatch = url.pathname.match(/^\/v1\/quota\/reservations\/([0-9a-f-]+)$/i);
  if (quotaMatch && request.method === "POST") {
    await finishReservation(quotaMatch[1], true, response);
    return;
  }
  if (quotaMatch && request.method === "DELETE") {
    await finishReservation(quotaMatch[1], false, response);
    return;
  }

  const match = request.method === "GET" && url.pathname.match(/^\/v1\/scans\/([0-9a-f-]+)$/i);
  if (match) {
    const job = jobs.get(match[1]);
    if (!job) json(response, 404, { error: "Scan job not found." });
    else json(response, 200, publicJob(job));
    return;
  }

  json(response, 404, { error: "Not found." });
});

server.requestTimeout = 20_000;
server.headersTimeout = 10_000;
await loadQuota();
server.listen(port, "0.0.0.0", () => console.log(`Reporithm scan worker listening on port ${port}.`));

setInterval(() => {
  const cutoff = Date.now() - jobRetentionMs;
  for (const [id, job] of jobs) {
    if (job.finishedAt && Date.parse(job.finishedAt) < cutoff) jobs.delete(id);
  }
  let quotaChanged = false;
  for (const [id, reservation] of reservations) {
    if (Date.parse(reservation.createdAt) < cutoff) {
      reservations.delete(id);
      quotaChanged = true;
    }
  }
  if (quotaChanged) persistQuota().catch((error) => console.error("Could not persist quota cleanup:", error));
}, 60_000).unref();

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
