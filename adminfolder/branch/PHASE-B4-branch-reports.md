## Phase B4 — Branch Reports

### Goal
Provide KPIs and CSV export for the manager's branch.

### Scope
- Overview: bookings confirmed/cancelled, scans, revenue by method.
- CSV export.

### API Mapping
- Use `/reports/overview?from&to&branchId=<manager-branchId>`
- Use `/reports/export?type=overview&from&to&branchId=<manager-branchId>`

### Acceptance Criteria
- Filters by date range; data limited to branchId.

### Estimate
1–2 days.
