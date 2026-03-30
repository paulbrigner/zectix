"use client";

import { useFormStatus } from "react-dom";

export function ConsoleFormPendingNote({
  className = "console-pending-note",
  pendingLabel = "Saving your changes...",
}: {
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  if (!pending) {
    return null;
  }

  return (
    <p aria-live="polite" className={className} role="status">
      {pendingLabel}
    </p>
  );
}
