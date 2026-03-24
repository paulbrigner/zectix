# LumaZcash Design Review

**Date:** 2026-03-24  
**Reviewer:** Master Control  
**Repository:** `/Users/paulbrigner/dev/lumazcash`

---

## Executive Summary

LumaZcash is a focused Next.js 15 application that sells Luma event registrations through a Zcash payment flow backed by CipherPay. The architecture is compact, readable, and more disciplined than a lot of first-generation AI-assisted app code: core business logic is mostly pushed into `lib/`, persistence concerns are isolated under `lib/app-state/`, and the user-facing flow is understandable end to end.

The repo’s strongest qualities are **clarity, narrow scope, and pragmatic separation of concerns**. The main weaknesses are **lack of test coverage, thin operational guardrails, and some security/robustness gaps around admin auth, webhook handling, and production observability**.

My overall assessment:
- **Architecture:** good and coherent for the app’s size
- **Code organization:** strong
- **Production readiness for real money flow:** not there yet without another round of hardening
- **Best next move:** add tests, tighten admin/auth and webhook operations, and improve observability/docs before trusting it at higher stakes

---

## 1. What the System Is

At a high level, the app does this:

1. Load Luma events and ticket types
2. Let a user enter attendee info and choose a ticket
3. Create a CipherPay invoice using the Luma price
4. Persist checkout session state in DynamoDB
5. Accept CipherPay webhooks to update payment status
6. Register the attendee in Luma after payment is accepted
7. Show a live checkout/status page and operational admin/dashboard views

That’s a clean product story, and the implementation mostly follows it without a lot of architectural noise.

---

## 2. Architecture Assessment

### 2.1 Overall structure

The repo is sensibly divided:

- `app/` → route handlers and pages
- `components/` → UI building blocks
- `lib/` → core business logic and integration code
- `lib/app-state/` → persistence and domain-state layer
- `scripts/` → setup helpers

This is a solid App Router layout. The most important architectural choice here is that the app avoids stuffing all logic into route handlers. Instead:

- route handlers are fairly thin
- integration code lives in `lib/luma.ts` and `lib/cipherpay.ts`
- state orchestration lives in `lib/app-state/service.ts`
- persistence details live in `lib/app-state/state.ts`

That’s the right direction.

### 2.2 Quality of separation

The best part of the architecture is the split between:

- **transport layer**: Next.js route handlers
- **domain workflow layer**: `service.ts`
- **data access/state layer**: `state.ts`
- **external providers**: `luma.ts`, `cipherpay.ts`

This makes the code easier to reason about and easier to test later, even though tests do not exist yet.

### 2.3 Architectural fit for the problem

For this problem size, the architecture is appropriate. It does **not** need microservices, queues everywhere, or a heavyweight workflow engine yet. A server-rendered Next.js app with API routes and DynamoDB is a sensible shape.

That said, the architecture is currently optimized for **simplicity**, not **operational resilience**. That is fine for an early product, but it shows up in a few places:

- registration after payment is done inline in webhook processing
- there is no retry/queue layer for failed downstream registration work
- observability is mostly application-state based rather than proper ops telemetry

So: architecturally good for v1, but still soft around failure handling.

---

## 3. Code Organization

## 3.1 Strong points

The code organization is one of the repo’s better traits.

### `lib/app-state/`
This is the center of gravity:

- `types.ts` defines the major data shapes
- `utils.ts` handles normalization/parsing helpers
- `dynamodb.ts` centralizes client creation and table naming
- `state.ts` performs persistence work
- `service.ts` handles cross-system workflows

That’s a good internal API boundary. It makes the rest of the app feel less tangled.

### API route shape
The route handlers under `app/api` are mostly short and legible. Example pattern:
- parse request
- perform minimal validation
- call domain/service logic
- return JSON

This is the correct amount of responsibility for handlers.

