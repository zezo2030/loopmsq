## Phase 05 — Notifications & Alerts

### Goal
Deliver push/email/SMS notifications for key events (OTP, booking status, payment, reminders, promos).

### Scope
- Abstraction over channels (email, SMS, push). Use Redis + Bull queues for async delivery.
- Templates and localization (ar/en).

### Events
- OTP (delegated to SMS provider), booking confirmed/cancelled, payment success/failure, reminders (24h/2h), promos.

### API/Infra
- Internal service + job processors.
- Webhook endpoints for provider status callbacks (optional).

### Tests
- Unit for templating, queueing.

### Estimate
3–5 days.


