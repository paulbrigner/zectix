export function jsonOk(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    status: 200,
    ...init,
  });
}

export function jsonError(message: string, status = 400, init?: ResponseInit) {
  return Response.json(
    {
      error: message,
    },
    {
      status,
      ...init,
    },
  );
}

export function redirectToPath(path: string, status: 301 | 302 | 303 | 307 | 308 = 303) {
  return new Response(null, {
    status,
    headers: {
      Location: path,
    },
  });
}