### UI separation
The UI components are not doing too much domain work. `EventCheckoutForm.tsx` and `CheckoutStatusCard.tsx` carry presentation and some client state, but the more consequential business logic stays in `lib/`.

## 3.2 Weak points

A few organization issues stood out:

- Some naming is a little broad or generic (`state.ts`, `service.ts`, `utils.ts`). It works at this scale, but those files could become junk drawers as the app grows.
- `lib/luma.ts` currently loads all events and filters client-side in `getLumaEventById()`. That is acceptable now, but it’s a mild design smell if event volume grows.
- Operational and security concepts are spread across route handlers and helper modules rather than having dedicated policy modules. Not a problem yet, but worth watching.

Bottom line: the organization is good now, but future growth will need sharper module boundaries inside `lib/app-state/` and possibly dedicated policy/ops modules.

---

## 4. Major Components and Responsibilities

## 4.1 Runtime configuration and environment behavior

`lib/runtime-env.ts` and config normalization in `state.ts` are doing useful work.

Notable good decision:
- in production, secret values are treated as externally managed unless `ALLOW_RUNTIME_SECRET_STORAGE=true`

That is one of the strongest judgment calls in the repo. It prevents the admin/config surface from quietly becoming the system of record for third-party secrets in production.

This is thoughtful and materially reduces risk.

## 4.2 Admin auth

Admin auth is intentionally simple:
- shared password
- scrypt password hash
- HMAC-signed session token
- cookie-based session

This is okay for a small operational tool, but it is clearly a compromise rather than an ideal design.

What’s good:
- password hashing is sane
- token signing is straightforward and understandable
- cookie flags are mostly reasonable (`httpOnly`, `sameSite=lax`, `secure` in production)

What’s weak:
- one shared password means no per-user accountability
- no obvious login throttling on `/api/admin/login`
- no richer auth model for operations with real financial consequences

This is acceptable for controlled internal use, but weak for anything broader.

## 4.3 Session viewer protection

The signed session viewer token model is a smart lightweight pattern.

It protects the checkout session status endpoint from simple session-id guessing while avoiding a heavier auth scheme for end users. That’s a nice fit for the use case.

I like this part of the design.

## 4.4 Checkout/session lifecycle

The checkout flow in `createCheckoutSession()` is one of the stronger areas in the repo.

Good choices:
- validates integration setup before proceeding
- fetches event/ticket data from Luma at creation time
- reuses existing active sessions instead of blindly minting duplicates
- stores the key invoice/session details needed for later reconciliation

The idempotent-reuse behavior is especially good. It shows practical understanding of payment/session UX.

## 4.5 Webhook handling

Webhook processing is clear and readable:
- raw body read for verification
- signature checked with timestamp tolerance
- event logged
- session updated
- Luma registration triggered on accepted states

This is the right broad shape.

The weakness is not conceptual design. The weakness is **operational failure handling**. If Luma registration fails or transient downstream issues happen, the system records failure in-session, but there’s no durable retry pipeline or recovery worker.

That matters because payment systems are where “close enough” stops being good enough.

---

## 5. Design Patterns and Engineering Style

I would describe the engineering style as **modular procedural TypeScript**, not pattern-heavy architecture.

That’s a compliment.

The existing local-model report over-labeled some classic patterns. My take:

### Real patterns I’d confidently claim
- **Repository-ish data access layer** in `lib/app-state/state.ts`
- **Service/orchestration layer** in `lib/app-state/service.ts`
- **Adapter/integration modules** for Luma and CipherPay
- **Normalization/anti-corruption helpers** in `utils.ts`

### Patterns I would *not* emphasize much
- Singleton
- Factory
- Strategy
- Observer

Those labels are technically arguable in places, but they are not the essence of the codebase. The real story is cleaner than that: the code uses straightforward modular boundaries and helper functions without overengineering.

That is a positive.

---

## 6. Strengths

## 6.1 The repo is unusually readable

For an app integrating multiple third-party systems, it is fairly easy to follow. The path from checkout creation to invoice generation to webhook processing to registration is understandable.

