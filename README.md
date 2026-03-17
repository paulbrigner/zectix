# LumaZcash

LumaZcash is a Next.js demo app that shows how to sell Luma event registrations for Zcash using CipherPay.

The app:

- loads upcoming events from Luma
- creates CipherPay invoices from Luma ticket pricing
- presents an in-app Zcash payment flow with QR and wallet deep link
- records checkout and webhook state in DynamoDB
- completes the Luma registration after payment is accepted
- includes `/admin` and `/dashboard` surfaces for configuration and operational visibility

This repository is designed to work well in two environments:

- local development with DynamoDB Local
- AWS Amplify hosting with managed DynamoDB

## Disclaimer

This codebase was generated and iterated with Codex GPT-5.4.

It has not been formally audited or professionally reviewed for security,
correctness, compliance, or production readiness.

If you plan to use this code in production:

- perform your own engineering review
- add comprehensive automated and manual testing
- validate all payment, webhook, and registration edge cases
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
4. CipherPay webhook callbacks update local checkout state.
5. The app registers the attendee with Luma.
6. The checkout page renders a final pass view using the Luma guest record.

## Main Routes

- `/` home page in production, or `/lumazcash` in local development by default
- `/events/[eventId]` event checkout entry page
- `/checkout/[sessionId]` live payment and registration status page
- `/admin-login` demo admin sign-in page
- `/admin` runtime configuration page
- `/dashboard` local operational dashboard
- `/api/checkout` checkout session creation
- `/api/cipherpay/webhook` CipherPay webhook endpoint
- `/api/admin/config` admin config API
- `/api/dashboard` dashboard API

## Runtime Configuration Model

The app can boot with no Luma or CipherPay secrets configured.

That is intentional.

- In local development, the app starts against a local DynamoDB table by default.
- In AWS, the app starts against a managed DynamoDB table by default.
- Luma and CipherPay config can be saved later through `/admin`.

The persisted runtime config currently stores:

- CipherPay network
- CipherPay API base URL override
- CipherPay checkout base URL override
- CipherPay API key
- CipherPay webhook secret
- Luma API key

## Requirements

- Node.js 22
- npm
- Docker Desktop or another way to run DynamoDB Local for local development

## Scripts

```sh
npm install
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run db:init
npm run auth:hash -- "your-demo-password"
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

You can also remove most values and let the app use its defaults.

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

## Local Environment Variables

The local template is in [.env.local.template](/Users/paulbrigner/Library/Mobile%20Documents/com~apple~CloudDocs/Dev/basketball-club-example/.env.local.template).

Common local variables:

- `APP_BASE_PATH=/lumazcash`
- `DYNAMODB_ENDPOINT=http://127.0.0.1:8000`
- `DYNAMODB_TABLE_NAME=lumazcash`
- `AWS_REGION=us-east-1`
- `AWS_ACCESS_KEY_ID=local`
- `AWS_SECRET_ACCESS_KEY=local`

Optional demo auth:

- `ADMIN_PASSWORD_HASH`
- `ADMIN_SESSION_SECRET`

Optional preloaded integrations:

- `LUMA_API_KEY`
- `CIPHERPAY_API_KEY`
- `CIPHERPAY_WEBHOOK_SECRET`
- `CIPHERPAY_NETWORK`
- `CIPHERPAY_API_BASE_URL`
- `CIPHERPAY_CHECKOUT_BASE_URL`

## Demo Admin Authentication

`/admin` and `/dashboard` can be protected with a shared password.

Generate the required values with:

```sh
npm run auth:hash -- "your-demo-password"
```

Then set:

- `ADMIN_PASSWORD_HASH`
- `ADMIN_SESSION_SECRET`

When those variables are present, the app requires sign-in through `/admin-login`.

## Webhooks

### Local webhook URLs

If you expose your local dev server through Caddy or another reverse proxy, the public webhook URLs should point to the app's active base path.

For example:

- CipherPay: `https://your-local-domain.example/lumazcash/api/cipherpay/webhook`

### Production webhook URLs

On a dedicated production domain with no base path:

- CipherPay: `https://your-domain.example/api/cipherpay/webhook`

For the current AWS target domain, that is expected to be:

- `https://lumazcash.pgpforcrypto.org/api/cipherpay/webhook`

## AWS Amplify Deployment

This repository is set up for straightforward Amplify deployment.

### Production assumptions

- production runs at the domain root, not under `/lumazcash`
- the app uses managed DynamoDB
- `/admin` and `/dashboard` are protected with demo auth
- runtime integration secrets can still be entered later via `/admin`

### Amplify build config

The build configuration is in [amplify.yml](/Users/paulbrigner/Library/Mobile%20Documents/com~apple~CloudDocs/Dev/basketball-club-example/amplify.yml).

It:

- installs dependencies
- writes selected Amplify environment variables into `.env.production`
- runs `npm run build`

### Recommended Amplify environment variables

Required for deployment:

- `DYNAMODB_TABLE_NAME=lumazcash`
- `ADMIN_PASSWORD_HASH`
- `ADMIN_SESSION_SECRET`

Optional if you want integration values preloaded at deploy time:

- `LUMA_API_KEY`
- `CIPHERPAY_API_KEY`
- `CIPHERPAY_WEBHOOK_SECRET`
- `CIPHERPAY_NETWORK`
- `CIPHERPAY_API_BASE_URL`
- `CIPHERPAY_CHECKOUT_BASE_URL`

Recommended production behavior:

- leave `APP_BASE_PATH` unset
- leave `DYNAMODB_ENDPOINT` unset

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

### Deployment order

1. Push `main` to GitHub.
2. Connect the repo to Amplify.
3. Configure the required Amplify environment variables.
4. Ensure the Amplify compute role has access to DynamoDB.
5. Deploy the app.
6. Configure the final production webhook URLs in CipherPay and Luma.
7. Open `/admin` and save any missing runtime secrets.

## DynamoDB State

The DynamoDB table stores the small amount of orchestration state needed for the demo:

- runtime config
- checkout sessions
- recorded webhook deliveries

Luma remains the source of truth for event and registration data.

CipherPay remains the source of truth for invoice and payment state.

## Notes on Base Path Behavior

Base path behavior is controlled in [next.config.mjs](/Users/paulbrigner/Library/Mobile%20Documents/com~apple~CloudDocs/Dev/basketball-club-example/next.config.mjs) and [lib/app-paths.ts](/Users/paulbrigner/Library/Mobile%20Documents/com~apple~CloudDocs/Dev/basketball-club-example/lib/app-paths.ts).

Current defaults:

- local development: `/lumazcash`
- production: root `/`

You can override that with `APP_BASE_PATH`.

## License

All code in this workspace is licensed under either of:

- Apache License, Version 2.0 (see [LICENSE-APACHE](/Users/paulbrigner/Library/Mobile%20Documents/com~apple~CloudDocs/Dev/basketball-club-example/LICENSE-APACHE) or [http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0))
- MIT license (see [LICENSE-MIT](/Users/paulbrigner/Library/Mobile%20Documents/com~apple~CloudDocs/Dev/basketball-club-example/LICENSE-MIT) or [http://opensource.org/licenses/MIT](http://opensource.org/licenses/MIT))

at your option.
