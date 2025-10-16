## Phase 03 — School Trips Module

### Goal
End-to-end flow for bulk school trip requests, approval, invoicing, and mass ticket generation.

### Scope
- CRUD for trip requests (Admin/Staff review & approve/reject).
- Import guardians/participants via Excel (.xlsx) and validate data.
- Pricing, invoice preview, and payment (depends on Phase 01).
- Bulk ticket generation and delivery.

### Data Model
- `school_trip_requests` already exists (check fields). Extend as needed:
  - participants JSON or separate participants table.
  - status flow: draft -> submitted -> approved -> invoiced -> paid -> tickets_issued -> completed.

### API Design
- POST `/api/v1/trips/requests` (user)
- GET  `/api/v1/trips/requests/:id` (owner/admin)
- POST `/api/v1/trips/requests/:id/upload` (Excel)
- POST `/api/v1/trips/requests/:id/submit`
- POST `/api/v1/trips/requests/:id/approve` (Admin)
- POST `/api/v1/trips/requests/:id/invoice` (Admin)
- POST `/api/v1/trips/requests/:id/issue-tickets` (Admin)

### Workflows
1) User drafts request → uploads participants → submits.
2) Admin reviews → approves → creates invoice/payment intent (Phase 01) → after paid, bulk-generate tickets.

### Validation
- Excel schema check (columns, required values, duplicates).

### Tests
- Unit: parsing, status transitions.
- E2E: happy path from draft to tickets.

### Risks
- Large imports → stream parsing and background jobs.

### Estimate
4–6 days.


