function withDefaultCacheControl(init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  }

  return {
    ...init,
    headers,
  };
}

export function jsonOk(data: unknown, init?: ResponseInit) {
  const responseInit = withDefaultCacheControl(init);
  return Response.json(data, {
    status: 200,
    ...responseInit,
  });
}

export function jsonError(message: string, status = 400, init?: ResponseInit) {
  const responseInit = withDefaultCacheControl(init);
  return Response.json(
    {
      error: message,
    },
    {
      status,
      ...responseInit,
    },
  );
}

export function redirectToPath(path: string, status: 301 | 302 | 303 | 307 | 308 = 303) {
  const responseInit = withDefaultCacheControl({
    headers: {
      Location: path,
    },
  });
  return new Response(null, {
    status,
    headers: responseInit.headers,
  });
}

export function safeRedirectPath(
  candidate: string | null | undefined,
  fallback: string,
  options?: {
    allowedPrefixes?: string[];
  },
) {
  const trimmed = candidate?.trim();
  if (!trimmed) {
    return fallback;
  }

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(trimmed, "https://service.invalid");
    if (url.origin !== "https://service.invalid") {
      return fallback;
    }

    const nextPath = `${url.pathname}${url.search}${url.hash}`;
    const allowedPrefixes = options?.allowedPrefixes || [];
    if (allowedPrefixes.length === 0) {
      return nextPath;
    }

    const matchesAllowedPrefix = allowedPrefixes.some((prefix) => {
      return (
        nextPath === prefix ||
        nextPath.startsWith(`${prefix}/`) ||
        nextPath.startsWith(`${prefix}?`) ||
        nextPath.startsWith(`${prefix}#`)
      );
    });

    return matchesAllowedPrefix ? nextPath : fallback;
  } catch {
    return fallback;
  }
}
