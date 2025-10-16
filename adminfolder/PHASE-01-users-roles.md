## Phase 01 — Users & Roles

### Goal
Manage customers and staff accounts with RBAC. Only ADMIN/BRANCH_MANAGER can access admin panel.

### Scope
- Users list/detail/update; create staff; activate/deactivate.
- Create Branch Manager accounts (tied to branchId).
- Role-based UI guards to exclude STAFF from admin UI.

### UI Pages
- /users (list with filters/pagination)
- /users/:id (detail/edit)
- /staff/new, /branch-managers/new

### API Mapping
- List users: `GET /users`
- User detail: `GET /users/:id`
- Update user: `PUT /users/:id`
- Create staff: `POST /users/staff`
- Create branch manager: `POST /users/branch-manager`
- Activate/Deactivate: `PATCH /users/:id/activate|deactivate`

### Acceptance Criteria
- CRUD operations work and reflect instantly (React Query cache update).
- Role checks hide restricted actions; STAFF cannot access admin routes.

### Estimate
3–4 days.
