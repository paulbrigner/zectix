"use client";

import * as Switch from "@radix-ui/react-switch";
import { useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

const busyCursorOwners = new Set<string>();

function syncBusyCursor() {
  if (typeof document === "undefined") {
    return;
  }

  const cursor = busyCursorOwners.size > 0 ? "progress" : "";
  document.documentElement.style.cursor = cursor;
  document.body.style.cursor = cursor;
}

function setBusyCursor(ownerId: string, active: boolean) {
  if (active) {
    busyCursorOwners.add(ownerId);
  } else {
    busyCursorOwners.delete(ownerId);
  }

  syncBusyCursor();
}

export function ConsoleSwitch({
  className,
  defaultChecked = false,
  description,
  disabled = false,
  label,
  name,
  pendingLabel = "Saving change...",
  submitOnChange = false,
}: {
  className?: string;
  defaultChecked?: boolean;
  description?: string;
  disabled?: boolean;
  label: string;
  name: string;
  pendingLabel?: string;
  submitOnChange?: boolean;
}) {
  const labelId = useId();
  const descriptionId = useId();
  const switchRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { pending } = useFormStatus();
  const [checked, setChecked] = useState(defaultChecked);
  const [localPending, setLocalPending] = useState(false);
  const showPending = pending || localPending;
  const isDisabled = disabled || showPending;

  useEffect(() => {
    if (!pending) {
      setLocalPending(false);
    }
  }, [pending]);

  useEffect(() => {
    setChecked(defaultChecked);
  }, [defaultChecked]);

  useEffect(() => {
    setBusyCursor(labelId, showPending);
    return () => {
      setBusyCursor(labelId, false);
    };
  }, [labelId, showPending]);

  return (
    <div
      className={
        className
          ? `console-switch-field${showPending ? " console-switch-field-pending" : ""} ${className}`
          : `console-switch-field${showPending ? " console-switch-field-pending" : ""}`
      }
      data-pending={showPending ? "true" : "false"}
      style={showPending ? { cursor: "progress" } : undefined}
      onClick={(event) => {
        if (isDisabled) {
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
        {submitOnChange && showPending ? (
          <p aria-live="polite" className="console-switch-feedback" role="status">
            {pendingLabel}
          </p>
        ) : null}
      </div>
      <input
        name={name}
        ref={inputRef}
        type="hidden"
        value={checked ? "1" : "0"}
      />
      <Switch.Root
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={labelId}
        aria-busy={showPending || undefined}
        checked={checked}
        className="console-switch-root"
        data-pending={showPending ? "true" : "false"}
        disabled={isDisabled}
        style={showPending ? { cursor: "progress" } : undefined}
        onCheckedChange={(nextChecked) => {
          setChecked(nextChecked);
          if (inputRef.current) {
            inputRef.current.value = nextChecked ? "1" : "0";
          }

          if (!submitOnChange) {
            return;
          }

          setLocalPending(true);
          setBusyCursor(labelId, true);
          const submitForm = () => {
            switchRef.current?.form?.requestSubmit();
          };

          if (typeof window === "undefined") {
            submitForm();
            return;
          }

          window.requestAnimationFrame(() => {
            submitForm();
          });
        }}
        ref={switchRef}
      >
        <Switch.Thumb className="console-switch-thumb" />
      </Switch.Root>
    </div>
  );
}
