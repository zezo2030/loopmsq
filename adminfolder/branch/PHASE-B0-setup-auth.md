## Phase B0 — Setup & Auth (Branch)

### Goal
Bring up a branch-only dashboard with login for BRANCH_MANAGER.

### Scope
- Next.js project or workspace in monorepo, shared UI.
- Auth page; restrict all routes to `BRANCH_MANAGER` token.
- RBAC nav: only branch features.

### API Mapping
- `POST /auth/staff/login` (branch manager credentials)
- `GET /auth/me`

### Acceptance Criteria
- Non-branch roles denied access.
- Layout and navigation ready.

### Estimate
1 day.
