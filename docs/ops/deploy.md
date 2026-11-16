# Deploy

The site and its Worker deploy through Cloudflare's Git integration (Workers Builds). No Cloudflare token or account id is stored in GitHub, and CI needs none.

## One-time owner steps

1. Cloudflare dashboard, Workers & Pages, Create, Import a repository. Pick this GitHub repository and authorize the Cloudflare GitHub app for it.
2. Project name: `pixelopenworld` (must match `name` in `wrangler.jsonc`).
3. Production branch: `main`.
4. Build command: `npm ci && npm run build`
5. Deploy command: `npx wrangler deploy`
6. Non-production branch deploy command (previews): `npx wrangler versions upload`
7. Leave "Builds for non-production branches" enabled. Every PR branch then gets a preview URL.
8. Environment variables: none needed. Node version comes from `.nvmrc`.
9. Optional: attach a custom domain under the Worker's Settings, Domains & Routes.

`npm run build` runs `vite build` with the Cloudflare Vite plugin. It writes the static client to `dist/client` and the Worker plus a generated `wrangler.json` to `dist/pixelopenworld`. The root `wrangler.jsonc` is redirected there by the plugin, so `wrangler deploy` picks up the built output.

## What is served

- `/api/*` goes to `worker/index.ts` first (`run_worker_first`). `GET /api/health` returns `{ ok, version }`, where version is the git SHA (`WORKERS_CI_COMMIT_SHA` on Cloudflare, else `git rev-parse`). Unknown `/api/*` returns 404 JSON. API responses are `Cache-Control: no-store`.
- Everything else is static assets with single page app fallback to `index.html`.
- Security headers for static responses come from `public/_headers`. The same values for API responses live in `src/shared/headers.ts`. Keep the two in step with tech/02 "Client hardening".
- `/assets/*` (hashed) is cached for a year, immutable. `/` and `/index.html` are `no-cache`.

## Fallback: deploy from a local machine

```
npm ci
npm run build
npx wrangler login
npx wrangler deploy
```

## Local development

`npm run dev` runs the client and the Worker together. `npm run build && npx vite preview` serves the built output through the Worker runtime, which is the closest check to production.

## Docs followed

developers.cloudflare.com/workers: static-assets (binding, `run_worker_first`, `not_found_handling`), static-assets/routing/single-page-application, vite-plugin (get-started, tutorial), static-assets headers (`_headers`). Read through the Context7 mirror of those pages, because the Cloudflare docs host was not reachable from the build sandbox. Workers Builds dashboard steps above were not verified against the live dashboard. Check them on first connect.
