# ZecTix

ZecTix is a Next.js 15 managed-service fork for Luma event hosts who want to accept Zcash through CipherPay without custody.

This fork is multi-tenant and operator-led, with a tenant self-serve dashboard layered on top of the same mirrored inventory and checkout services:

- each organizer gets a `Tenant`
- each connected Luma calendar is a billable `CalendarConnection`
- public pages read from mirrored `EventMirror` and `TicketMirror` records instead of live global Luma config
- CipherPay invoices are created from tenant-scoped connection data
- payment fulfillment happens through retryable registration tasks, not inline webhook work
- integration secrets are stored as references in app state and resolved through a secret-store abstraction

The repository is designed to run in two environments:

- local development with DynamoDB Local and the local secret store
- AWS deployment with DynamoDB and AWS Secrets Manager

## Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- AWS SDK v3 for DynamoDB and Secrets Manager
- Luma API
- CipherPay API and webhooks

## Main Flows

1. Ops creates a tenant and sets the tenant contact email.
2. Organizers can also start a draft tenant through `/dashboard/start`, which emails the first sign-in link to the owner contact.
3. The tenant signs in through `/dashboard/login` with a one-time email link.
4. The tenant or ops connects a Luma calendar and stores the Luma API key in the secret store.
5. The tenant settings page shows onboarding progress, connection health, embed settings, live Luma preview metadata, and mirrored inventory status for review.
6. The tenant or ops syncs mirrored events and tickets from Luma and connects CipherPay for checkout.
7. Public checkout happens under `/c/[calendarSlug]` and `/c/[calendarSlug]/events/[eventId]`.
8. Tenants can enable iframe embed mode per calendar with allowed origins, default height, and compact theme overrides.
9. CipherPay webhooks update payment state and immediately attempt registration once payment is detected in the mempool.
10. The registration worker processes any follow-up retries through `/api/ops/process-registration-tasks` or the ops recovery UI.
11. Successful registrations are attached back to the checkout session and recorded in the usage ledger.

## Main Routes

- `/` service landing page
- `/c/[calendarSlug]` public event list for one organizer/calendar
- `/c/[calendarSlug]/events/[eventId]` public checkout entry page
- `/checkout/[sessionId]` payment and registration status page
- `/dashboard/login` tenant sign-in
- `/dashboard/start` public self-serve tenant creation and first-owner sign-in
- `/dashboard` tenant dashboard landing page
- `/dashboard/[tenantSlug]` tenant overview
- `/dashboard/[tenantSlug]/events` tenant event review and ticket settings
- `/dashboard/[tenantSlug]/settings` tenant connection and checkout setup
- `/ops/login` operator sign-in
- `/ops` operator overview
- `/ops/tenants` tenant onboarding and inventory
- `/ops/tenants/[tenantId]` tenant detail, connection review, and live Luma preview
- `/ops/tenants/[tenantId]/dashboard` internal tenant dashboard designed for future organizer reuse
- `/ops/tenants/[tenantId]/events` ticket eligibility controls and mirrored event review
- `/ops/tenants/[tenantId]/recovery` resync and retry tools
- `/ops/reports` usage reporting and CSV export

API routes:

- `/api/checkout`
- `/api/sessions/[sessionId]`
- `/api/cipherpay/webhook`
- `/api/dashboard/login`
- `/api/dashboard/logout`
- `/api/luma/webhook`
- `/api/ops/login`
- `/api/ops/logout`
- `/api/ops/process-registration-tasks`
- `/api/ops/reports`
- `/api/health`
- `/api/ready`

## Secret Storage

Secrets are no longer stored as one global mutable runtime config.

Supported backends:

- `local` for development and tests
- `aws-secrets-manager` for production

The backend is selected with `SECRET_STORE_BACKEND`.

Local development stores secret values on disk in a JSON file under `.zectix-local/`.

Production stores only secret references in DynamoDB and resolves the actual values from AWS Secrets Manager.

## Eligibility Model

Only tickets that pass both layers are eligible for public Zcash checkout:

- automatic checks: active, fixed-price, supported currency
- operator assertions: no approval required, no extra mandatory registration questions, fixed price confirmed

If a ticket does not pass both layers, it stays out of public checkout.

## Local Development

### 1. Install dependencies

```sh
npm install
```

### 2. Copy the local env template if you want overrides

```sh
cp .env.local.template .env.local
```

### 3. Start DynamoDB Local

```sh
docker compose up -d
```

### 4. Create the local table

```sh
npm run db:init
```

### 5. Start the dev server

```sh
npm run dev
```

### 6. Open the app

The local base path is usually `/zectix`, so the most useful URLs are:

- `http://localhost:3000/zectix`
- `http://localhost:3000/zectix/dashboard/login`
- `http://localhost:3000/zectix/ops/login`
- `http://localhost:3000/zectix/ops`
- `http://localhost:3000/zectix/c/[calendarSlug]`

## Environment Variables

Common local variables:

