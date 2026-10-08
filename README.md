# Reporithm

Reporithm turns public GitHub signals into a transparent repository health score and focused, actionable recommendations.

## What it analyzes

- Repository activity, commits, contributors, issues, and pull requests
- Community essentials including README, license, security policy, and contribution templates
- Adoption, maintenance, collaboration, and language composition
- Prioritized improvements grounded in visible repository evidence

## Run locally

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:3000` and enter a public GitHub URL or `owner/repository`.

Unauthenticated GitHub requests are rate-limited. Add `GITHUB_TOKEN` to `.env.local` for a higher allowance.

The GitHub integration runs in a server-side Next.js route, keeping credentials out of the browser without requiring a separate backend service.
