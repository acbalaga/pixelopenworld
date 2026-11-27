# Security

## Scope

Pixel Open World runs entirely in the browser. A small Cloudflare Worker serves static files plus `/api/health` and `/api/time`. There are no accounts, no server-side saves and no secrets on the server.

In scope:

- Anything that can lose or corrupt a player's save.
- A crafted import file (`.powsave`) or URL that runs script, crashes the tab persistently, or harms the device.
- Problems in the Worker or its response headers.

Out of scope:

- Reading or editing your own save. The save scheme is a deterrent, not a vault. This is documented in `docs/tech/02-save-security.md` and `docs/ops/security-review.md`.
- Cheating in a single-player game.

## Reporting

Use GitHub's private vulnerability reporting: the **Security** tab of this repository, then **Report a vulnerability**. Please do not open a public issue for these.

Include steps to reproduce and, if relevant, the file or URL that triggers the problem. Expect an acknowledgement within a week.
