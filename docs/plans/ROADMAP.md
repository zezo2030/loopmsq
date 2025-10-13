## Backend Implementation Roadmap

This roadmap breaks the remaining scope into focused phases. Each phase has its own plan file with objectives, scope, API design, data model updates, acceptance criteria, and risks.

### Phases
- Phase 01: Payments Integration (`PHASE-01-payments.md`)
- Phase 02: QR Exposure & Ticket Sharing/Gifting (`PHASE-02-qr-sharing.md`)
- Phase 03: School Trips Module (`PHASE-03-school-trips.md`)
- Phase 04: Special Events Workflow (`PHASE-04-special-events.md`)
- Phase 05: Notifications & Alerts (`PHASE-05-notifications.md`)
- Phase 06: Loyalty Program (`PHASE-06-loyalty.md`)
- Phase 07: Support Tickets Module (`PHASE-07-support-tickets.md`)
- Phase 08: Favorites (`PHASE-08-favorites.md`)
- Phase 09: Home Content (Banners/Offers/Videos) (`PHASE-09-home-content.md`)
- Phase 10: Rating & Feedback After Visit (`PHASE-10-rating-feedback.md`)
- Phase 11: Staff Reports & Analytics (`PHASE-11-staff-reports.md`)

### Dependencies
- Phase 01 (Payments) should precede Phase 04 (Special Events) and Phase 03 (School Trips) if they require invoicing/payment flows.
- Phase 02 (QR Sharing) depends on tickets generation (already present) and may be referenced by Phase 03/04.
- Phase 05 (Notifications) can be used by most phases to push status updates.
- Phase 06 (Loyalty) depends on completed payment/cancellation states from Phase 01.
- Phase 07 (Support Tickets) independent, but will reference IDs from bookings/payments.
- Phase 08 (Favorites) independent.
- Phase 09 (Home Content) independent.
- Phase 10 (Rating) depends on booking lifecycle and completion events.
- Phase 11 (Reports) depends on underlying data from earlier phases.

### Environments & Tooling
- Docker Compose for local infra (Postgres, Redis, Adminer, Redis Commander).
- Migrations via TypeORM (no auto-sync in production).
- Swagger kept up to date per phase.

### Definition of Done (per phase)
- Schema migrations created and applied locally.
- New/updated endpoints with validation, RBAC, and Swagger.
- Unit tests for services; E2E tests for core flows.
- Logging and basic metrics.
- README/docs updated.

### Tracking
Each phase has a dedicated plan file with tasks and acceptance criteria. See respective `PHASE-*.md` files.

### Suggested Implementation Order
1) Phase 01 — Payments
2) Phase 02 — QR Sharing/Gifting
3) Phase 05 — Notifications
4) Phase 06 — Loyalty
5) Phase 07 — Support Tickets
6) Phase 08 — Favorites
7) Phase 09 — Home Content
8) Phase 10 — Rating & Feedback
9) Phase 11 — Staff Reports & Analytics
10) Phase 03 — School Trips (large scope; leverage earlier primitives)
11) Phase 04 — Special Events (build on payments/notifications)


