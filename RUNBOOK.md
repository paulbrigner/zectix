# ZecTix Runbook

This is the operator checklist for the managed service fork.

## First Checks

When something looks off, check these in order:

1. AWS deployment status and recent job logs.
2. `/ops` for tenant health, recent sessions, recent webhooks, and recent registration tasks.
3. The affected tenant detail page for live Luma preview, mirrored inventory, and connection status.
4. `/api/health` and `/api/ready` for quick liveness/readiness confirmation.
5. The affected checkout session for `status`, `registration_status`, `registration_error`, and `cipherpay_expires_at`.
6. Environment variables and secret-store entries for the affected tenant connection.

## Common Issues

### Payment accepted but registration is missing

1. Confirm the session has `status` of `detected` or `confirmed`.
2. Check whether `registration_status` is `failed` or `retry_wait` and read the stored error.
3. Confirm the tenant’s Luma API secret resolves correctly from the secret store.
4. Use the tenant detail page to confirm the relevant Luma event still appears in the live preview, that the Luma key shows a recent validation time, and that the mirrored event/ticket state is current.
5. Confirm the tenant’s CipherPay webhook secret resolves correctly.
6. Use `/ops/tenants/[tenantId]/recovery` to retry the session or process due tasks.
7. If the payment side is healthy but registration still fails after retry, fix the upstream Luma issue first and retry again rather than creating a second payment.

### Webhook delivery looks wrong

1. Check the stored webhook record in `/ops`.
2. Confirm the request signature validation result.
3. For CipherPay, compare the webhook invoice id to the checkout session id.
4. For Luma event hooks, confirm the calendar connection has both `luma_webhook_id` and a resolvable `luma_webhook_secret_ref`.
5. Confirm the callback URL was registered after tokenized fallback auth was added. If not, run `validate and sync` again to recreate the webhook with the current tokenized callback URL.
6. Use the tenant detail page to confirm the Luma key preview, last validation time, webhook status, and latest live Luma feed are all present.
7. If Luma event hooks are not arriving, confirm `APP_PUBLIC_ORIGIN` points at the deployed service origin used during `validate and sync`.
8. If the organizer recently replaced the Luma API key, run `validate and sync` again before expecting webhook intake or upstream preview refreshes to recover.

### Checkout is stuck on payment details after expiry

1. Confirm `cipherpay_expires_at` has passed.
2. Refresh the checkout page.
3. Verify the session shows the expired state rather than active payment controls.
4. If the page still looks active, confirm the deployed frontend is current and the session viewer token is valid.

### Readiness or deployment looks wrong

1. Check `/api/health` to confirm the app is serving.
2. Check `/api/ready` to confirm tenant configuration exists and DynamoDB access works.
3. If `/api/ready` shows missing tenant data, finish onboarding at `/ops/tenants`.
4. If `/api/ready` shows DynamoDB errors, verify the AWS role and table permissions.

### Luma integration inquiries are not arriving

1. Confirm `LUMA_INTEREST_FROM_EMAIL` and `LUMA_INTEREST_INBOX_EMAIL` are set on the deployed branch.
2. Confirm the `from` address or its domain is verified in SES and has sending enabled.
3. Confirm the Amplify compute role has `ses:SendEmail` permission for the selected identity.
4. Submit a test inquiry from `/luma-integration` and check CloudWatch logs for the route error.

### Operator sign-in fails

1. Confirm `ADMIN_SESSION_SECRET` is set.
2. If using password mode, confirm `ADMIN_PASSWORD_HASH` is set and re-run `npm run auth:hash -- "your-password"` locally if the hash needs to be regenerated.
3. If using email mode, confirm `ADMIN_LOGIN_EMAIL`, `ADMIN_AUTH_FROM_EMAIL`, `ADMIN_MAGIC_LINK_SECRET`, and `APP_PUBLIC_ORIGIN` are set.
4. Confirm the `from` address or domain is verified in SES and the Amplify compute role can send from it.
5. Confirm the browser session cookie has not expired and that one-time email links are being used only once.

## Recovery Notes

- The ops console is the main recovery surface.
- The tenant detail page is the quickest place to compare the current live Luma feed against mirrored inventory when something looks off.
- Calendar connections can be disabled from the tenant detail page. Disabling turns off the public calendar route for that connection and clears the managed Luma webhook state, but keeps mirrored inventory available for review.
- The tenant events page separates upstream-only future Luma events from mirrored events and supports event-focused sync/import actions.
- Event-focused sync still runs the existing full-calendar refresh in the backend, but the UI returns a scoped diff for the selected event: imported, updated, removed from the current feed, and ticket-tier changes.
- Keep production secrets in AWS Secrets Manager or your chosen secret manager.
- Do not use mutable runtime config as the source of truth for production secrets.
- Operators do not manually enter Luma webhook ids or secrets; those are managed internally during `validate and sync`.
- Managed Luma webhook callbacks also include a per-calendar fallback token so event refreshes can still be authenticated if Luma omits signature headers.
- Registration retries are stateful: the first registration attempt starts inline when CipherPay reports a detected payment, and any follow-up retries can be run from the ops UI or `/api/ops/process-registration-tasks`.
- The attendee-facing checkout should move through four recognizable states: awaiting payment, payment accepted, preparing your pass, and pass ready.
- Once the pass is ready, the checkout page can save a standalone local pass file in addition to the print/save-PDF flow.
- Structured logs emit checkout, webhook, and registration events with correlation-friendly metadata.

## AWS Recovery and Monitoring

Production operations are AWS-native:

- EventBridge schedules can invoke the registration worker endpoint.
- the worker calls `/api/ops/process-registration-tasks` using `OPS_AUTOMATION_SECRET`.
- CloudWatch alarms can publish to the configured SNS topic.

Required production values:

- `OPS_AUTOMATION_SECRET`
- `SECRET_STORE_BACKEND=aws-secrets-manager`
- `SECRET_STORE_PREFIX`
- `APP_PUBLIC_ORIGIN`
- `ADMIN_PASSWORD_HASH`
- `ADMIN_SESSION_SECRET`
- `LUMA_INTEREST_FROM_EMAIL`
- `LUMA_INTEREST_INBOX_EMAIL`

Additional production values for emailed operator sign-in:

- `ADMIN_LOGIN_EMAIL`
- `ADMIN_AUTH_FROM_EMAIL`
- `ADMIN_MAGIC_LINK_SECRET`

## Probes

- `/api/health` is the simple liveness probe.
- `/api/ready` verifies tenant readiness and DynamoDB access.

Use request ids, session ids, invoice ids, tenant ids, and calendar connection ids to correlate:

- checkout creation
- webhook delivery
- payment status transitions
- registration attempts
- usage reporting
