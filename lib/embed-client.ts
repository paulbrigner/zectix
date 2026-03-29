export function emitEmbedEvent(
  type: string,
  payload: Record<string, unknown> = {},
) {
  if (typeof window === "undefined" || window.parent === window) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("zectix:embed", {
      detail: {
        source: "zectix-embed",
        type,
        ...payload,
      },
    }),
  );
}
