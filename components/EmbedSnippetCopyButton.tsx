"use client";

import { useEffect, useState } from "react";

export function EmbedSnippetCopyButton({
  value,
}: {
  value: string;
}) {
  const [notice, setNotice] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (notice === "idle") {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setNotice("idle");
    }, 2200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [notice]);

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("copied");
    } catch {
      setNotice("failed");
    }
  }

  return (
    <button
      aria-live="polite"
      className="button button-secondary button-small"
      onClick={copyValue}
      type="button"
    >
      {notice === "copied"
        ? "Copied"
        : notice === "failed"
          ? "Copy failed"
          : "Copy HTML"}
    </button>
  );
}
