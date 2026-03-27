# Homepage Copy Reference

Original marketing copy from the first version of the homepage.
Kept here for reference — some of this may be useful for docs, FAQ, or onboarding flows.

---

## Hero (original)

> One home for Zcash ticketing, with two paths live today.

> ZecTix gives organizers one place to choose between direct CipherPay ticketing and a managed Luma + CipherPay integration. Both keep Zcash settlement front and center, and both are being introduced through an initial no-cost beta for early organizers who want to test private Zcash payments in real event flows.

## CipherPay-only path (original)

### Organizer flow
1. Create the event and ticket tiers in CipherPay.
   CipherPay's event tooling can define ticket names, pricing, capacities, and the checkout link that buyers will use.
2. Share a hosted Zcash checkout page.
   The buyer lands on a purpose-built payment page with QR code, wallet URI, and invoice state handled by CipherPay.
3. Track detection, webhooks, and check-in from the same product.
   CipherPay handles fast payment detection, confirmation updates, webhook delivery, and event-side follow-up tools.

### Buyer flow
1. Open the event checkout and choose the ticket.
   The direct CipherPay path keeps the buyer on a native Zcash payment flow rather than routing through another event platform first.
2. Pay from a Zcash wallet using shielded checkout.
   The hosted page presents the QR code and URI, and CipherPay watches the mempool and chain for the payment.
3. See payment state update quickly.
   CipherPay documents fast mempool detection, later confirmation, and webhook or dashboard updates for the merchant side.

## Luma + CipherPay path (original)

### Why keep Luma
- Event publishing and pages stay in Luma.
  Organizers still create events, manage descriptions, and keep the canonical event page in the product their community already knows.
- Guest records, approvals, reminders, and check-in stay put.
  The managed path is designed for teams that want Zcash without giving up Luma's attendee workflows or event-day tooling.
- ZecTix only layers in the Zcash checkout surface.
  The public ticketing surface, sync rules, and registration handoff are managed so the organizer does not need to build the glue themselves.

### Managed flow
1. Connect Luma and CipherPay.
   You keep both accounts under your control, and ZecTix connects them for the beta without replacing your existing event workflow.
2. Mirror only the events and tickets that qualify.
   Supported inventory is synced from Luma into a public Zcash-ready surface so only the right tickets are offered through this path.
3. Attach the attendee back into Luma after payment.
   CipherPay handles invoice creation and payment state, and ZecTix moves the attendee back into Luma so your normal operations stay intact.

## How to think about the split (original)

- Use direct CipherPay when you want a Zcash-native ticketing surface with hosted checkout and no extra event-platform layer in the way.
- Use managed Luma + CipherPay when the organizer already runs event operations in Luma and wants Zcash to sit beside that existing workflow.
- Join through the early beta, then choose the path that best matches your event stack and operational needs.

## Why ZecTix (original)

- **Start with the path that fits your event stack.** Some organizers want direct Zcash-native ticketing right away, while others want to add Zcash without moving off Luma. This beta supports both.
- **Private payments, organizer-owned settlement.** Both options keep Zcash checkout and organizer-controlled CipherPay settlement at the center of the buyer experience.
- **Initial no-cost trial for early partners.** ZecTix is opening as an early beta with an initial no-cost trial so organizers can test the fit before the product expands further.

## CipherPay-only spotlight (original)

> Direct Zcash ticketing through the CipherPay dashboard.

> CipherPay has its own event and ticketing flow, so an organizer can create ticket tiers, generate checkout links, accept shielded Zcash, and manage the event from the CipherPay side without routing the event through Luma.

### Why choose this path
> Use direct CipherPay when privacy-forward Zcash checkout is the product, and you do not need Luma's event-management layer in the middle. It is the cleanest way to start testing Zcash-only ticket sales during the beta.
