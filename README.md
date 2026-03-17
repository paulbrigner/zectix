# LumaZcash

This repo is a lightweight demo app for Luma event registration plus CipherPay Zcash checkout. It includes:

- Luma-powered event browsing
- Event checkout pages that create CipherPay invoices
- A DynamoDB-backed local session log
- `/dashboard` and `/admin` pages for operations and configuration
- Webhook handling and Luma registration fulfillment after payment confirmation

## Runtime Targets

- Next.js `15.5.12`
- React `19.1.1`
- Node `22`

This matches the deployed `zodldashboard` app that is already running on AWS Amplify.

## Local Development

1. Install dependencies.

```sh
npm install
```

2. Copy the env template if you want optional overrides.

```sh
cp .env.local.template .env.local
```

3. Start DynamoDB Local.

```sh
docker compose up -d
```

4. Create the local test state table.

```sh
npm run db:init
```

5. Start the app.

```sh
npm run dev
```

6. Open the admin page and save your Luma and CipherPay settings.

```text
http://localhost:3000/lumazcash/admin
```

By default, local development uses the `/lumazcash` base path. Set `APP_BASE_PATH=` in `.env.local` if you want the app at the root instead.

## Main Routes

- `/` or `/lumazcash` home page, depending on `APP_BASE_PATH`
- `/events/[eventId]` event checkout page
- `/checkout/[sessionId]` live payment and registration status page
- `/dashboard` operations dashboard
- `/admin` admin and secrets/config page
- `/admin-login` shared-password login page when demo admin auth is enabled

## Persistence Model

- `Luma` remains the source of truth for events and final registrations
- `CipherPay` remains the source of truth for invoice and payment status
- `DynamoDB Local` stores the small amount of glue state needed for local testing:
  - config
  - checkout sessions
  - webhook deliveries

## Amplify Deployment

- [`amplify.yml`](/Users/paulbrigner/Library/Mobile%20Documents/com~apple~CloudDocs/Dev/basketball-club-example/amplify.yml) injects the selected deployment env vars into `.env.production` before `npm run build`.
- Leave `DYNAMODB_ENDPOINT` unset in Amplify so the app uses managed DynamoDB instead of the local endpoint.
- You can protect `/admin` and `/dashboard` in a demo deployment by setting:
  - `ADMIN_PASSWORD_HASH`
  - `ADMIN_SESSION_SECRET`
- Generate those values with:

```sh
npm run auth:hash -- "your-demo-password"
```

The current implementation still defaults to local DynamoDB in `next dev`, but it is now structured so Amplify can use managed DynamoDB and optional shared-password admin auth without changing the app-level data model.
