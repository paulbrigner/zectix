import type { ReactNode } from "react";

export function ConsoleInfoTip({
  children,
  label = "More information",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <details className="console-info-tip">
      <summary aria-label={label} className="console-info-tip-trigger">
        <span aria-hidden="true" className="console-info-indicator">
          i
        </span>
      </summary>
      <div className="console-info-tip-content">{children}</div>
    </details>
  );
}
