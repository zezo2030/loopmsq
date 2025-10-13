## Phase B3 — Staff (QR) Accounts

### Goal
Enable branch manager to create QR staff accounts tied to the branch.

### Scope
- Create staff accounts with role `STAFF` and branchId.
- List staff of this branch; deactivate/activate.

### API Mapping
- Create staff: `POST /users/staff` (roles: ['staff'], branchId set)
- List users with filter local (client-side) or extend API if needed.
- Activate/Deactivate: `PATCH /users/:id/activate|deactivate`

### Acceptance Criteria
- Staff can sign in the mobile app and scan only their branch tickets.

### Estimate
1–2 days.
