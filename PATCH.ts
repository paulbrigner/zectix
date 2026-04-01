 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/app/dashboard/actions.ts b/app/dashboard/actions.ts
index b38f1a20a56e027da6092846ffc3709555f7abab..e99b2c6be6eea47e3b4820c0ef67a7c98c4d1911 100644
--- a/app/dashboard/actions.ts
+++ b/app/dashboard/actions.ts
@@ -913,53 +913,50 @@ export async function setTicketAssertionsAction(formData: FormData) {
   const tenantSlug = String(formData.get("tenant_slug") || "");
   const { detail: beforeDetail, sessionEmail, tenant } =
     await requireTenantMutationContext(tenantSlug);
   const calendarConnectionId = String(formData.get("calendar_connection_id") || "");
   await requireCalendarTenantAccess(tenant.tenant_id, calendarConnectionId);
   const wasComplete = onboardingChecklistComplete(beforeDetail);
   const eventApiId = String(formData.get("event_api_id") || "");
   const ticketTypeApiId = String(formData.get("ticket_type_api_id") || "");
   const publicCheckoutRequested =
     formData.get("public_checkout_requested_present") != null
       ? asBoolean(formData.get("public_checkout_requested"))
       : undefined;
   await runAuditedTenantDashboardMutation({
     action: "set_ticket_assertions",
     beforeDetail,
     context: {
       calendar_connection_id: calendarConnectionId,
       event_api_id: eventApiId,
       public_checkout_requested: publicCheckoutRequested,
       ticket_type_api_id: ticketTypeApiId,
     },
     mutation: () =>
       setTicketOperatorAssertions({
         event_api_id: eventApiId,
         ticket_type_api_id: ticketTypeApiId,
-        confirmed_fixed_price: true,
-        confirmed_no_approval_required: true,
-        confirmed_no_extra_required_questions: true,
         public_checkout_requested: publicCheckoutRequested,
       }),
     sessionEmail,
     tenantId: tenant.tenant_id,
     tenantSlug: tenant.slug,
   });
   await redirectAfterTenantMutation(formData, {
     eventApiId,
     fallback: `/dashboard/${encodeURIComponent(tenant.slug)}/events`,
     sessionEmail,
     tenantSlug: tenant.slug,
     wasComplete,
   });
 }
 
 export async function setEventPublicCheckoutAction(formData: FormData) {
   const tenantSlug = String(formData.get("tenant_slug") || "");
   const { detail: beforeDetail, sessionEmail, tenant } =
     await requireTenantMutationContext(tenantSlug);
   const calendarConnectionId = String(formData.get("calendar_connection_id") || "");
   await requireCalendarTenantAccess(tenant.tenant_id, calendarConnectionId);
   const wasComplete = onboardingChecklistComplete(beforeDetail);
   const eventApiId = String(formData.get("event_api_id") || "");
   const publicCheckoutRequested = asBoolean(formData.get("public_checkout_requested"));
   await runAuditedTenantDashboardMutation({
diff --git a/app/ops/(protected)/tenants/[tenantId]/events/page.tsx b/app/ops/(protected)/tenants/[tenantId]/events/page.tsx
index 96dedd141d7864c972e6ee81ee089cf17b58b863..68fc711f1d5582fb8481dcb02813e288d60fd063 100644
--- a/app/ops/(protected)/tenants/[tenantId]/events/page.tsx
+++ b/app/ops/(protected)/tenants/[tenantId]/events/page.tsx
@@ -814,90 +814,62 @@ export default async function TenantEventsPage({
                               {ticketSummaryLabel(ticket)}
                             </strong>
                           </div>
 
                           <div className="console-mini-pill-row console-ticket-review-pills">
                             <span
                               className={pillClassName(
                                 ticketReviewTone(ticket),
                               )}
                             >
                               {ticketReviewLabel(ticket)}
                             </span>
                           </div>
 
                           <div className="console-ticket-review-summary">
                             <p className="subtle-text">
                               {ticketReviewCopy(ticket)}
                             </p>
                           </div>
                         </div>
 
                         <div className="tenant-ticket-review-checks">
                           <ConsoleSwitch
                             className="tenant-ticket-review-check"
                             defaultChecked={ticket.public_checkout_requested}
-                            description="Turn this off to keep the ticket hidden even if the review assertions are complete."
+                            description="Turn this off to keep the ticket hidden from public checkout."
                             label="Allow this ticket on public checkout"
                             name="public_checkout_requested"
                           />
-                          <label className="console-checkbox tenant-ticket-review-check">
-                            <input
-                              defaultChecked={ticket.confirmed_fixed_price}
-                              name="confirmed_fixed_price"
-                              type="checkbox"
-                            />
-                            <span>Confirm fixed price</span>
-                          </label>
-                          <label className="console-checkbox tenant-ticket-review-check">
-                            <input
-                              defaultChecked={
-                                ticket.confirmed_no_approval_required
-                              }
-                              name="confirmed_no_approval_required"
-                              type="checkbox"
-                            />
-                            <span>No approval required</span>
-                          </label>
-                          <label className="console-checkbox tenant-ticket-review-check">
-                            <input
-                              defaultChecked={
-                                ticket.confirmed_no_extra_required_questions
-                              }
-                              name="confirmed_no_extra_required_questions"
-                              type="checkbox"
-                            />
-                            <span>No extra required questions</span>
-                          </label>
                         </div>
 
                         <div className="console-ticket-review-actions">
                           <button
                             className="button button-secondary button-small"
                             type="submit"
                           >
-                            Save assertions
+                            Save ticket settings
                           </button>
                         </div>
                       </form>
                     ))}
                   </div>
                 </article>
               );
             })}
           </section>
         ),
       )}
     </section>
   );
 }
 
 function ticketSummaryLabel(ticket: {
   amount: number | null;
   currency: string | null;
 }) {
   if (ticket.amount == null || !ticket.currency) {
     return "Price from Luma";
   }
 
   return `${ticket.currency.toUpperCase()} ${ticket.amount.toFixed(2)}`;
 }
