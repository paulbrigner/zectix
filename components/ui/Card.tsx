import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  variant?: "default" | "glass" | "section";
};

const variantClass: Record<NonNullable<CardProps["variant"]>, string> = {
  default: "card",
  glass: "card",
  section: "console-section",
};

export function Card({
  variant = "default",
  children,
  className,
  ...rest
}: CardProps) {
  const classes = [variantClass[variant], className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
