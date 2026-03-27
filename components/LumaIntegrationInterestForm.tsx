"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui";
import {
  LUMA_INTEREST_EVENT_VOLUME_OPTIONS,
  LUMA_INTEREST_TIMELINE_OPTIONS,
  MIN_LUMA_INTEREST_SUBMIT_DELAY_MS,
} from "@/lib/luma-integration-interest";

type FormStatus = "idle" | "submitting" | "success" | "error";

const MIN_SUBMIT_DELAY_SECONDS = Math.ceil(MIN_LUMA_INTEREST_SUBMIT_DELAY_MS / 1000);

export function LumaIntegrationInterestForm() {
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState("");
  const [formReadyAt, setFormReadyAt] = useState(() => new Date().toISOString());

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      fullName: formData.get("fullName"),
      organization: formData.get("organization"),
      email: formData.get("email"),
      websiteOrLumaUrl: formData.get("websiteOrLumaUrl"),
      eventVolume: formData.get("eventVolume"),
      timeline: formData.get("timeline"),
      notes: formData.get("notes"),
      companyFax: formData.get("companyFax"),
      formReadyAt,
      submittedAt: new Date().toISOString(),
    };

    setStatus("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/luma-integration-interest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as { error?: string; ok?: boolean };

      if (!response.ok) {
        setStatus("error");
        setMessage(result.error || "Unable to send your inquiry right now.");
        setFormReadyAt(new Date().toISOString());
        return;
      }

      setStatus("success");
      setMessage(
        "Thanks. Your inquiry has been sent and we’ll follow up by email soon.",
      );
      form.reset();
      setFormReadyAt(new Date().toISOString());
    } catch {
      setStatus("error");
      setMessage("Unable to send your inquiry right now. Please try again shortly.");
      setFormReadyAt(new Date().toISOString());
    }
  }

  return (
    <form className="landing-interest-form" onSubmit={handleSubmit}>
      <div className="landing-interest-grid">
        <label className="landing-interest-field" htmlFor="fullName">
          <span className="landing-interest-label">Full name</span>
          <input
            id="fullName"
            name="fullName"
            type="text"
            className="landing-interest-input"
            autoComplete="name"
            required
            maxLength={120}
          />
        </label>

        <label className="landing-interest-field" htmlFor="organization">
          <span className="landing-interest-label">Organization</span>
          <input
            id="organization"
            name="organization"
            type="text"
            className="landing-interest-input"
            autoComplete="organization"
            required
            maxLength={160}
          />
        </label>

        <label className="landing-interest-field" htmlFor="email">
          <span className="landing-interest-label">Work email</span>
          <input
            id="email"
            name="email"
            type="email"
            className="landing-interest-input"
            autoComplete="email"
            required
            maxLength={320}
          />
        </label>

        <label className="landing-interest-field" htmlFor="websiteOrLumaUrl">
          <span className="landing-interest-label">
            Website or Luma calendar URL
            <span className="landing-interest-meta">Optional</span>
          </span>
          <input
            id="websiteOrLumaUrl"
            name="websiteOrLumaUrl"
            type="url"
            className="landing-interest-input"
            autoComplete="url"
            maxLength={300}
            placeholder="https://..."
          />
        </label>

        <label className="landing-interest-field" htmlFor="eventVolume">
          <span className="landing-interest-label">Expected event volume</span>
          <select
            id="eventVolume"
            name="eventVolume"
            className="landing-interest-input"
            defaultValue=""
            required
          >
            <option value="" disabled>
              Select one
            </option>
            {LUMA_INTEREST_EVENT_VOLUME_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="landing-interest-field" htmlFor="timeline">
          <span className="landing-interest-label">Target timeline</span>
          <select
            id="timeline"
            name="timeline"
            className="landing-interest-input"
            defaultValue=""
            required
          >
            <option value="" disabled>
              Select one
            </option>
            {LUMA_INTEREST_TIMELINE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="landing-interest-field" htmlFor="notes">
        <span className="landing-interest-label">
          What kinds of events are you planning to support with ZecTix?
        </span>
        <textarea
          id="notes"
          name="notes"
          className="landing-interest-input landing-interest-textarea"
          rows={6}
          required
          minLength={10}
          maxLength={2000}
          placeholder="Tell us a bit about your current Luma setup, ticketing needs, and what you want from the integration."
        />
      </label>

      <div className="landing-interest-honeypot" aria-hidden="true">
        <label htmlFor="companyFax">Leave this field empty</label>
        <input
          id="companyFax"
          name="companyFax"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <p className="landing-interest-help">
        We’ll use this to evaluate fit for the early beta and follow up directly.
        Please spend at least {MIN_SUBMIT_DELAY_SECONDS} seconds completing the
        form before submitting.
      </p>

      <div className="landing-interest-actions">
        <Button
          type="submit"
          variant="landing-primary"
          disabled={status === "submitting"}
        >
          {status === "submitting" ? "Sending..." : "Send inquiry"}
        </Button>
        <Button variant="landing-ghost" href="/">
          Back to home
        </Button>
      </div>

      {status !== "idle" && message ? (
        <p
          className={[
            "landing-interest-message",
            status === "success"
              ? "landing-interest-message-success"
              : "landing-interest-message-error",
          ].join(" ")}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
