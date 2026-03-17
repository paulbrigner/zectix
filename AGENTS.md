# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

Next.js app demonstrating a Luma + CipherPay Zcash checkout flow for event registrations.

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

### Luma API Integration

`components/EventList.tsx` is an async server component that fetches events from `https://public-api.luma.com/v1/calendar/list-events` using the `LUMA_API_KEY` env var or the runtime config saved through `/admin`. Response shape: `{ entries: [{ api_id, event: { name, start_at, cover_url, url } }] }`.
