# Reporithm web application

The product is implemented as a Next.js application with a server-side GitHub analysis route. It does not require the legacy Express server.

## Development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local`. `GITHUB_TOKEN` raises GitHub API limits; `SONARQUBE_URL` and `SONARQUBE_TOKEN` enable verified code-quality results for projects already scanned by SonarQube.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```
