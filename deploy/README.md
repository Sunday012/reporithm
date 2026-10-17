# Reporithm production services

This stack runs the stateful part of Reporithm on an ordinary Linux VPS while the Next.js application remains on Vercel:

- SonarQube Community Build and PostgreSQL
- An authenticated, bounded-concurrency scan worker
- Caddy for automatic HTTPS

The worker accepts only canonical public GitHub repository URLs. It clones into an isolated temporary directory, enforces time and checkout-size limits, runs SonarScanner without a Docker socket, and deletes the checkout after every attempt.

## 1. Prepare a host

Use a 64-bit Linux VPS with Docker Engine and the Compose plugin installed. SonarQube requires at least 2 CPU cores, 4 GB RAM, and 30 GB disk for a small installation; 4 vCPUs and 8 GB RAM is a more comfortable starting point when this host also performs scans.

Point two DNS records at the server before starting Caddy:

```text
sonar.example.com   -> VPS IP
scanner.example.com -> VPS IP
```

Allow inbound TCP ports 22, 80, and 443 and UDP port 443. Do not expose PostgreSQL or port 9000 directly.

Configure the required Elasticsearch host limits:

```bash
sudo sh -c 'printf "vm.max_map_count=524288\nfs.file-max=131072\n" > /etc/sysctl.d/99-sonarqube.conf'
sudo sysctl --system
sysctl vm.max_map_count
sysctl fs.file-max
```

## 2. Create the deployment environment

From the cloned repository:

```bash
cp deploy/.env.production.example deploy/.env.production
openssl rand -hex 32
openssl rand -hex 32
openssl rand -base64 32
```

Put different hexadecimal values in `POSTGRES_PASSWORD` and `SCAN_WORKER_SECRET`, and put the Base64 value in `SONAR_AUTH_JWTBASE64HS256SECRET`. Then set the two hostnames and your ACME email. `deploy/.env.production` is git-ignored and must never be committed.

## 3. Start SonarQube first

Start the database and SonarQube, followed by Caddy without its worker dependency:

```bash
docker compose --env-file deploy/.env.production -f deploy/compose.production.yml up -d database sonarqube
docker compose --env-file deploy/.env.production -f deploy/compose.production.yml up -d --no-deps caddy
docker compose --env-file deploy/.env.production -f deploy/compose.production.yml logs -f sonarqube
```

Wait until SonarQube reports that it is operational, then open `https://sonar.example.com`. Sign in with the initial `admin` / `admin` account and change the password immediately.

Create a dedicated service user for Reporithm. Grant it `Browse` and `Execute Analysis`, then create a **user token** under **My Account → Security**. A user token is required because Reporithm both submits analyses and reads project measures through the Web API.

Put that token in `deploy/.env.production` as `SONARQUBE_TOKEN`.

## 4. Start the worker

```bash
npm run production:start
docker compose --env-file deploy/.env.production -f deploy/compose.production.yml ps
curl https://scanner.example.com/health
```

The health endpoint should return `{"status":"ok",...}`. All scan and status endpoints require `Authorization: Bearer <SCAN_WORKER_SECRET>`.

## 5. Configure Vercel

Add these server-only variables to the Reporithm Vercel project for Production and Preview:

```dotenv
GITHUB_TOKEN=github_pat_...
SONARQUBE_URL=https://sonar.example.com
SONARQUBE_TOKEN=the-service-user-token
SONARQUBE_AUTO_SCAN=true
SONARQUBE_PROJECT_KEY_TEMPLATE={owner}_{repo}
SCAN_WORKER_URL=https://scanner.example.com
SCAN_WORKER_SECRET=the-same-random-worker-secret
SCAN_WORKER_TIMEOUT_MS=220000
NEXT_PUBLIC_SIGN_UP_URL=https://your-signup-or-waitlist-page.example
```

Redeploy Reporithm after saving the variables. These values are read only by the server-side Next.js route and are not bundled into the browser. Add a Vercel Firewall rate limit for `POST /api/analyze` before promoting the app broadly; the worker also enforces one active scan, a bounded queue, repository-size limits, timeouts, and one retained result per repository to reduce repeat work.

Anonymous visitors receive one successful analysis by default. The worker stores privacy-preserving visitor hashes and quota usage in the persistent `scanner_quota_data` volume. Change `MAX_FREE_ANALYSES` in `deploy/.env.production` only when you intentionally want to alter the free allowance.

## Operations

View logs:

```bash
npm run production:logs
```

Stop services without deleting data:

```bash
npm run production:stop
```

Upgrade only after taking PostgreSQL and volume backups. The SonarQube image is deliberately pinned in `.env.production`; review SonarQube's upgrade path before changing it. Never run `docker compose down -v` or prune the named volumes unless you intend to delete the analysis database and persisted server data.
