import Link from "next/link";
import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "landing-primary" | "landing-ghost";
type Size = "default" | "small";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

type AsButton = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: never };

type AsLink = CommonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

type ButtonProps = AsButton | AsLink;

const variantClass: Record<Variant, string> = {
  primary: "button",
  secondary: "button button-secondary",
  ghost: "button button-ghost",
  "landing-primary": "landing-btn landing-btn-primary",
  "landing-ghost": "landing-btn landing-btn-ghost",
};

function isExternal(href: string) {
  return href.startsWith("http") || href.startsWith("//");
}

export function Button({
  variant = "primary",
  size = "default",
  children,
  className,
  ...rest
}: ButtonProps) {
  const classes = [
    variantClass[variant],
    size === "small" ? "button-small" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if ("href" in rest && rest.href) {
    const { href, ...linkRest } = rest as AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

    if (isExternal(href) || href.startsWith("#")) {
      return (
        <a className={classes} href={href} {...linkRest}>
          {children}
        </a>
      );
    }

    return (
      <Link className={classes} href={href} {...linkRest}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}
