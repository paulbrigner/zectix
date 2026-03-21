"use client";

import { FormEvent, useEffect, useState } from "react";
import type { RuntimeConfig } from "@/lib/app-state/types";
import {
  appApiPath,
  cipherPayWebhookCallbackUrl,
  cipherPayDefaultsForNetwork,
  readJsonOrThrow,
} from "@/app/(console)/client-utils";

type ConfigResponse = {
  config: RuntimeConfig;
};

export function TestAdminClient() {
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [network, setNetwork] = useState<"testnet" | "mainnet">("testnet");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [checkoutBaseUrl, setCheckoutBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [lumaApiKey, setLumaApiKey] = useState("");
  const [origin, setOrigin] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadConfig() {
    setLoading(true);
    setError(null);
    try {
      const response = await readJsonOrThrow<ConfigResponse>(
        await fetch(appApiPath("/api/admin/config"), { cache: "no-store" }),
      );
      const nextConfig = response.config;
      setConfig(nextConfig);
      setNetwork(nextConfig.network);
      setApiBaseUrl(nextConfig.api_base_url);
      setCheckoutBaseUrl(nextConfig.checkout_base_url);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load admin config",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    void loadConfig();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await readJsonOrThrow<ConfigResponse>(
        await fetch(appApiPath("/api/admin/config"), {
          method: "PUT",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            network,
            api_base_url: apiBaseUrl,
            checkout_base_url: checkoutBaseUrl,
            api_key: apiKey.trim() || undefined,
            webhook_secret: webhookSecret.trim() || undefined,
            luma_api_key: lumaApiKey.trim() || undefined,
          }),
        }),
      );

      setConfig(response.config);
      setApiKey("");
      setWebhookSecret("");
      setLumaApiKey("");
      setNotice("Configuration saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save admin config",
      );
    } finally {
      setSaving(false);
    }
  }

  const webhookUrl = origin
    ? cipherPayWebhookCallbackUrl(origin)
    : appApiPath("/api/cipherpay/webhook");

  return (
    <div className="console-page-body">
      <section className="console-section">
        <header className="console-section-header">
          <div>
            <h2>Admin</h2>
            <p className="subtle-text">
              Store the runtime settings for CipherPay and Luma.
              Local development defaults to DynamoDB Local, while deployed environments
              can provide secrets through environment configuration.
            </p>
          </div>
        </header>

        {loading ? <p className="subtle-text">Loading config…</p> : null}
        {error ? <p className="console-error-text">{error}</p> : null}
        {notice ? <p className="console-valid-text">{notice}</p> : null}

        <div className="console-card-grid">
          <article className="console-detail-card">
            <h3>CipherPay webhook</h3>
            <p className="console-inline-code">{webhookUrl}</p>
            <p className="subtle-text">
              Save this as your CipherPay webhook URL while testing locally.
            </p>
          </article>

          <article className="console-detail-card">
            <h3>Stored secret previews</h3>
            <p className="subtle-text">CipherPay API key: {config?.api_key_preview || "not configured yet"}</p>
            <p className="subtle-text">CipherPay webhook secret: {config?.webhook_secret_preview || "not configured yet"}</p>
            <p className="subtle-text">Luma API key: {config?.luma_api_key_preview || "not configured yet"}</p>
            {config?.secrets_managed_externally ? (
              <p className="subtle-text">
                Secrets are managed externally in this environment and are not written to the app state table.
              </p>
            ) : null}
          </article>
        </div>
      </section>

      <section className="console-section">
        <header className="console-section-header">
          <div>
            <h2>Configuration</h2>
            <p className="subtle-text">
              Leave secret fields blank to keep the current values.
              In production, secret fields are managed through environment configuration instead of the app state table.
            </p>
          </div>
        </header>

        <form className="console-form" onSubmit={handleSubmit}>
          <div className="console-form-grid">
            <label className="console-field">
              <span>Network</span>
              <select
                className="console-input"
                onChange={(event) => {
                  const nextNetwork = event.target.value as "testnet" | "mainnet";
                  const defaults = cipherPayDefaultsForNetwork(nextNetwork);
                  setNetwork(nextNetwork);
                  setApiBaseUrl(defaults.apiBaseUrl);
                  setCheckoutBaseUrl(defaults.checkoutBaseUrl);
                }}
                value={network}
              >
                <option value="testnet">Testnet</option>
                <option value="mainnet">Mainnet</option>
              </select>
            </label>

            <label className="console-field">
              <span>API base URL</span>
              <input
                className="console-input"
                onChange={(event) => setApiBaseUrl(event.target.value)}
                type="url"
                value={apiBaseUrl}
              />
            </label>

            <label className="console-field">
              <span>Checkout base URL</span>
              <input
                className="console-input"
                onChange={(event) => setCheckoutBaseUrl(event.target.value)}
                type="url"
                value={checkoutBaseUrl}
              />
            </label>

          </div>

          <div className="console-form-grid">
            <label className="console-field">
              <span>CipherPay API key</span>
              <input
                className="console-input"
                disabled={config?.secrets_managed_externally}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={
                  config?.secrets_managed_externally
                    ? "Managed through environment configuration."
                    : config?.has_api_key
                      ? "Stored server-side. Paste a new key to replace it."
                      : "cpay_sk_..."
                }
                type="password"
                value={apiKey}
              />
            </label>

            <label className="console-field">
              <span>CipherPay webhook secret</span>
              <input
                className="console-input"
                disabled={config?.secrets_managed_externally}
                onChange={(event) => setWebhookSecret(event.target.value)}
                placeholder={
                  config?.secrets_managed_externally
                    ? "Managed through environment configuration."
                    : config?.has_webhook_secret
                      ? "Stored server-side. Paste a new secret to replace it."
                      : "whsec_..."
                }
                type="password"
                value={webhookSecret}
              />
            </label>

            <label className="console-field">
              <span>Luma API key</span>
              <input
                className="console-input"
                disabled={config?.secrets_managed_externally}
                onChange={(event) => setLumaApiKey(event.target.value)}
                placeholder={
                  config?.secrets_managed_externally
                    ? "Managed through environment configuration."
                    : config?.has_luma_api_key
                      ? "Stored server-side. Paste a new key to replace it."
                      : "Paste a Luma API key"
                }
                type="password"
                value={lumaApiKey}
              />
            </label>
          </div>

          <div className="button-row">
            <button className="button" disabled={saving} type="submit">
              {saving ? "Saving…" : "Save config"}
            </button>
            <button
              className="button button-secondary"
              disabled={loading || saving}
              onClick={() => void loadConfig()}
              type="button"
            >
              Reload
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
