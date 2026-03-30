"use client";

import { ChevronDownIcon } from "@radix-ui/react-icons";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useState, type ReactNode } from "react";

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
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible.Root
      className={
        className ? `console-disclosure ${className}` : "console-disclosure"
      }
      data-state={open ? "open" : "closed"}
      onOpenChange={setOpen}
      open={open}
    >
      <Collapsible.Trigger asChild>
        <button className="console-disclosure-summary" type="button">
          <div className="console-disclosure-heading">
            <div>
              <strong className="console-disclosure-title">{title}</strong>
              {description ? (
                <p className="subtle-text">{description}</p>
              ) : null}
            </div>
            <ChevronDownIcon
              aria-hidden="true"
              className="console-disclosure-toggle"
            />
          </div>
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content asChild forceMount>
        <div className="console-disclosure-body" hidden={!open}>
          {children}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
