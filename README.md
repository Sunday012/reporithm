# Reporithm

Reporithm combines public GitHub signals with verified SonarQube results to report both repository health and actual code quality.

## What it analyzes

- Repository activity, commits, contributors, issues, and pull requests
- Community essentials including README, license, security policy, and contribution templates
- Adoption, maintenance, collaboration, and language composition
- Prioritized improvements grounded in visible repository evidence
- SonarQube quality gate, bugs, vulnerabilities, security hotspots, code smells, coverage, duplication, ratings, complexity, and technical debt

## Run locally

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:3000` and enter a public GitHub URL or `owner/repository`.

Copy the environment template and add your service credentials:

```bash
cp .env.example .env.local
```

Unauthenticated GitHub requests are rate-limited. Add `GITHUB_TOKEN` for a higher allowance.

## SonarQube deep analysis

### Self-hosted setup

The repository includes a local SonarQube Community Build and PostgreSQL stack with persistent Docker volumes.

```bash
# From the repository root
npm run sonar:start
npm run sonar:setup
npm run sonar:scan
```

To scan another public GitHub repository into the local instance:

```bash
npm run sonar:scan:github -- https://github.com/owner/repository
```

- SonarQube: `http://localhost:9000`
- Reporithm reads the generated connection from `client/.env.local`.
- Local setup enables automatic first-time scans: entering a new public GitHub repository clones it into an isolated temporary directory, scans it, removes the checkout, and returns the completed SonarQube results.
- The local SonarQube administrator credentials are stored in `.env.sonarqube.local`.
- Both credential files are git-ignored and restricted to the current user.
- `npm run sonar:stop` stops the services without deleting analysis data.

The Compose configuration disables Elasticsearch bootstrap checks for local workstation use, avoiding a permanent host kernel change. For an internet-facing or production deployment, enable the checks and set `vm.max_map_count` on the host instead.

### Connect another SonarQube server

Configure these server-only environment variables in `client/.env.local`:

```bash
SONARQUBE_URL=http://localhost:9000
SONARQUBE_TOKEN=your_token
SONARQUBE_PROJECT_KEY_TEMPLATE={owner}_{repo}
```

Reporithm reads completed SonarQube analyses. Each repository must be scanned by CI or SonarScanner using the same project-key convention. For example:

```bash
sonar-scanner \
  -Dsonar.host.url="$SONARQUBE_URL" \
  -Dsonar.token="$SONARQUBE_TOKEN" \
  -Dsonar.projectKey=owner_repository \
  -Dsonar.sources=.
```

Coverage requires the repository's test runner to produce a supported coverage report and the corresponding SonarQube analysis property to reference it.

The included local scanner analyzes this repository with the `Sunday012_reporithm` project key, matching the default `{owner}_{repo}` lookup convention.

The GitHub integration runs in a server-side Next.js route, keeping credentials out of the browser without requiring a separate backend service.
