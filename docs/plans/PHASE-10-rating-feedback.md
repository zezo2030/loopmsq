## Phase 10 — Rating & Feedback After Visit

### Goal
Collect post-visit ratings with reminders ~5 hours after booking end.

### Data Model
- Add fields on `support_tickets` or create `reviews` table (bookingId, userId, rating, comment, createdAt).

### Flow
- Scheduler (Bull/Schedule) enqueues reminder jobs at bookingEnd+5h.
- Notification with link to rating endpoint.

### API
- POST `/api/v1/reviews` { bookingId, rating (1-5), comment }
- GET  `/api/v1/reviews/:bookingId`

### Tests
- Unit for scheduler and constraints; E2E happy path.

### Estimate
2–3 days.


