export function getMethod(event: unknown) {
  const legacyEvent = event as { httpMethod?: string };
  if (legacyEvent?.httpMethod) return legacyEvent.httpMethod;

  const requestEvent = event as { method?: string };
  if (requestEvent?.method) return requestEvent.method;

  return '';
}

export async function getRawBody(event: unknown) {
  const legacyEvent = event as { body?: string | null };
  if (typeof legacyEvent?.body === 'string') return legacyEvent.body;

  const requestEvent = event as { text?: () => Promise<string> };
  if (typeof requestEvent?.text === 'function') return requestEvent.text();

  return '{}';
}

export function getHeader(event: unknown, name: string) {
  const legacyEvent = event as { headers?: Record<string, string | undefined> };
  const legacyHeaders = legacyEvent?.headers;
  if (legacyHeaders) {
    const direct = legacyHeaders[name];
    if (direct) return direct;
    const lower = legacyHeaders[name.toLowerCase()];
    if (lower) return lower;
  }

  const requestEvent = event as { headers?: Headers };
  if (requestEvent?.headers && typeof requestEvent.headers.get === 'function') {
    return requestEvent.headers.get(name) ?? undefined;
  }

  return undefined;
}
