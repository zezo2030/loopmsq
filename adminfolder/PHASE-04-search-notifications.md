## Phase 04 — Advanced Search & Notifications

### Goal
Powerful filtering and promo notifications.

### Scope
- Global search and advanced filters (branch, hall, date ranges, status).
- Notifications: trigger PROMO via `POST /notifications/promo`.
- Queue dashboard link (Bull Board).

### UI Pages
- Filters on lists; /notifications (promo sender)

### API Mapping
- Promo: `POST /notifications/promo`

### Acceptance Criteria
- Filter state shareable via URL query.
- Promo requests enqueue jobs and succeed.

### Estimate
2–3 days.
