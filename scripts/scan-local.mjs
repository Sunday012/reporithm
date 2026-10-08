import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const envSource = await readFile(resolve(root, "client/.env.local"), "utf8");
const tokenLine = envSource.split(/\r?\n/).find((line) => line.startsWith("SONARQUBE_TOKEN="));
const token = tokenLine?.slice("SONARQUBE_TOKEN=".length);

if (!token) {
  throw new Error("SONARQUBE_TOKEN is missing. Run `npm run sonar:setup` first.");
}

const child = spawn(
  "docker",
  [
    "run",
    "--rm",
    "--network",
    "reporithm-sonar_default",
    "-e",
    "SONAR_HOST_URL=http://sonarqube:9000",
    "-e",
    "SONAR_TOKEN",
    "-v",
    `${root}:/usr/src`,
    "sonarsource/sonar-scanner-cli",
  ],
  {
    cwd: root,
    env: { ...process.env, SONAR_TOKEN: token },
    stdio: "inherit",
  },
);

child.on("exit", (code) => process.exit(code ?? 1));
