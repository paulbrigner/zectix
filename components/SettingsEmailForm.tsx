"use client";

import { useState } from "react";
import { ConsoleFieldLabel } from "@/components/ConsoleFieldLabel";
import { ConsoleFormPendingNote } from "@/components/ConsoleFormPendingNote";
import { ConsoleSubmitButton } from "@/components/ConsoleSubmitButton";

export function SettingsEmailForm({
  action,
  currentEmail,
  redirectTo,
  tenantSlug,
}: {
  action: (formData: FormData) => Promise<void>;
  currentEmail: string;
  redirectTo: string;
  tenantSlug: string;
}) {
  const [value, setValue] = useState("");
  const trimmed = value.trim().toLowerCase();
  const unchanged = !trimmed || trimmed === currentEmail.toLowerCase();

  return (
    <form action={action} className="console-form">
      <input name="tenant_slug" type="hidden" value={tenantSlug} />
      <input name="redirect_to" type="hidden" value={redirectTo} />
      <label className="console-field">
        <ConsoleFieldLabel label="New account email" />
        <input
          className="console-input"
          name="contact_email"
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter new email address..."
          required
          type="email"
          value={value}
        />
      </label>
      <p className="subtle-text">
        We will send a confirmation link to the new address. Your current email stays
        active until confirmed.
      </p>
      <div className="button-row">
        <ConsoleSubmitButton
          className="button button-small"
          disabled={unchanged}
          label="Send confirmation email"
          pendingLabel="Sending confirmation email..."
        />
      </div>
      <ConsoleFormPendingNote pendingLabel="Sending an email confirmation link..." />
    </form>
  );
}