diff --git a/app/ops/actions.ts b/app/ops/actions.ts
index d92814dd9d5c43fb4ebfb637f53934bd56c61faa..9e835f1fbcada61160f89d427a6b3c7ff504df86 100644
--- a/app/ops/actions.ts
+++ b/app/ops/actions.ts
@@ -244,57 +244,50 @@ export async function createCipherPayConnectionAction(formData: FormData) {
       formData.get("network") === "mainnet" ? "mainnet" : "testnet",
     api_base_url: asString(formData.get("api_base_url")),
     checkout_base_url: asString(formData.get("checkout_base_url")),
     cipherpay_api_key: String(formData.get("cipherpay_api_key") || ""),
     cipherpay_webhook_secret: String(
       formData.get("cipherpay_webhook_secret") || "",
     ),
   });
 
   redirectTo(formData, `/ops/tenants/${encodeURIComponent(connection.tenant_id)}`);
 }
 
 export async function validateCipherPayConnectionAction(formData: FormData) {
   await requireOpsPageAccess();
   const connection = await validateCipherPayConnection(
     String(formData.get("cipherpay_connection_id") || ""),
   );
   redirectTo(formData, `/ops/tenants/${encodeURIComponent(connection.tenant_id)}`);
 }
 
 export async function setTicketAssertionsAction(formData: FormData) {
   await requireOpsPageAccess();
   await setTicketOperatorAssertions({
     event_api_id: String(formData.get("event_api_id") || ""),
     ticket_type_api_id: String(formData.get("ticket_type_api_id") || ""),
-    confirmed_fixed_price: asBoolean(formData.get("confirmed_fixed_price")),
-    confirmed_no_approval_required: asBoolean(
-      formData.get("confirmed_no_approval_required"),
-    ),
-    confirmed_no_extra_required_questions: asBoolean(
-      formData.get("confirmed_no_extra_required_questions"),
-    ),
     public_checkout_requested:
       formData.get("public_checkout_requested_present") != null
         ? asBoolean(formData.get("public_checkout_requested"))
         : undefined,
   });
   redirectTo(formData, "/ops/tenants");
 }
 
 export async function setEventPublicCheckoutAction(formData: FormData) {
   await requireOpsPageAccess();
   await setEventPublicCheckoutRequested({
     calendar_connection_id: String(formData.get("calendar_connection_id") || ""),
     event_api_id: String(formData.get("event_api_id") || ""),
     public_checkout_requested: asBoolean(formData.get("public_checkout_requested")),
   });
   redirectTo(formData, "/ops/tenants");
 }
 
 export async function retryRegistrationAction(formData: FormData) {
   await requireOpsPageAccess();
   await retryRegistrationForSession(String(formData.get("session_id") || ""));
   redirectTo(formData, "/ops");
 }
 
 export async function processDueTasksAction(formData: FormData) {
diff --git a/lib/app-state/state.ts b/lib/app-state/state.ts
index 59c5e5b9b46c28c67a83bfb067c14b33174fe814..a3db6a7b5164bef8a7a0ab123155cc902f066ae7 100644
--- a/lib/app-state/state.ts
+++ b/lib/app-state/state.ts
@@ -551,55 +551,50 @@ function normalizeTicketMirror(value: unknown): TicketMirror | null {
     !calendarConnectionId ||
     !eventApiId ||
     !ticketTypeApiId ||
     !name ||
     !createdAt ||
     !updatedAt
   ) {
     return null;
   }
 
   return {
     ticket_mirror_id: asString(item?.ticket_mirror_id) || `${eventApiId}:${ticketTypeApiId}`,
     tenant_id: tenantId,
     calendar_connection_id: calendarConnectionId,
     event_api_id: eventApiId,
     ticket_type_api_id: ticketTypeApiId,
     name,
     currency: asString(item?.currency),
     amount: asFiniteNumber(item?.amount),
     description: asString(item?.description),
     active: asBoolean(item?.active, true),
     price_source: item?.price_source === "fallback" ? "fallback" : "amount",
     public_checkout_requested: asBoolean(item?.public_checkout_requested, false),
     zcash_enabled: asBoolean(item?.zcash_enabled),
     zcash_enabled_reason: asString(item?.zcash_enabled_reason),
-    confirmed_fixed_price: asBoolean(item?.confirmed_fixed_price),
-    confirmed_no_approval_required: asBoolean(item?.confirmed_no_approval_required),
-    confirmed_no_extra_required_questions: asBoolean(
-      item?.confirmed_no_extra_required_questions,
-    ),
     automatic_eligibility_status:
       item?.automatic_eligibility_status === "eligible" ? "eligible" : "ineligible",
     automatic_eligibility_reasons: Array.isArray(item?.automatic_eligibility_reasons)
       ? item.automatic_eligibility_reasons
           .map((entry) => asString(entry))
           .filter(Boolean) as string[]
       : [],
     created_at: createdAt,
     updated_at: updatedAt,
   };
 }
 
 function normalizeCheckoutSession(value: unknown): CheckoutSession | null {
   const item = asRecord(value);
   const sessionId = asString(item?.session_id) || asString(item?.sk);
   const tenantId = asString(item?.tenant_id);
   const calendarConnectionId = asString(item?.calendar_connection_id);
   const cipherpayConnectionId = asString(item?.cipherpay_connection_id);
   const publicCalendarSlug = asString(item?.public_calendar_slug);
   const eventApiId = asString(item?.event_api_id);
   const eventName = asString(item?.event_name);
   const ticketTypeApiId = asString(item?.ticket_type_api_id);
   const ticketTypeName = asString(item?.ticket_type_name);
   const attendeeName = asString(item?.attendee_name);
   const attendeeEmail = asString(item?.attendee_email);
diff --git a/lib/app-state/types.ts b/lib/app-state/types.ts
index 5fc883e97d2f2507b10a49d974f7518ef5484c0d..a5604f85e62ce1710a6dee929b91d1657d1529a2 100644
--- a/lib/app-state/types.ts
+++ b/lib/app-state/types.ts
@@ -134,53 +134,50 @@ export type EventMirror = {
   sync_status: EventMirrorStatus;
   public_checkout_requested: boolean;
   zcash_enabled: boolean;
   zcash_enabled_reason: string | null;
   last_synced_at: string | null;
   last_sync_hash: string | null;
   created_at: string;
   updated_at: string;
 };
 
 export type TicketMirror = {
   ticket_mirror_id: string;
   tenant_id: string;
   calendar_connection_id: string;
   event_api_id: string;
   ticket_type_api_id: string;
   name: string;
   currency: string | null;
   amount: number | null;
   description: string | null;
   active: boolean;
   price_source: "amount" | "fallback";
   public_checkout_requested: boolean;
   zcash_enabled: boolean;
   zcash_enabled_reason: string | null;
-  confirmed_fixed_price: boolean;
-  confirmed_no_approval_required: boolean;
-  confirmed_no_extra_required_questions: boolean;
   automatic_eligibility_status: "eligible" | "ineligible";
   automatic_eligibility_reasons: string[];
   created_at: string;
   updated_at: string;
 };
 
 export type CheckoutSession = {
   session_id: string;
   tenant_id: string;
   calendar_connection_id: string;
   cipherpay_connection_id: string;
   public_calendar_slug: string;
   network: CipherPayNetwork;
   event_api_id: string;
   event_name: string;
   ticket_type_api_id: string;
   ticket_type_name: string;
   attendee_name: string;
   attendee_email: string;
   amount: number;
   currency: string;
   pricing_source: "mirror";
   pricing_snapshot_json: Record<string, unknown>;
   service_fee_bps_snapshot: number;
   service_fee_zatoshis_snapshot: number;
diff --git a/lib/eligibility/ticket-eligibility.ts b/lib/eligibility/ticket-eligibility.ts
index a8a8d55008a44c5adb5a8f85f94ddf5274f075a5..3d262f0ec547bd08755f82c4cd8541e903a2996f 100644
--- a/lib/eligibility/ticket-eligibility.ts
+++ b/lib/eligibility/ticket-eligibility.ts
@@ -1,71 +1,49 @@
 import { supportedTicketCurrencies } from "@/lib/app-state/utils";
 import type { TicketMirror } from "@/lib/app-state/types";
 
 type TicketEligibilityInput = Pick<
   TicketMirror,
   | "active"
   | "currency"
   | "amount"
-  | "confirmed_fixed_price"
-  | "confirmed_no_approval_required"
-  | "confirmed_no_extra_required_questions"
   | "public_checkout_requested"
 >;
 
 export type TicketEligibilityResult = {
   automatic_eligibility_status: "eligible" | "ineligible";
   automatic_eligibility_reasons: string[];
   zcash_enabled: boolean;
   zcash_enabled_reason: string;
 };
 
 export function evaluateTicketEligibility(
   ticket: TicketEligibilityInput,
 ): TicketEligibilityResult {
   const automaticReasons: string[] = [];
   if (!ticket.active) {
     automaticReasons.push("Ticket is not active in Luma.");
   }
 
   if (ticket.amount == null || ticket.amount <= 0) {
     automaticReasons.push("Ticket does not expose a fixed positive price.");
   }
 
   if (!ticket.currency || !supportedTicketCurrencies().has(ticket.currency.toUpperCase())) {
     automaticReasons.push("Ticket currency is not supported for v1 checkout.");
   }
 
   const automaticEligible = automaticReasons.length === 0;
-  const operatorEligible =
-    ticket.confirmed_fixed_price &&
-    ticket.confirmed_no_approval_required &&
-    ticket.confirmed_no_extra_required_questions;
-
-  if (!ticket.confirmed_fixed_price) {
-    automaticReasons.push("Operator has not confirmed the ticket is fixed-price.");
-  }
-
-  if (!ticket.confirmed_no_approval_required) {
-    automaticReasons.push("Operator has not confirmed the ticket bypasses approval.");
-  }
-
-  if (!ticket.confirmed_no_extra_required_questions) {
-    automaticReasons.push(
-      "Operator has not confirmed the registration flow avoids extra required questions.",
-    );
-  }
-
-  const zcashEnabled = automaticEligible && operatorEligible;
+  const zcashEnabled = automaticEligible;
   const requestedForPublicCheckout = ticket.public_checkout_requested;
 
   return {
     automatic_eligibility_status: automaticEligible ? "eligible" : "ineligible",
     automatic_eligibility_reasons: automaticReasons,
     zcash_enabled: requestedForPublicCheckout && zcashEnabled,
     zcash_enabled_reason: !requestedForPublicCheckout
       ? "Public checkout is turned off for this ticket."
       : zcashEnabled
         ? "Enabled for public Zcash checkout."
-        : automaticReasons[0] || "Ticket still needs operator confirmation.",
+        : automaticReasons[0] || "Ticket is not eligible for public Zcash checkout.",
   };
 }
diff --git a/lib/sync/luma-sync.ts b/lib/sync/luma-sync.ts
index b0b50ead0c0e35e9ae12306955d54e1a3711bcb4..0beb2a4c2f77f046f890b8c67953d2eed1455bbe 100644
--- a/lib/sync/luma-sync.ts
+++ b/lib/sync/luma-sync.ts
@@ -92,54 +92,50 @@ function baseTicketMirror(
     event_api_id: string;
     ticket_type_api_id: string;
     name: string;
     currency: string | null;
     amount: number | null;
     description: string | null;
     active: boolean;
     price_source: "amount" | "fallback";
   },
 ) {
   const timestamp = nowIso();
   return {
     ticket_mirror_id:
       existing?.ticket_mirror_id || `${input.event_api_id}:${input.ticket_type_api_id}`,
     tenant_id: input.tenant_id,
     calendar_connection_id: input.calendar_connection_id,
     event_api_id: input.event_api_id,
     ticket_type_api_id: input.ticket_type_api_id,
     name: input.name,
     currency: input.currency,
     amount: input.amount,
     description: input.description,
     active: input.active,
     price_source: input.price_source,
     public_checkout_requested: existing?.public_checkout_requested ?? false,
-    confirmed_fixed_price: existing?.confirmed_fixed_price || false,
-    confirmed_no_approval_required: existing?.confirmed_no_approval_required || false,
-    confirmed_no_extra_required_questions:
-      existing?.confirmed_no_extra_required_questions || false,
     zcash_enabled: existing?.zcash_enabled || false,
     zcash_enabled_reason: existing?.zcash_enabled_reason || null,
     automatic_eligibility_status:
       existing?.automatic_eligibility_status || "ineligible",
     automatic_eligibility_reasons: existing?.automatic_eligibility_reasons || [],
     created_at: existing?.created_at || timestamp,
     updated_at: timestamp,
   } satisfies TicketMirror;
 }
 
 async function syncTicketMirrorsForEvent(args: {
   tenant_id: string;
   calendar_connection_id: string;
   event_api_id: string;
   luma_api_key: string;
 }) {
   const existingTickets = await listTicketMirrorsByEvent(args.event_api_id);
   const existingById = new Map(
     existingTickets.map((ticket) => [ticket.ticket_type_api_id, ticket]),
   );
   const seenIds = new Set<string>();
 
   const lumaTickets = await listLumaTicketTypes(args.luma_api_key, args.event_api_id).catch(
     () => [],
   );
diff --git a/lib/tenancy/service.ts b/lib/tenancy/service.ts
index c81cf11697435e6c2fff96b23ab007ae05cf9a7c..f593d277b505d119a29f73c7f7e23a5ddbad4c52 100644
--- a/lib/tenancy/service.ts
+++ b/lib/tenancy/service.ts
@@ -974,53 +974,50 @@ export async function updateCalendarEmbedSettings(input: {
 }) {
   const connection = await getCalendarConnection(input.calendar_connection_id);
   if (!connection) {
     throw new Error(`Calendar connection ${input.calendar_connection_id} was not found.`);
   }
 
   const nextConnection: CalendarConnection = {
     ...connection,
     embed_enabled: input.embed_enabled,
     embed_allowed_origins: normalizeOriginList(input.embed_allowed_origins),
     embed_default_height_px: normalizeEmbedHeight(
       input.embed_default_height_px,
       connection.embed_default_height_px || DEFAULT_EMBED_HEIGHT_PX,
     ),
     embed_show_branding: input.embed_show_branding,
     embed_theme: normalizeCalendarEmbedTheme(input.embed_theme),
     updated_at: nowIso(),
   };
 
   return putCalendarConnection(nextConnection);
 }
 
 export async function setTicketOperatorAssertions(input: {
   event_api_id: string;
   ticket_type_api_id: string;
-  confirmed_fixed_price: boolean;
-  confirmed_no_approval_required: boolean;
-  confirmed_no_extra_required_questions: boolean;
   public_checkout_requested?: boolean;
 }) {
   const ticket = await getTicketMirror(input.event_api_id, input.ticket_type_api_id);
   if (!ticket) {
     throw new Error("Ticket mirror was not found.");
   }
 
   const eligibility = evaluateTicketEligibility({
     ...ticket,
     ...input,
     public_checkout_requested:
       typeof input.public_checkout_requested === "boolean"
         ? input.public_checkout_requested
         : ticket.public_checkout_requested,
   });
   const nextTicket: TicketMirror = {
     ...ticket,
     ...input,
     public_checkout_requested:
       typeof input.public_checkout_requested === "boolean"
         ? input.public_checkout_requested
         : ticket.public_checkout_requested,
     ...eligibility,
     updated_at: nowIso(),
   };
diff --git a/lib/tenant-self-serve.ts b/lib/tenant-self-serve.ts
index badb680f8de369d83efeb524eba6512124e9473d..545e89ee61a5ee15f7f6ccfb4fe00993400f3553 100644
--- a/lib/tenant-self-serve.ts
+++ b/lib/tenant-self-serve.ts
@@ -340,55 +340,51 @@ export function buildWorkspaceOverview(detail: TenantOpsDetail) {
     pendingSessions,
     registeredSessions,
     ticketsNeedingReview,
     trackedSessions,
     upcomingEvents,
   };
 }
 
 export function recentSessionsForDashboard(sessions: CheckoutSession[], limit = 8) {
   return sessions.slice(0, limit);
 }
 
 export function ticketNeedsAttention(ticket: TicketMirror) {
   if (!ticket.public_checkout_requested) {
     return false;
   }
 
   if (ticket.zcash_enabled) {
     return false;
   }
 
   if (ticket.automatic_eligibility_reasons.length > 0) {
     return true;
   }
 
-  return (
-    !ticket.confirmed_fixed_price ||
-    !ticket.confirmed_no_approval_required ||
-    !ticket.confirmed_no_extra_required_questions
-  );
+  return false;
 }
 
 export function upcomingEnabledEvents(events: EventMirror[]) {
   return selectUpcomingEvents(events.filter((event) => event.zcash_enabled));
 }
 
 export function buildTenantEventWorkspaceRows(
   detail: TenantOpsDetail,
   nowMs = Date.now(),
 ): TenantEventWorkspaceRow[] {
   const rows = detail.calendars.flatMap((calendar) => {
     const mirroredEvents = (detail.events.find(
       (entry) => entry.calendar.calendar_connection_id === calendar.calendar_connection_id,
     )?.events || [])
       .filter((event) => isFutureEvent(event.start_at, nowMs))
       .sort((left, right) => new Date(left.start_at).getTime() - new Date(right.start_at).getTime());
     const mirroredIds = new Set(mirroredEvents.map((event) => event.event_api_id));
     const upstreamPreview =
       detail.upstream_luma_events_by_calendar.get(calendar.calendar_connection_id) || null;
     const upstreamEvents = (upstreamPreview?.events || [])
       .filter(
         (event) => isFutureEvent(event.start_at, nowMs) && !mirroredIds.has(event.api_id),
       )
       .sort((left, right) => new Date(left.start_at).getTime() - new Date(right.start_at).getTime());
 
diff --git a/tests/app-state-utils.test.ts b/tests/app-state-utils.test.ts
index 5221fefe371c6dc66472bb58a45f65d9e26d4f21..1cbbd9384099b8c537bff1af83fa23bd4629327f 100644
--- a/tests/app-state-utils.test.ts
+++ b/tests/app-state-utils.test.ts
@@ -40,61 +40,61 @@ describe("app-state utilities", () => {
   it("maps cipherpay status events and local expiry", () => {
     expect(cipherPayStatusFromEvent("invoice.created")).toBe("draft");
     expect(cipherPayStatusFromEvent("invoice.confirmed")).toBe("confirmed");
     expect(cipherPayStatusFromEvent("unknown.event", "pending")).toBe("pending");
 
     const past = "2024-01-01T00:00:00.000Z";
     const future = "2999-01-01T00:00:00.000Z";
     expect(
       applyDerivedCheckoutSessionState(
         makeSession({
           status: "pending",
           cipherpay_expires_at: past,
         }),
       ).status,
     ).toBe("expired");
     expect(
       applyDerivedCheckoutSessionState(
         makeSession({
           status: "pending",
           cipherpay_expires_at: future,
         }),
       ).status,
     ).toBe("pending");
   });
 
-  it("computes service fees and ticket eligibility with operator assertions", () => {
+  it("computes service fees and automatic ticket eligibility", () => {
     expect(calculateServiceFeeZatoshis(zecToZatoshis(25), 450)).toBe(112_500_000);
 
     vi.stubEnv("SUPPORTED_TICKET_CURRENCIES", "USD,EUR");
     expect([...supportedTicketCurrencies()]).toEqual(["USD", "EUR"]);
 
     const eligible = evaluateTicketEligibility(makeTicketMirror());
     expect(eligible.zcash_enabled).toBe(true);
 
     const ineligible = evaluateTicketEligibility(
       makeTicketMirror({
-        confirmed_no_approval_required: false,
+        active: false,
       }),
     );
     expect(ineligible.zcash_enabled).toBe(false);
-    expect(ineligible.automatic_eligibility_reasons.join(" ")).toMatch(/approval/i);
+    expect(ineligible.automatic_eligibility_reasons.join(" ")).toMatch(/not active/i);
   });
 
   it("supports intentional hide overrides for tickets and events", () => {
     const hiddenTicket = evaluateTicketEligibility(
       makeTicketMirror({
         public_checkout_requested: false,
       }),
     );
     expect(hiddenTicket.zcash_enabled).toBe(false);
     expect(hiddenTicket.zcash_enabled_reason).toMatch(/turned off/i);
 
     const hiddenEvent = evaluateEventCheckoutState({
       enabled_ticket_count: 0,
       requested_ticket_count: 0,
       sync_status: "active",
     });
     expect(hiddenEvent.zcash_enabled).toBe(false);
     expect(hiddenEvent.zcash_enabled_reason).toMatch(/at least one ticket/i);
   });
 });
diff --git a/tests/tenancy-service.test.ts b/tests/tenancy-service.test.ts
index 306b81486880d24fbf822482f1a65e4f02c5b84b..7da930796bf859efcd31185ae99f6755f1a046e9 100644
--- a/tests/tenancy-service.test.ts
+++ b/tests/tenancy-service.test.ts
@@ -1108,75 +1108,68 @@ describe("setEventPublicCheckoutRequested", () => {
     mockListTicketMirrorsByEvent.mockResolvedValue(tickets);
 
     await setEventPublicCheckoutRequested({
       calendar_connection_id: event.calendar_connection_id,
       event_api_id: event.event_api_id,
       public_checkout_requested: false,
     });
 
     expect(mockPutEventMirror).toHaveBeenCalledWith(
       expect.objectContaining({
         event_api_id: event.event_api_id,
         public_checkout_requested: true,
         zcash_enabled: true,
         zcash_enabled_reason: "At least one ticket is enabled for Zcash checkout.",
       }),
     );
   });
 });
 
 describe("setTicketOperatorAssertions", () => {
   it("keeps a ticket hidden when public checkout is turned off", async () => {
     const ticket = makeTicketMirror({
       event_api_id: "event_123",
       ticket_type_api_id: "ticket_123",
       public_checkout_requested: true,
-      confirmed_fixed_price: false,
       zcash_enabled: false,
     });
     const event = makeEventMirror({
       calendar_connection_id: ticket.calendar_connection_id,
       event_api_id: ticket.event_api_id,
       public_checkout_requested: true,
       zcash_enabled: true,
     });
     const nextTicket = {
       ...ticket,
       public_checkout_requested: false,
-      confirmed_fixed_price: true,
-      confirmed_no_approval_required: true,
-      confirmed_no_extra_required_questions: true,
       zcash_enabled: false,
       zcash_enabled_reason: "Public checkout is turned off for this ticket.",
     };
 
     mockGetTicketMirror.mockResolvedValue(ticket);
     mockGetEventMirror.mockResolvedValue(event);
     mockListTicketMirrorsByEvent.mockResolvedValue([nextTicket]);
 
     await setTicketOperatorAssertions({
       event_api_id: ticket.event_api_id,
       ticket_type_api_id: ticket.ticket_type_api_id,
-      confirmed_fixed_price: true,
-      confirmed_no_approval_required: true,
-      confirmed_no_extra_required_questions: true,
       public_checkout_requested: false,
     });
 
     expect(mockPutTicketMirror).toHaveBeenCalledWith(
       expect.objectContaining({
         ticket_type_api_id: ticket.ticket_type_api_id,
         public_checkout_requested: false,
         zcash_enabled: false,
         zcash_enabled_reason: "Public checkout is turned off for this ticket.",
       }),
     );
     expect(mockPutEventMirror).toHaveBeenCalledWith(
       expect.objectContaining({
         event_api_id: event.event_api_id,
         public_checkout_requested: false,
         zcash_enabled: false,
         zcash_enabled_reason: "Turn on public checkout for at least one ticket.",
       }),
     );
   });
 });
diff --git a/tests/test-helpers.ts b/tests/test-helpers.ts
index 563b957729d6852b35bed1918f558d4dce3967d7..5657261392d570b11cef204729d3691c040c3073 100644
--- a/tests/test-helpers.ts
+++ b/tests/test-helpers.ts
@@ -112,53 +112,50 @@ export function makeEventMirror(overrides: Partial<EventMirror> = {}): EventMirr
     zcash_enabled_reason: "At least one ticket is enabled for Zcash checkout.",
     last_synced_at: "2026-03-24T12:00:00.000Z",
     last_sync_hash: "hash",
     created_at: "2026-03-24T12:00:00.000Z",
     updated_at: "2026-03-24T12:00:00.000Z",
     ...overrides,
   };
 }
 
 export function makeTicketMirror(overrides: Partial<TicketMirror> = {}): TicketMirror {
   return {
     ticket_mirror_id: "ticket_mirror_123",
     tenant_id: "tenant_123",
     calendar_connection_id: "calendar_123",
     event_api_id: "event_123",
     ticket_type_api_id: "ticket_123",
     name: "General Admission",
     currency: "USD",
     amount: 25,
     description: "One attendee",
     active: true,
     price_source: "amount",
     public_checkout_requested: true,
     zcash_enabled: true,
     zcash_enabled_reason: "Enabled for managed Zcash checkout.",
-    confirmed_fixed_price: true,
-    confirmed_no_approval_required: true,
-    confirmed_no_extra_required_questions: true,
     automatic_eligibility_status: "eligible",
     automatic_eligibility_reasons: [],
     created_at: "2026-03-24T12:00:00.000Z",
     updated_at: "2026-03-24T12:00:00.000Z",
     ...overrides,
   };
 }
 
 export function makeCheckoutSession(
   overrides: Partial<CheckoutSession> = {},
 ): CheckoutSession {
   return {
     session_id: "session_123",
     tenant_id: "tenant_123",
     calendar_connection_id: "calendar_123",
     cipherpay_connection_id: "cp_123",
     public_calendar_slug: "demo-calendar",
     network: "mainnet",
     event_api_id: "event_123",
     event_name: "ZecTix Launch Party",
     ticket_type_api_id: "ticket_123",
     ticket_type_name: "General Admission",
     attendee_name: "Jordan Lee",
     attendee_email: "jordan@example.com",
     amount: 25,
 
EOF
)