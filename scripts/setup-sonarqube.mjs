import { randomBytes } from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const appEnvPath = resolve(root, "client/.env.local");
const adminEnvPath = resolve(root, ".env.sonarqube.local");
const sonarUrl = "http://localhost:9000";
const tokenName = "reporithm-local";

const readOptional = async (path) => {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
};

const parseEnv = (source) =>
  Object.fromEntries(
    source
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );

const request = async (path, username, password, body) => {
  const response = await fetch(`${sonarUrl}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body,
  });

  return response;
};

const statusResponse = await fetch(`${sonarUrl}/api/system/status`);
const status = await statusResponse.json();
if (status.status !== "UP") {
  throw new Error(`SonarQube is not ready (status: ${status.status ?? "unknown"}).`);
}

const savedAdmin = parseEnv(await readOptional(adminEnvPath));
const username = savedAdmin.SONARQUBE_ADMIN_USER || "admin";
let password = savedAdmin.SONARQUBE_ADMIN_PASSWORD || "admin";

if (!savedAdmin.SONARQUBE_ADMIN_PASSWORD) {
  const replacement = `Rp!${randomBytes(18).toString("hex")}9a`;
  const changeResponse = await request(
    "/api/users/change_password",
    username,
    password,
    new URLSearchParams({ login: username, previousPassword: password, password: replacement }),
  );

  if (!changeResponse.ok) {
    const detail = await changeResponse.text();
    throw new Error(
      `Could not replace the default SonarQube password (${changeResponse.status}): ${detail}`,
    );
  }

  password = replacement;
  await writeFile(
    adminEnvPath,
    `SONARQUBE_ADMIN_USER=${username}\nSONARQUBE_ADMIN_PASSWORD=${password}\n`,
    { mode: 0o600 },
  );
}

await request(
  "/api/user_tokens/revoke",
  username,
  password,
  new URLSearchParams({ name: tokenName }),
);

const tokenResponse = await request(
  "/api/user_tokens/generate",
  username,
  password,
  // Reporithm needs both Execute Analysis and Browse permissions: it uploads
  // scans and reads measures through SonarQube's Web API.
  new URLSearchParams({ name: tokenName, type: "USER_TOKEN" }),
);

if (!tokenResponse.ok) {
  throw new Error(`Could not create a SonarQube token (${tokenResponse.status}).`);
}

const { token } = await tokenResponse.json();
const existingAppEnv = parseEnv(await readOptional(appEnvPath));
const appEnv = [
  "# Optional: raises GitHub's API rate limit for repository analysis.",
  `GITHUB_TOKEN=${existingAppEnv.GITHUB_TOKEN || ""}`,
  "",
  "# Local self-hosted SonarQube connection.",
  `SONARQUBE_URL=${sonarUrl}`,
  `SONARQUBE_TOKEN=${token}`,
  "SONARQUBE_AUTO_SCAN=true",
  "SONARQUBE_PROJECT_KEY_TEMPLATE={owner}_{repo}",
  "",
].join("\n");

await writeFile(appEnvPath, appEnv, { mode: 0o600 });
await chmod(appEnvPath, 0o600);

console.log("SonarQube credentials created and Reporithm connected.");
console.log("Secrets were written to ignored local environment files.");
