export const jsonHeaders = {
  'Content-Type': 'application/json',
};

export function ok(body: unknown, statusCode = 200) {
  return {
    statusCode,
    headers: jsonHeaders,
    body: JSON.stringify(body),
  };
}

export function fail(message: string, statusCode = 400) {
  return ok({ error: message }, statusCode);
}
