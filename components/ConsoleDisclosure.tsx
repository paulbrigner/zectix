import type { ReactNode } from "react";

export function ConsoleDisclosure({
  children,
  defaultOpen = false,
  description,
  title,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  description?: string;
  title: string;
}) {
  return (
    <details className="console-disclosure" open={defaultOpen}>
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
