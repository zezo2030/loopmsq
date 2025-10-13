## Phase 11 — Staff Reports & Analytics

### Goal
Provide staff/admin dashboards and reports for bookings, scans, revenue, and user activity.

### Scope
- KPIs: bookings per branch/hall/date, scan counts, revenue by method, cancellations.
- Export CSV.

### API
- GET `/api/v1/reports/overview?from&to&branchId`
- GET `/api/v1/reports/export?type&from&to`

### Performance
- Pre-aggregations via SQL views/materialized views or nightly jobs.

### Tests
- Unit for aggregations; E2E permissions and response shapes.

### Estimate
3–4 days.


