## Phase B2 — Branch Bookings

### Goal
Manage bookings related to the manager's branch.

### Scope
- Bookings list with filters (date range, status), pagination.
- Booking details (tickets, add-ons, user contact), cancel where allowed.

### API Mapping
- `GET /bookings/branch/me?from&to&page&limit`
- `GET /bookings/:id`
- `POST /bookings/:id/cancel`

### Acceptance Criteria
- Only branchId bookings are shown.
- Status and actions reflect backend constraints.

### Estimate
2–3 days.
