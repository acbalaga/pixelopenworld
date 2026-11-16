import { SECURITY_HEADERS } from '../src/shared/headers';

declare const __APP_VERSION__: string;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

/** Routes /api/* only. Static assets are served by the platform before and around this Worker. */
export function route(request: Request): Response {
  const { pathname } = new URL(request.url);
  if (pathname === '/api/health') {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return json({ error: 'method not allowed' }, 405);
    }
    return json({ ok: true, version: __APP_VERSION__ });
  }
  return json({ error: 'not found' }, 404);
}

export default {
  fetch(request: Request): Response {
    return route(request);
  },
} satisfies ExportedHandler;
