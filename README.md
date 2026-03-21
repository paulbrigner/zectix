# LumaZcash

LumaZcash is a Next.js application for selling Luma event registrations through CipherPay with Zcash.

The app:

- loads upcoming events from Luma
- creates CipherPay invoices from Luma ticket pricing
- presents an in-app Zcash payment flow with QR and wallet deep link
- records checkout and webhook state in DynamoDB
- completes Luma registration after payment is accepted
- includes `/admin` and `/dashboard` surfaces for configuration and operations

This repository is designed to run in two environments:

- local development with DynamoDB Local
- AWS Amplify hosting with managed DynamoDB

## Disclaimer

This codebase was generated and iterated with Codex GPT-5.4.

It has not been formally audited or professionally reviewed for security,
correctness, compliance, or production readiness.

If you plan to use this code in production:

- perform your own engineering review
- add comprehensive automated and manual testing
- validate payment, webhook, and registration edge cases
- review infrastructure, auth, and secret-handling decisions

Use at your own risk.

## Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- AWS SDK v3 for DynamoDB
- Luma API
- CipherPay API and webhooks

## Core Flow

1. A user opens an event page and selects a Luma ticket type.
2. The app creates a CipherPay invoice using the Luma ticket price.
3. The buyer pays with Zcash inside the app.
4. CipherPay webhook callbacks update checkout state.
5. The app registers the attendee with Luma after payment is accepted.
6. The checkout page renders a final pass using the Luma guest record.

## Main Routes

- `/` home page in production, or `/lumazcash` in local development by default
- `/events/[eventId]` event checkout entry page
- `/checkout/[sessionId]` live payment and registration status page
- `/admin-login` shared-password sign-in page for operations routes
- `/admin` runtime configuration page
- `/dashboard` operational dashboard
- `/api/checkout` checkout session creation
- `/api/cipherpay/webhook` CipherPay webhook endpoint
- `/api/admin/config` admin config API
- `/api/dashboard` dashboard API
- `/api/sessions/[sessionId]` signed checkout-session status API

## Runtime Configuration

The app can boot with no Luma or CipherPay secrets configured.

- In local development, the app starts against a local DynamoDB table by default.
- In AWS, the app starts against a managed DynamoDB table by default.
- Non-secret settings can be saved later through `/admin`.

### Local secret behavior

For local development, you can either:

- save Luma and CipherPay secrets through `/admin`
- or pre-seed them with environment variables

### Production secret behavior

In production, secrets should be injected through environment variables or a deployment secret manager.

By default, when `NODE_ENV=production`, the app treats these values as externally managed and does not persist them back into the DynamoDB config record:

- `LUMA_API_KEY`
- `CIPHERPAY_API_KEY`
- `CIPHERPAY_WEBHOOK_SECRET`

This reduces the blast radius of an application-level config compromise and keeps third-party credentials out of normal mutable app state.

If you intentionally want runtime secret storage enabled in production, you can override that behavior with:

- `ALLOW_RUNTIME_SECRET_STORAGE=true`

That override is not recommended.

## Hardening Included

This repo includes several production-oriented safeguards:

- shared-password protection for `/admin` and `/dashboard`
- per-IP and per-attendee checkout throttling on `/api/checkout`
- idempotent reuse of still-active checkout sessions instead of always minting a new CipherPay invoice
- signed viewer tokens for `/checkout/[sessionId]` and `/api/sessions/[sessionId]`
- targeted session lookup items in DynamoDB to avoid full attendee-session scans as volume grows

### Checkout rate limiting

`/api/checkout` enforces lightweight limits to slow down abuse:

- per IP address
- per attendee email + event combination

When the limit is exceeded, the API returns `429 Too Many Requests` with a `Retry-After` header.

### Signed session viewer tokens

Checkout session pages and session polling APIs can be protected with a signed viewer token.

By default:

- in production, the app protects session reads using `SESSION_VIEWER_SECRET`, or falls back to `ADMIN_SESSION_SECRET`
- in local development, session token protection stays off unless `SESSION_VIEWER_SECRET` is set

This prevents anyone who only guesses a `sessionId` from reading checkout state.

## Requirements

- Node.js 22
- npm
- Docker Desktop or another way to run DynamoDB Local for local development
- a Luma Plus subscription for the API access this app depends on

## Scripts

```sh
npm install
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run db:init
npm run auth:hash -- "choose-a-shared-password"
```

## Local Development

### 1. Install dependencies

```sh
npm install
```

### 2. Copy the local env template if you want overrides

```sh
cp .env.local.template .env.local
```

You can also leave most values unset and let the app use its defaults.

### 3. Start DynamoDB Local

```sh
docker compose up -d
```

### 4. Create the local table

```sh
npm run db:init
```

This creates the default local table:

```text
lumazcash
```

### 5. Start the dev server

```sh
npm run dev
```

### 6. Open the app

By default, local development uses a base path of `/lumazcash`, so the main local URLs are:

- `http://localhost:3000/lumazcash`
- `http://localhost:3000/lumazcash/admin`
- `http://localhost:3000/lumazcash/dashboard`

### 7. Save Luma and CipherPay settings in `/admin`

Once those values are saved, the app can create invoices and complete registrations.

Note:

- this app assumes your Luma account has the API access included with Luma Plus

## Local Environment Variables

The local template is in [`./.env.local.template`](./.env.local.template).

Common local variables:

- `APP_BASE_PATH=/lumazcash`
- `DYNAMODB_ENDPOINT=http://127.0.0.1:8000`
- `DYNAMODB_TABLE_NAME=lumazcash`
- `AWS_REGION=us-east-1`
- `AWS_ACCESS_KEY_ID=local`
- `AWS_SECRET_ACCESS_KEY=local`

