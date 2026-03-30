"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

type ConsoleSubmitButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "type"
> & {
  className?: string;
  label: string;
  pendingLabel?: string;
};

export function ConsoleSubmitButton({
  className = "button",
  disabled = false,
  label,
  pendingLabel,
  ...props
}: ConsoleSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      aria-busy={pending || undefined}
      className={`${className}${pending ? " is-pending" : ""}`}
      data-pending={pending ? "true" : "false"}
      disabled={disabled || pending}
      type="submit"
    >
      {pending ? pendingLabel || label : label}
    </button>
  );
}