That lowers maintenance cost.

## 6.2 Scope discipline

The code does not try to solve ten adjacent problems at once. It is focused on one core job: bridge event registration and Zcash payment. That focus improves the architecture.

## 6.3 Sensible security instincts in some places

A few decisions suggest good judgment:
- HMAC-signed session and viewer tokens
- production secret handling bias toward external secret management
- webhook timestamp tolerance
- masking secret previews in config views
- rate limiting on checkout creation

This isn’t a “security-complete” app, but it is not careless either.

## 6.4 DynamoDB usage is pragmatic

The single-table-ish keying scheme is workable for this application. The lookup records for attendee/session recovery are practical and aligned with the real query patterns.

This is not “beautiful DynamoDB theory,” but it is useful DynamoDB design.

## 6.5 UX consideration is visible

The app cares about real user flow:
- reused invoices reduce duplicate confusion
- polling on checkout status is aligned with the user journey
- QR/deep-link flow is appropriate for mobile wallet interaction
- admin/dashboard surfaces make the system operable by humans

That matters.

---

## 7. Weaknesses and Risks

## 7.1 No automated tests is the biggest problem

I did not see any test suite, test scripts, or test configuration in `package.json` or repo structure.

For a payment + webhook + registration system, this is the biggest maturity gap.

The most exposed areas are:
- webhook verification and parsing
- session state transitions
- idempotent checkout reuse behavior
- auth/session logic
- integration error handling

Without tests, every change risks subtle breakage in flows that only show up under realistic sequences.

## 7.2 Admin auth is serviceable, not strong

The shared-password model is a weak spot if the app is used by more than a tiny trusted operator set.

Concrete issues:
- no individual accountability
- no obvious brute-force throttling on login endpoint
- no MFA, no role separation, no event audit trail tied to users

This may be acceptable for internal/private use. It is not something I would call robust.

## 7.3 Webhook and downstream processing need a more resilient model

Current webhook handling is straightforward, but fragile under operational stress.

Main issue:
- successful payment can still leave registration in a failed or pending state with no durable retry mechanism beyond manual or ad hoc recovery

That means the system can land in an awkward middle zone:
- money side accepted
- event-registration side incomplete

That’s exactly the class of issue that tends to become operator pain.

## 7.4 Observability is thin

I did not see evidence of:
- structured logging
- centralized error tracking
- explicit health endpoints
- metrics/alarm strategy
- correlation IDs across request → webhook → registration flow

There is application-state visibility, which is useful, but that is not the same as operational observability.

The dashboard helps operators *inspect state*. It does not really help them *debug incidents* or *detect failures early*.

## 7.5 Some security questions remain open

A few things I would want verified or improved:

- Admin login throttling appears absent
- CSRF protection is not obvious on state-changing routes
- webhook signature comparison uses plain string equality, not constant-time compare
- input validation is fairly light and mostly manual
- there is no formal security policy/documentation

Important nuance: not all of these are proven vulnerabilities from repo inspection alone. But they are real review points and should be checked deliberately.

## 7.6 External API dependence is tightly coupled to request flow

The app relies heavily on Luma and CipherPay being available in the moment. That’s normal, but there’s little visible resilience layer around those calls.

Potential issues:
- no retry/circuit-breaker story
- limited graceful degradation
- no explicit queue boundary between payment detection and registration work

Again: okay for an early system, weak for a hardened one.

---

## 8. Developer Experience

## 8.1 Good DX choices

The local development story is pretty decent:
- `.env.local.template` exists
- DynamoDB Local via `docker-compose.yml`
- table bootstrap script exists
- password-hash generation script exists
- README is actually helpful and not just filler

This is better than average for a repo of this size.

## 8.2 DX gaps

Still missing or thin:
- no test workflow because there are no tests
- no CI pipeline beyond Amplify build config
- no clear contributor workflow docs
- no local webhook testing walkthrough in enough operational detail
- no pre-commit or automated formatting/lint enforcement hooks

