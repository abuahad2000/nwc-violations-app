export function isSameOrigin(request: Request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  // CLI clients have no ambient browser cookies. Browser mutations supply Origin.
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    if (process.env.APP_ORIGIN) return parsed.origin === new URL(process.env.APP_ORIGIN).origin;
    return (
      ['http:', 'https:'].includes(parsed.protocol) && parsed.host === request.headers.get('host')
    );
  } catch {
    return false;
  }
}
