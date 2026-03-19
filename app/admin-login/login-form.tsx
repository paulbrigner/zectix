"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { appApiPath, readJsonOrThrow } from "@/app/(console)/client-utils";

type LoginResponse = {
  ok: true;
  next: string;
};

export function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await readJsonOrThrow<LoginResponse>(
        await fetch(appApiPath("/api/admin/login"), {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ password }),
        }),
      );
      router.replace(response.next);
      router.refresh();
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Unable to sign in",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="console-form" onSubmit={handleSubmit}>
      <div className="console-form-grid">
        <label className="console-field">
          <span>Admin password</span>
          <input
            autoComplete="current-password"
            className="console-input"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter the shared admin password"
            required
            type="password"
            value={password}
          />
        </label>
      </div>

      {error ? <p className="console-error-text">{error}</p> : null}

      <div className="button-row">
        <button className="button" disabled={loading} type="submit">
          {loading ? "Signing in..." : "Open admin tools"}
        </button>
      </div>
    </form>
  );
}
