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
