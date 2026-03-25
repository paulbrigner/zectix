# LumaZcash Runbook

This is the operator checklist for the production app.

## First Checks

When something looks off, check these in order:

1. `Amplify` deployment status and recent job logs.
2. `/dashboard` for failed registrations, invalid webhooks, and recent session status.
3. `/api/health` and `/api/ready` for quick liveness/readiness confirmation.
4. The affected checkout session for `status`, `registration_status`, `registration_error`, and `cipherpay_expires_at`.
5. Amplify environment variables for `LUMA_API_KEY`, `CIPHERPAY_API_KEY`, `CIPHERPAY_WEBHOOK_SECRET`, and the shared admin/session secrets.

## Common Issues

### Payment accepted but registration is missing

1. Confirm the session has `status` of `detected` or `confirmed`.
2. Check whether `registration_status` is `failed` and read the stored error.
3. Confirm the Luma API key is present in Amplify.
4. Confirm the CipherPay webhook secret is present in Amplify and the webhook endpoint is still reachable.
5. From `/dashboard`, use `Retry due registrations` or the per-session retry action.
6. If the payment side is healthy but registration still fails after retry, fix the upstream issue first and retry again rather than creating a second payment.

### Checkout is stuck on payment details after expiry

1. Confirm `cipherpay_expires_at` has passed.
2. Refresh the checkout page.
3. Verify the session now shows the expired state rather than the live payment controls.
4. If the page still looks active, confirm the deployed frontend is current and the session viewer token is valid.

### Webhook delivery looks wrong

1. Check the stored webhook record in the dashboard.
2. Confirm the request signature validation result.
3. Compare the webhook invoice id to the checkout session id.
4. If the webhook was valid but did not map to a session, inspect the checkout session creation path and the event id it used.

### Readiness or deployment looks wrong

1. Check `/api/health` to confirm the app is serving.
2. Check `/api/ready` to confirm DynamoDB access and required integration secrets.
3. If `/api/ready` shows missing secrets, restore them in Amplify and redeploy.
4. If `/api/ready` shows DynamoDB errors, verify the Amplify compute role and table permissions.

### Admin or dashboard sign-in fails

1. Confirm `ADMIN_PASSWORD_HASH` and `ADMIN_SESSION_SECRET` are set in Amplify.
2. Confirm the browser session cookie has not expired.
3. Re-run `npm run auth:hash -- "your-password"` locally if the hash needs to be regenerated.

### A production deploy is live but the hostname is wrong

1. Confirm the Amplify domain association still has `lumazcash -> main`.
2. Confirm Route53 still has the `lumazcash.pgpforcrypto.org` CNAME.
3. Reattach the domain mapping if the Amplify app was disconnected and reconnected.

## Recovery Notes

- The dashboard is the main recovery surface today.
- Keep production secrets in Amplify or your secret manager.
- Do not use mutable runtime config as the source of truth for production secrets.
- Registration retries are stateful: failed sessions carry retry metadata and can be retried from the dashboard or `/api/admin/retry-registration`.
- Structured logs now emit checkout, webhook, and registration events with correlation-friendly metadata.

## GitHub Actions Recovery Job

If you enable the scheduled recovery workflow, set these GitHub Actions secrets:

- `LUMAZCASH_BASE_URL`, for example `https://lumazcash.pgpforcrypto.org`
- `LUMAZCASH_ADMIN_PASSWORD`, the shared admin password used by `/api/admin/login`

Optional manual-dispatch input:

- `session_id`, to retry one checkout session instead of the due-session batch

## GitHub Actions Smoke Check

Set this GitHub repository variable:

- `PRODUCTION_BASE_URL`, for example `https://lumazcash.pgpforcrypto.org`

Optional tuning variables:

- `SMOKE_MAX_ATTEMPTS`
- `SMOKE_RETRY_DELAY_SECONDS`
- `SMOKE_REQUEST_TIMEOUT_SECONDS`

## Probes

- `/api/health` is the simple liveness probe.
- `/api/ready` verifies DynamoDB access and the presence of required integration secrets.

Use request ids, session ids, and invoice ids to correlate:

- checkout creation
- webhook delivery
- payment status transitions
- registration attempts
