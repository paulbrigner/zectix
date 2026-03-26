# Migration From DIY

This document explains how the managed-service fork diverges from the original DIY single-tenant repo.

## What Changed

- The old single global runtime configuration model is replaced by tenant-scoped records.
- Public event discovery now lives under `/c/[calendarSlug]` instead of the DIY single-calendar homepage flow.
- Public checkout uses mirrored `EventMirror` and `TicketMirror` data instead of live Luma lookups on every request.
- Each organizer brings their own Luma API key and CipherPay account, stored as secret references rather than plaintext runtime config.
- CipherPay webhooks now enqueue registration work instead of completing Luma fulfillment inline.
- Operator recovery happens through `/ops` and `/api/ops/process-registration-tasks` rather than the DIY dashboard flow.

## New Core Concepts

- `Tenant` is the organizer/customer record.
- `CalendarConnection` is the billable unit and the public URL slug source.
- `CipherPayConnection` holds tenant-owned payment settings and secret references.
- `EventMirror` and `TicketMirror` are the local public inventory for checkout.
- `RegistrationTask` is the retryable fulfillment unit.
- `UsageLedgerEntry` captures monthly reporting and service-fee math.

## URL Changes

- `/` is now a service landing page.
- `/c/[calendarSlug]` is the public organizer calendar.
- `/c/[calendarSlug]/events/[eventId]` is the public event checkout entry.
- `/ops` is the operator console.
- `/ops/login` is the operator sign-in page.
- `/ops/tenants/[tenantId]` is the tenant detail page.
- `/ops/reports` is the monthly usage reporting page.

## Operational Changes

- Luma sync is explicit and mirrored instead of implicit and live.
- Ticket eligibility is gated by both automatic checks and operator assertions.
- Webhooks are acknowledged quickly and processed through durable task state.
- Recovery and reprocessing are visible and auditable from the ops UI.

## Compatibility Notes

- Some old DIY assumptions no longer apply, especially the one-global-config model.
- The new fork is intended for operator-led onboarding only.
- Public pages should be treated as tenant-scoped and non-interchangeable.

## What To Update When Extending The Fork

- Update `RUNBOOK.md` when recovery behavior changes.
- Update `AGENTS.md` when architectural expectations change.
- Update the ops console whenever new recovery or reporting capabilities are added.
- Update the migration notes whenever a new service-fork divergence is introduced.
