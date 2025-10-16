## Phase 07 — Support Tickets Module

### Goal
Expose CRUD and messaging for support tickets with categories, priorities, and statuses.

### Scope
- Create ticket, reply, change status/priority, assign staff.
- User and staff views; notifications on updates.

### API
- POST `/api/v1/support` (user)
- GET  `/api/v1/support/:id` (owner/staff)
- POST `/api/v1/support/:id/reply`
- PATCH `/api/v1/support/:id` (status/priority/assign) — staff/admin
- GET `/api/v1/support` (list with filters/pagination)

### Tests
- Unit services; E2E owner vs staff access.

### Estimate
2–3 days.


