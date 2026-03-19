# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

Next.js app for selling Luma event registrations through CipherPay with Zcash.

## Development Commands

```bash
npm install    # Install dependencies
npm run dev    # Dev server
npm run build  # Production build
npm run start  # Production server
npm run lint   # ESLint
```

## Architecture

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode, `@/*` path alias)
- **Styling**: Tailwind CSS v4
- **UI**: Custom components + Radix UI primitives
- **State**: DynamoDB-backed application state under `lib/app-state`

### Application State

- `lib/app-state/state.ts` manages runtime config, checkout sessions, webhook records, checkout lookup items, and lightweight rate-limit counters.
- `lib/app-state/service.ts` coordinates the Luma + CipherPay workflow.
- In production, integration secrets are expected to come from environment variables rather than mutable runtime storage unless `ALLOW_RUNTIME_SECRET_STORAGE=true` is explicitly set.

### Luma API Integration

`components/EventList.tsx` is an async server component that fetches events from `https://public-api.luma.com/v1/calendar/list-events` using the `LUMA_API_KEY` env var or the runtime config saved through `/admin`. Response shape: `{ entries: [{ api_id, event: { name, start_at, cover_url, url } }] }`.
