import type { ComponentPropsWithoutRef } from "react";

export function ConsoleForm({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"form">) {
  return (
    <form
      className={className ? `console-form ${className}` : "console-form"}
      {...props}
    >
      {children}
    </form>
  );
}
