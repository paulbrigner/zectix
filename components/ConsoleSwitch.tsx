"use client";

import * as Switch from "@radix-ui/react-switch";
import { useId, useRef } from "react";

export function ConsoleSwitch({
  className,
  defaultChecked = false,
  description,
  disabled = false,
  label,
  name,
  submitOnChange = false,
}: {
  className?: string;
  defaultChecked?: boolean;
  description?: string;
  disabled?: boolean;
  label: string;
  name: string;
  submitOnChange?: boolean;
}) {
  const labelId = useId();
  const descriptionId = useId();
  const switchRef = useRef<HTMLButtonElement>(null);

  return (
    <div
      className={
        className ? `console-switch-field ${className}` : "console-switch-field"
      }
      onClick={(event) => {
        if (disabled) {
          return;
        }

        if (!(event.target instanceof HTMLElement)) {
          return;
        }

        if (event.target.closest(".console-switch-root")) {
          return;
        }

        // Radix emits a hidden checkbox click for form integration after the
        // visible switch toggles. Ignore that synthetic event so the wrapper
        // does not proxy a second click back into the control.
        if (event.target instanceof HTMLInputElement) {
          return;
        }

        switchRef.current?.click();
      }}
    >
      <div className="console-switch-copy">
        <strong className="console-switch-label" id={labelId}>
          {label}
        </strong>
        {description ? (
          <p
            className="console-switch-description subtle-text"
            id={descriptionId}
          >
            {description}
          </p>
        ) : null}
      </div>
      <Switch.Root
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={labelId}
        className="console-switch-root"
        defaultChecked={defaultChecked}
        disabled={disabled}
        name={name}
        onCheckedChange={() => {
          if (!submitOnChange) {
            return;
          }

          queueMicrotask(() => {
            switchRef.current?.form?.requestSubmit();
          });
        }}
        ref={switchRef}
      >
        <Switch.Thumb className="console-switch-thumb" />
      </Switch.Root>
    </div>
  );
}
