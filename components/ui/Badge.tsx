import type { HTMLAttributes, ReactNode } from "react";

type BadgeVariant = "default" | "accent" | "success" | "warning" | "danger" | "info";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  children: ReactNode;
};

const variantClass: Record<BadgeVariant, string> = {
  default: "console-status",
  accent: "console-field-badge",
  success: "console-status console-status-confirmed",
  warning: "console-status console-status-pending",
  danger: "console-status console-status-expired",
  info: "console-status console-status-detected",
};

export function Badge({
  variant = "default",
  children,
  className,
  ...rest
}: BadgeProps) {
  const classes = [variantClass[variant], className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}
