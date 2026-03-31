import type { ReactNode } from "react";

export type StatusBadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted";

export function StatusBadge({
  children,
  className,
  tone = "muted",
}: {
  children: ReactNode;
  className?: string;
  tone?: StatusBadgeTone;
}) {
  const toneClassName = `console-mini-pill-${tone}`;

  return (
    <span
      className={
        className
          ? `console-mini-pill ${toneClassName} ${className}`
          : `console-mini-pill ${toneClassName}`
      }
    >
      {children}
    </span>
  );
}
