import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const repositoryInput = process.argv[2];

if (!repositoryInput) {
  throw new Error("Pass a public GitHub URL, for example: npm run sonar:scan:github -- https://github.com/owner/repository");
}

const repositoryUrl = new URL(repositoryInput);
const segments = repositoryUrl.pathname.replace(/\.git$/, "").split("/").filter(Boolean);

if (repositoryUrl.protocol !== "https:" || repositoryUrl.hostname !== "github.com" || segments.length !== 2) {
  throw new Error("Only HTTPS GitHub repository URLs in the form https://github.com/owner/repository are supported.");
}

const [owner, repository] = segments;
const projectKey = `${owner}_${repository}`;
const checkout = await mkdtemp(join(tmpdir(), "reporithm-scan-"));

const run = (command, args, options = {}) =>
  new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolveRun();
      else reject(new Error(`${command} exited with status ${code ?? "unknown"}.`));
    });
  });

try {
  console.log(`Cloning ${owner}/${repository} into an isolated temporary directory...`);
  await run("git", ["clone", "--depth", "1", repositoryUrl.href, checkout]);

  let token = process.env.SONARQUBE_TOKEN;

  if (!token) {
    const envSource = await readFile(resolve(root, "client/.env.local"), "utf8");
    const tokenLine = envSource.split(/\r?\n/).find((line) => line.startsWith("SONARQUBE_TOKEN="));
    token = tokenLine?.slice("SONARQUBE_TOKEN=".length);
  }

  if (!token) {
    throw new Error("SONARQUBE_TOKEN is missing. Run `npm run sonar:setup` first.");
  }

  await run(
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
      `${checkout}:/usr/src:ro`,
      "sonarsource/sonar-scanner-cli",
      `-Dsonar.projectKey=${projectKey}`,
      `-Dsonar.projectName=${owner}/${repository}`,
      "-Dsonar.sources=.",
      "-Dsonar.exclusions=**/node_modules/**,**/.next/**,**/dist/**,**/build/**,**/coverage/**",
      // External repositories are shallow temporary clones. Disabling SCM avoids
      // blame failures on unusual trees, including repositories where .gitignore
      // is a directory, without disabling code-quality or security analysis.
      "-Dsonar.scm.disabled=true",
      "-Dsonar.sourceEncoding=UTF-8",
    ],
    { cwd: root, env: { ...process.env, SONAR_TOKEN: token } },
  );

  console.log(`Analysis submitted with project key ${projectKey}.`);
} finally {
  await rm(checkout, { recursive: true, force: true });
}
