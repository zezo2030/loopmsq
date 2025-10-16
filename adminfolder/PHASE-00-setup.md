## Phase 00 — Setup & Foundation

### Goal
Bootstrap Admin (Next.js) and shared infra to consume the existing NestJS API.

### Scope
- Next.js + TS project, Ant Design, React Query, i18next.
- Auth: login page for ADMIN and BRANCH_MANAGER only (staff is mobile-only).
- API client: generate OpenAPI client from `/api/v1/docs`.
- Layout + RBAC-aware navigation (admin/branch-manager).

### UI Pages
- /login, / (dashboard skeleton), layout with side nav.

### API Mapping
- Auth: `POST /auth/staff/login` (for admin/branch_manager accounts), profile: `GET /auth/me`.

### Acceptance Criteria
- Auth flow working, token stored (httpOnly cookie or secure storage), protected routes.
- OpenAPI client compiled and used in a sample call.

### Estimate
1–2 days.
