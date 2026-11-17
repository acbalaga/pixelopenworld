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

## Optional: keep the seal material out of the repository

Exported save files (`.powsave`) are sealed with a key derived at runtime from four byte fragments, per `sealVersion` (tech/02). By default the fragments are committed under `src/save/seal/v<N>/`, generated once by `npm run seal:gen -- --version <N>`. Old versions are never removed, so old backups always open.

This is worth doing only if the repository is public and you want to raise the bar slightly. The built game still contains the material, so a programmer who reads the bundle can still get it. It only keeps it out of source control.

To turn it on, set a build variable `POW_SEAL_MATERIAL` in the Cloudflare build settings (and in the GitHub Actions environment if CI builds should match). It is a JSON object with the current version and four hex fragments per version, 24 bytes (48 hex characters) each:

```
{"current":2,"versions":{"1":["<48 hex>","<48 hex>","<48 hex>","<48 hex>"],"2":["...","...","...","..."]}}
```

- Every version that players might still hold a backup of must be in the variable. A version missing from it cannot be imported.
- With the variable set, the build leaves `src/save/seal/v*/` out of the bundle, and `npm run check:seal` also searches the bundle for the combined material of every version in the variable.
- With the variable unset (the default), nothing changes.
- Treat the variable as a build secret, but note it is not protecting against anyone who has the built game.
- Changing the material for an existing `sealVersion` makes every backup sealed under it unreadable. Add a new version instead.

`npm run check:seal` runs inside `npm run verify`. It fails the build if the combined seal material, in any common text form, appears in `dist/client`.

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
