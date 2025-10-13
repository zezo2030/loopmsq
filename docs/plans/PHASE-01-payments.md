## Phase 01 — Payments Integration

### Goal
Enable online and offline payments for bookings with gateway integration, webhooks, reconciliation, and refunds.

### Scope
In scope:
- Payment intent/create, capture/confirm, webhook handling.
- Methods: credit/debit card; placeholders for Apple Pay/STC Pay via gateway.
- Cash and wallet as non-gateway methods.
- Refunds (full/partial) and status transitions.

Out of scope:
- Complex pricing rules (covered elsewhere).
- Invoices/PDF generation (optional stretch).

### Data Model
- `payments` table already exists. Add as needed:
  - Indexes: (`bookingId`, `status`), (`transactionId`), (`paidAt`).
  - Optional columns: `customerId`, `refundReason`.
- Ensure `bookings.status` transitions on successful payment (PENDING -> CONFIRMED).

### API Design
- POST `/api/v1/payments/intent` { bookingId, method }
- POST `/api/v1/payments/confirm` { bookingId, gatewayPayload }
- POST `/api/v1/payments/webhook` (no auth) — verify signature
- POST `/api/v1/payments/refund` { paymentId, amount?, reason? } (Admin)
- GET  `/api/v1/payments/:id` (Admin/Owner)

### Flow
1) Client requests intent → create payment row (PENDING), call gateway create-intent → return client secret/session.
2) Client confirms → verify with gateway, mark payment COMPLETED, set `paidAt`, update `booking.status=CONFIRMED`.
3) Webhook redundantly confirms/updates status.
4) Refunds adjust status and amounts; emit notifications.

### Security & Validation
- Verify webhook signature.
- Idempotency keys when creating intents.
- RBAC: Refunds/Admin-only.

### Migrations
- Add indexes and optional columns.

### Tests
- Unit: gateway service mocks, state transitions.
- E2E: happy path, webhook, refund.

### Monitoring
- Log transactionId, bookingId, amounts, latency.

### Risks
- Webhook race conditions → idempotent updates.

### Estimate
3–5 days including tests and docs.


