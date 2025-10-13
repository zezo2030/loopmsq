## Phase 03 — Bookings, School Trips, Special Events

### Goal
Administer bookings lifecycle and requests for trips/events.

### Scope
- Bookings list/detail, confirm/cancel, tickets view.
- School trips workflow: review/approve/invoice/paid/issue tickets.
- Special events: quote/confirm.

### UI Pages
- /bookings (list/detail)
- /trips (list/detail/workflow)
- /events (list/detail/workflow)

### API Mapping
- Bookings: `GET /bookings`, `GET /bookings/:id`, `POST /bookings/:id/cancel`
- Trips: existing trips controller routes
- Events: existing events controller routes
- Staff scanning (reference for staff app): `POST /bookings/staff/scan`

### Acceptance Criteria
- Status transitions reflected; notifications triggered by backend remain visible in logs.
- Tickets detail renders add-ons.

### Estimate
4–5 days.