- `APP_BASE_PATH=/zectix`
- `APP_PUBLIC_ORIGIN=http://localhost:3000`
- `DYNAMODB_ENDPOINT=http://127.0.0.1:8000`
- `DYNAMODB_TABLE_NAME=zectix`
- `AWS_REGION=us-east-1`
- `AWS_ACCESS_KEY_ID=local`
- `AWS_SECRET_ACCESS_KEY=local`
- `SECRET_STORE_BACKEND=local`

Optional operator auth:

- `ADMIN_PASSWORD_HASH`
- `ADMIN_SESSION_SECRET`
- `ADMIN_LOGIN_EMAIL`
- `ADMIN_AUTH_FROM_EMAIL`
- `ADMIN_MAGIC_LINK_SECRET`

Optional tenant auth:

- `TENANT_SESSION_SECRET`
- `TENANT_AUTH_FROM_EMAIL`
- `TENANT_MAGIC_LINK_SECRET`

Tenant auth falls back to the admin email sender and secrets when the tenant-specific values are unset, so staging and production can share the same SES path if desired.

Optional session viewer protection:

- `SESSION_VIEWER_SECRET`

Optional secret-store settings:

- `LOCAL_SECRET_STORE_FILE`
- `SECRET_STORE_BACKEND=aws-secrets-manager`
- `SECRET_STORE_PREFIX`

Optional automation and recovery:

- `OPS_AUTOMATION_SECRET`
- `ALLOW_RUNTIME_SECRET_STORAGE`

Optional tenant billing defaults:

- `TENANT_DEFAULT_SERVICE_FEE_BPS`
- `TENANT_DEFAULT_SETTLEMENT_THRESHOLD_ZATOSHIS`

Optional inbox for the Luma integration beta application:

- `LUMA_INTEREST_FROM_EMAIL`
- `LUMA_INTEREST_INBOX_EMAIL`

## Operator Notes

- `/ops` is the primary console for onboarding, monitoring, retries, and reporting.
- operator auth can run in password mode or emailed one-time-link mode. Email mode uses the configured admin email, stores one-time verification tokens in DynamoDB, and sends the link through SES.
- `/dashboard/start` creates a draft tenant for self-serve onboarding and emails the first one-time sign-in link.
- `/dashboard` is the tenant self-serve surface. The first version still uses the tenant `contact_email` as the organizer sign-in identity and sends one-time login links through SES.
- `/luma-integration` is the public-facing beta application page for the managed Luma integration.
- `/api/luma-integration-interest` validates the application payload and sends an SES email to the configured inbox.
- operators save the Luma API key only; managed Luma webhook ids and secrets are stored internally after `validate and sync`.
- the tenant detail page shows both the live Luma feed and the mirrored events so operators can review what will be exposed publicly, along with the last successful validation time for the saved key.
- `validate and sync` verifies the Luma API key, auto-registers the managed webhook for `event.created`, `event.updated`, and `event.canceled`, stores a per-calendar callback token for fallback authentication, and refreshes mirrored events/tickets.
- if an older calendar connection was registered before callback tokens were added, run `validate and sync` once to recreate the managed webhook URL with the new tokenized callback.
- calendar connections can be disabled from the tenant detail page to turn off public checkout for that calendar and clear the managed Luma webhook state without deleting mirrored history.
- the tenant events page separates mirrored events from upstream-only Luma events that are visible to the saved key but not yet in the mirrored checkout surface.
- event-focused sync controls let ops sync one mirrored or upstream-only event at a time while still using the existing full-calendar refresh as the backend source of truth.
- upstream-only events have a surgical import path in the UI: syncing one selected upstream event imports it into mirrored inventory if it is still present in Luma, and the result is shown as an event-focused diff.
- the tenant dashboard is the internal organizer-style view for connection health, upcoming mirrored inventory, recent sessions, and webhook visibility.
- the tenant settings page now also manages calendar-level iframe embed settings, including origin allowlists, default iframe height, branding visibility, and compact theme overrides.
- the public event form shows only ticket tiers that are active and enabled for managed Zcash checkout.
- embedded checkout reuses the mirrored public event and checkout pages, adds a compact shell, and emits `postMessage` events for resize and checkout state updates.
- the checkout page centers the attendee-facing payment/pass states: pay with Zcash, preparing your pass, pass ready, open on Luma, and save pass.
- `/api/luma/webhook` verifies the raw request body before refreshing mirrored Luma events.
- `/api/ops/process-registration-tasks` is protected by `OPS_AUTOMATION_SECRET`.
- `/api/ops/reports` returns JSON by default and CSV when `?format=csv` is supplied.
- `/api/health` is a simple liveness probe.
- `/api/ready` now reports whether the environment is healthy and whether tenant traffic is ready, even when no tenants exist yet.

## Verification

```sh
npm run lint
npm test
npm run typecheck
```

## Related Docs

- [`RUNBOOK.md`](./RUNBOOK.md)