Optional shared auth:

- `ADMIN_PASSWORD_HASH`
- `ADMIN_SESSION_SECRET`

Optional session viewer protection:

- `SESSION_VIEWER_SECRET`

Optional preloaded integrations:

- `LUMA_API_KEY`
- `CIPHERPAY_API_KEY`
- `CIPHERPAY_WEBHOOK_SECRET`
- `CIPHERPAY_NETWORK`
- `CIPHERPAY_API_BASE_URL`
- `CIPHERPAY_CHECKOUT_BASE_URL`

## Operations Authentication

`/admin` and `/dashboard` can be protected with a shared password.

Generate the required values with:

```sh
npm run auth:hash -- "choose-a-shared-password"
```

Then set:

- `ADMIN_PASSWORD_HASH`
- `ADMIN_SESSION_SECRET`

When those variables are present, the app requires sign-in through `/admin-login`.

## Webhooks

### Local webhook URLs

If you expose your local dev server through Caddy or another reverse proxy, the public webhook URL should point to the app's active base path.

For example:

- CipherPay: `https://your-local-domain.example/lumazcash/api/cipherpay/webhook`

### Production webhook URL

On a dedicated production domain with no base path:

- CipherPay: `https://your-domain.example/api/cipherpay/webhook`

For the current AWS target domain:

- `https://lumazcash.pgpforcrypto.org/api/cipherpay/webhook`

## AWS Amplify Deployment

This repository is set up for straightforward Amplify deployment.

### Production assumptions

- production runs at the domain root, not under `/lumazcash`
- the app uses managed DynamoDB
- `/admin` and `/dashboard` are protected with shared auth
- integration secrets are injected through Amplify environment variables
- the app role, not static AWS credentials, provides DynamoDB access

### Amplify build config

The build configuration is in [`./amplify.yml`](./amplify.yml).

It:

- installs dependencies
- writes selected Amplify environment variables into `.env.production`
- runs `npm run build`

### Recommended Amplify environment variables

Required:

- `DYNAMODB_TABLE_NAME=lumazcash`
- `ADMIN_PASSWORD_HASH`
- `ADMIN_SESSION_SECRET`

Recommended for production:

- `SESSION_VIEWER_SECRET`
- `LUMA_API_KEY`
- `CIPHERPAY_API_KEY`
- `CIPHERPAY_WEBHOOK_SECRET`

Optional overrides:

- `CIPHERPAY_NETWORK`
- `CIPHERPAY_API_BASE_URL`
- `CIPHERPAY_CHECKOUT_BASE_URL`

Recommended production behavior:

- leave `APP_BASE_PATH` unset
- leave `DYNAMODB_ENDPOINT` unset
- leave `ALLOW_RUNTIME_SECRET_STORAGE` unset

Notes:

- The app defaults to `us-east-1` if `AWS_REGION` is not set.
- In Amplify, the compute role should provide DynamoDB access instead of static AWS credentials.
- If your Amplify runtime exposes temporary AWS credentials, the app supports `AWS_SESSION_TOKEN`.

### AWS resources

The current deployment model expects:

- an Amplify Hosting app for this repository
- a managed DynamoDB table named `lumazcash`
- an Amplify compute role with permission to read and write that table
- a public domain or subdomain, such as `lumazcash.pgpforcrypto.org`

### Custom domain note

Amplify deployment and Amplify custom-domain routing are separate concerns.

- `amplify.yml` controls the app build
- the public hostname only works after Amplify has an attached domain association and a `subdomain -> branch` mapping such as `lumazcash -> main`

If your DNS is managed in Route53 in the same AWS account, Amplify can usually create the DNS record for you once that mapping is configured.

If you disconnect and reconnect the GitHub repository or recreate the Amplify app, verify that the custom domain still includes the expected subdomain mapping.

For this app, the expected production mapping is:

- domain: `pgpforcrypto.org`
- subdomain: `lumazcash`
- branch: `main`

That should result in:

- `https://lumazcash.pgpforcrypto.org`
- `https://lumazcash.pgpforcrypto.org/api/cipherpay/webhook`

### Deployment order

1. Push `main` to GitHub.
2. Connect the repo to Amplify.
3. Configure the required Amplify environment variables.
4. Ensure the Amplify compute role has access to DynamoDB.
5. Attach the production custom domain and confirm the `lumazcash -> main` subdomain mapping exists.
6. Deploy the app.
7. Verify that `lumazcash.pgpforcrypto.org` resolves publicly before configuring webhooks.
8. Configure the final production webhook URL in CipherPay.
9. Open `/admin` and save any non-secret runtime settings you want to override.

## DynamoDB State

The DynamoDB table stores the orchestration state needed for the application:

- runtime configuration
- checkout sessions
- checkout lookup items
- recorded webhook deliveries
- checkout rate-limit counters

Luma remains the source of truth for event and registration data.

CipherPay remains the source of truth for invoice and payment state.

## Base Path Behavior

Base path behavior is controlled in [`./next.config.mjs`](./next.config.mjs) and [`./lib/app-paths.ts`](./lib/app-paths.ts).

Current defaults:

- local development: `/lumazcash`
- production: root `/`

You can override that with `APP_BASE_PATH`.

## License

All code in this workspace is licensed under either of:

- Apache License, Version 2.0 (see [`LICENSE-APACHE`](./LICENSE-APACHE) or [http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0))
- MIT license (see [`LICENSE-MIT`](./LICENSE-MIT) or [http://opensource.org/licenses/MIT](http://opensource.org/licenses/MIT))

at your option.
