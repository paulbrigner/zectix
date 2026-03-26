# AGENTS.md

This file provides guidance to Codex when working in this repository.

## Project Overview

Next.js managed-service fork for selling Luma event registrations through CipherPay with Zcash.

The fork is multi-tenant and operator-led. Public checkout is exposed under `/c/*`, and the operator console lives under `/ops/*`.

## Development Commands

```bash
npm install    # Install dependencies
npm run dev    # Dev server
npm run build  # Production build
npm run start  # Production server
npm run lint   # ESLint
npm test       # Vitest
npm run typecheck  # TypeScript check
```

## Architecture

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode, `@/*` path alias)
- **Styling**: Tailwind CSS v4
- **UI**: Custom components + Radix UI primitives
- **State**: DynamoDB-backed application state under `lib/app-state`
- **Secrets**: backend abstraction under `lib/secrets`

### Application State

- `lib/app-state/state.ts` manages tenants, calendar connections, CipherPay connections, mirrored events, mirrored tickets, checkout sessions, webhook deliveries, registration tasks, usage ledger entries, and rate-limit counters.
- `lib/app-state/service.ts` coordinates mirrored public checkout, CipherPay webhooks, and tenant-aware registration/task handling.
- Production secrets should be stored as references in DynamoDB and resolved from AWS Secrets Manager unless `SECRET_STORE_BACKEND=local` is explicitly selected for development.

### Production Hardening Notes

- Keep production-facing behavior simple and observable: prefer small helpers, explicit state transitions, and clear operator-facing messages.
- When changing checkout, webhook, auth, registration, or reporting logic, add tests for the pure helpers and service paths first.
- `RUNBOOK.md` is the current source of truth for operational recovery steps and should stay in sync with behavior changes.
- Keep health/readiness routes compact, and keep recovery endpoints operator-only, explicit, and auditable.

### Public Surface

- Public checkout is mirrored data only.
- The service should not rely on live global Luma config for public pages.
- Unsupported tickets should stay excluded from public checkout until operator assertions are complete.
