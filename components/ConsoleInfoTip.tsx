"use client";

import type { FocusEvent, ReactNode } from "react";
import { useId, useState } from "react";

export function ConsoleInfoTip({
  children,
  label = "More information",
}: {
  children: ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  function handleBlur(event: FocusEvent<HTMLSpanElement>) {
    const nextFocused = event.relatedTarget;
    if (nextFocused instanceof Node && event.currentTarget.contains(nextFocused)) {
      return;
    }

    setOpen(false);
  }

  return (
    <span
      className="console-info-tip"
      data-open={open ? "true" : "false"}
      onBlur={handleBlur}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        aria-label={label}
        className="console-info-tip-trigger"
        onClick={() => setOpen((current) => !current)}
        onFocus={() => setOpen(true)}
        type="button"
      >
        <span aria-hidden="true" className="console-info-indicator">
          i
        </span>
      </button>
      <span className="console-info-tip-content" id={tooltipId} role="tooltip">
        {children}
      </span>
    </span>
  );
}
