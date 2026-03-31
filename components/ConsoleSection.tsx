import type { ComponentPropsWithoutRef, ReactNode } from "react";

type ConsoleSectionHeading = "h2" | "h3" | "h4";

export function ConsoleSection({
  actions,
  children,
  className,
  description,
  eyebrow,
  id,
  role,
  title,
  titleAs = "h2",
}: {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  id?: string;
  role?: ComponentPropsWithoutRef<"section">["role"];
  title: ReactNode;
  titleAs?: ConsoleSectionHeading;
}) {
  const TitleTag = titleAs;

  return (
    <section
      className={className ? `console-section ${className}` : "console-section"}
      id={id}
      role={role}
    >
      <div className="console-section-header">
        <div>
          {eyebrow}
          <TitleTag>{title}</TitleTag>
          {description ? <p className="subtle-text">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
