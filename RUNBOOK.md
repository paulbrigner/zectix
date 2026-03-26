# ZecTix Runbook

This is the operator checklist for the managed service fork.

## First Checks

When something looks off, check these in order:

1. AWS deployment status and recent job logs.
2. `/ops` for tenant health, recent sessions, recent webhooks, and recent registration tasks.
3. `/api/health` and `/api/ready` for quick liveness/readiness confirmation.
4. The affected checkout session for `status`, `registration_status`, `registration_error`, and `cipherpay_expires_at`.
5. Environment variables and secret-store entries for the affected tenant connection.

## Common Issues

### Payment accepted but registration is missing

1. Confirm the session has `status` of `detected` or `confirmed`.
2. Check whether `registration_status` is `failed` or `retry_wait` and read the stored error.
3. Confirm the tenant’s Luma API secret resolves correctly from the secret store.
4. Confirm the tenant’s CipherPay webhook secret resolves correctly.
5. Use `/ops/tenants/[tenantId]/recovery` to retry the session or process due tasks.
6. If the payment side is healthy but registration still fails after retry, fix the upstream Luma issue first and retry again rather than creating a second payment.

### Webhook delivery looks wrong

1. Check the stored webhook record in `/ops`.
2. Confirm the request signature validation result.
3. For CipherPay, compare the webhook invoice id to the checkout session id.
4. For Luma event hooks, confirm the calendar connection has both `luma_webhook_id` and a resolvable `luma_webhook_secret_ref`.
5. If Luma event hooks are not arriving, confirm `APP_PUBLIC_ORIGIN` points at the deployed service origin used during `validate and sync`.

### Checkout is stuck on payment details after expiry

1. Confirm `cipherpay_expires_at` has passed.
2. Refresh the checkout page.
3. Verify the session now shows the expired state rather than active payment controls.
4. If the page still looks active, confirm the deployed frontend is current and the session viewer token is valid.

### Readiness or deployment looks wrong

1. Check `/api/health` to confirm the app is serving.
2. Check `/api/ready` to confirm tenant configuration exists and DynamoDB access works.
3. If `/api/ready` shows missing tenant data, finish onboarding at `/ops/tenants`.
4. If `/api/ready` shows DynamoDB errors, verify the AWS role and table permissions.

### Operator sign-in fails

1. Confirm `ADMIN_PASSWORD_HASH` and `ADMIN_SESSION_SECRET` are set.
2. Confirm the browser session cookie has not expired.
3. Re-run `npm run auth:hash -- "your-password"` locally if the hash needs to be regenerated.

## Recovery Notes

- The ops console is the main recovery surface.
- Keep production secrets in AWS Secrets Manager or your chosen secret manager.
- Do not use mutable runtime config as the source of truth for production secrets.
- Registration retries are stateful: failed sessions carry retry metadata and can be retried from the ops UI or `/api/ops/process-registration-tasks`.
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

## Probes

- `/api/health` is the simple liveness probe.
- `/api/ready` verifies tenant readiness and DynamoDB access.

Use request ids, session ids, invoice ids, tenant ids, and calendar connection ids to correlate:

- checkout creation
- webhook delivery
- payment status transitions
- registration attempts
- usage reporting