The app is easy enough to boot, but not yet strongly shaped for team-scale maintenance.

---

## 9. Build / Deploy / Operations

## 9.1 Build setup

`amplify.yml` is straightforward and sane:
- pins Node 22
- installs deps reproducibly when lockfile exists
- injects env vars into `.env.production`
- builds Next.js app

No drama here. It’s a practical deployment file.

## 9.2 What’s missing operationally

What I would still want before calling this production-ready for meaningful use:
- CI checks for lint + typecheck + tests
- rollback/runbook documentation
- monitoring/alerting
- security scanning or dependency review process
- explicit incident procedure for failed webhooks and failed registrations

The repo is deployable. That is not the same as operationally mature.

---

## 10. Documentation Quality

The README is actually solid. It explains:
- what the app is
- its environments
- core routes
- runtime config behavior
- local setup
- operational auth basics

That’s a good baseline.

Where docs are missing:
- architecture overview as a dedicated doc
- operational runbook
- testing strategy/process
- security policy and threat notes
- failure recovery procedures

The most important missing docs are operational, not marketing docs.

If this app is going to process money and event registrations, the docs should help someone answer:
- What breaks?
- How do I know?
- What do I do next?

Right now, the repo only partially answers that.

---

## 11. Priority Recommendations

## P0 — Do these first

1. **Add automated tests**
   - Start with unit tests around normalization, auth token validation, webhook signature verification, and session transition logic.
   - Then add integration-style tests around checkout creation and webhook processing.

2. **Harden admin authentication**
   - Add rate limiting to `/api/admin/login`.
   - Add audit logging for admin actions at minimum.

3. **Improve webhook/downstream resilience**
   - Introduce a retryable background mechanism for failed Luma registration after accepted payment.
   - At minimum, create a clear replay/recovery path.

4. **Add structured logging and error tracking**
   - This app needs better operational visibility before it handles real stakes confidently.

## P1 — Next wave

5. **Document operational recovery**
   - Create `OPERATIONS.md` or `RUNBOOK.md`.
   - Include webhook failure, Luma registration failure, and secret rotation procedures.

6. **Audit CSRF and route protection assumptions**
   - Especially around admin/config mutations and login/logout flows.

7. **Add CI quality gates**
   - At minimum: lint, typecheck, and tests.

8. **Introduce explicit health/diagnostic endpoint(s)**
   - Even a small `/health` and maybe `/ready` story would help.

## P2 — Later improvements

9. **Move beyond shared-password auth** if operator count or stakes increase
10. **Add more deliberate external-failure handling** (retry/backoff/circuit breaking)
11. **Split large app-state modules** if the domain grows much further
12. **Add architecture/security docs** for future maintainers

---

## 12. Final Verdict

LumaZcash is a **good small system**, not a sloppy one. The design is more coherent than many apps in this category, and the repo shows decent judgment in separation of concerns, runtime config handling, checkout idempotency, and pragmatic DynamoDB usage.

But the current version still feels like an **early serious prototype** rather than a fully hardened production system. The biggest gap is not architecture elegance. It is **operational confidence**.

If I had to summarize it in one line:

> The core design is credible; the missing layer is assurance.

In practical terms, that means:
- keep the architecture
- add tests
- harden admin/auth and webhook recovery
- improve observability and runbooks
- then reassess readiness for higher-stakes deployment

---

## Appendix: Quick comparison to the earlier local-model report

The earlier report was broadly useful, but I would adjust it this way:

- **Agree strongly:** testing gap, ops gap, observability gap, admin auth weakness
- **Agree moderately:** documentation deficiencies, production-hardening needs
- **More skeptical than that report:** over-claiming classic design patterns, and stating some security findings too confidently without deeper validation

So my version is a bit narrower and more conservative: fewer pattern labels, more focus on operational reality.
