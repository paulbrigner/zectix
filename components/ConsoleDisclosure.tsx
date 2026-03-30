"use client";

import { ChevronDownIcon } from "@radix-ui/react-icons";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useState, type ReactNode } from "react";

export function ConsoleDisclosure({
  children,
  className,
  defaultOpen = false,
  description,
  lockedOpen = false,
  title,
}: {
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  description?: string;
  lockedOpen?: boolean;
  title: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = lockedOpen ? true : open;

  return (
    <Collapsible.Root
      className={
        className ? `console-disclosure ${className}` : "console-disclosure"
      }
      data-state={isOpen ? "open" : "closed"}
      onOpenChange={lockedOpen ? undefined : setOpen}
      open={isOpen}
    >
      <Collapsible.Trigger asChild>
        <button
          className="console-disclosure-summary"
          disabled={lockedOpen}
          type="button"
        >
          <div className="console-disclosure-heading">
            <div>
              <strong className="console-disclosure-title">{title}</strong>
              {description ? (
                <p className="subtle-text">{description}</p>
              ) : null}
            </div>
            {lockedOpen ? null : (
              <ChevronDownIcon
                aria-hidden="true"
                className="console-disclosure-toggle"
              />
            )}
          </div>
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content asChild forceMount>
        <div className="console-disclosure-body" hidden={!isOpen}>
          {children}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
