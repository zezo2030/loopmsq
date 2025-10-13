## Phase B1 — Branch & Halls Management

### Goal
Allow branch manager to manage own branch and halls.

### Scope
- View/update branch info (status, working hours, videoUrl, amenities).
- Halls CRUD within owned branch; update hall status.

### API Mapping
- Branch: `GET/PUT/PATCH /content/branches/:id`
- Halls: `POST/GET/PUT/PATCH /content/halls*`

### Acceptance Criteria
- Only branchId-owned resources are visible/editable.

### Estimate
2–3 days.
