"use client";

import { Cross2Icon } from "@radix-ui/react-icons";
import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

export function ConsoleConfirmDialog({
  action,
  body,
  cancelLabel = "Cancel",
  children,
  confirmClassName = "button button-danger button-small",
  confirmLabel = "Confirm",
  description,
  title,
  triggerClassName = "button button-secondary button-small",
  triggerLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  body?: ReactNode;
  cancelLabel?: string;
  children?: ReactNode;
  confirmClassName?: string;
  confirmLabel?: string;
  description: string;
  title: string;
  triggerClassName?: string;
  triggerLabel: string;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className={triggerClassName} type="button">
          {triggerLabel}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="console-dialog-overlay" />
        <Dialog.Content className="console-dialog-content">
          <div className="console-dialog-header">
            <div>
              <Dialog.Title className="console-dialog-title">
                {title}
              </Dialog.Title>
              <Dialog.Description className="console-dialog-description subtle-text">
                {description}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                aria-label="Close dialog"
                className="console-dialog-close"
                type="button"
              >
                <Cross2Icon />
              </button>
            </Dialog.Close>
          </div>

          {body ? <div className="console-dialog-body">{body}</div> : null}

          <form action={action} className="console-dialog-form">
            {children}
            <div className="button-row console-dialog-actions">
              <Dialog.Close asChild>
                <button
                  className="button button-secondary button-small"
                  type="button"
                >
                  {cancelLabel}
                </button>
              </Dialog.Close>
              <button className={confirmClassName} type="submit">
                {confirmLabel}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
