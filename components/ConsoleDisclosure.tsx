import type { ReactNode } from "react";

export function ConsoleDisclosure({
  children,
  className,
  defaultOpen = false,
  description,
  title,
}: {
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  description?: string;
  title: string;
}) {
  return (
    <details
      className={className ? `console-disclosure ${className}` : "console-disclosure"}
      open={defaultOpen}
    >
      <summary className="console-disclosure-summary">
        <div className="console-disclosure-heading">
          <div>
            <strong className="console-disclosure-title">{title}</strong>
            {description ? <p className="subtle-text">{description}</p> : null}
          </div>
          <span aria-hidden="true" className="console-disclosure-toggle" />
        </div>
      </summary>
      <div className="console-disclosure-body">{children}</div>
    </details>
  );
}
