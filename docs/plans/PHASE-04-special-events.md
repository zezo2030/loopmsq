## Phase 04 — Special Events Workflow

### Goal
Manage custom event requests (birthdays, graduation, family events) with admin review, pricing, and invoicing.

### Scope
- Event request CRUD with fields (type, decorated, notes, cake image selection, add-ons).
- Admin evaluation → quotation → invoice → payment (Phase 01) → confirmation.

### Data Model
- Reuse `bookings` (with `specialRequests`, `addOns`, `hallId` decorated) or create `event_requests` if needed.

### API Design
- POST `/api/v1/events/requests`
- GET  `/api/v1/events/requests/:id`
- POST `/api/v1/events/requests/:id/quote` (Admin)
- POST `/api/v1/events/requests/:id/confirm` (after payment)

### Tests
- Unit: pricing logic.
- E2E: request → quote → payment → confirm.

### Estimate
3–4 days.


