# Reporithm web application

The product is implemented as a Next.js application with a server-side GitHub analysis route. It does not require the legacy Express server.

## Development

```bash
npm install
npm run dev
```

Optionally set `GITHUB_TOKEN` in `.env.local` to increase GitHub API limits.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```
