## Phase 02 — Content (Branches/Halls/Add-ons)

### Goal
Create and manage branches, halls, and add-ons.

### Scope
- Branch CRUD, status updates, videoUrl.
- Hall CRUD, availability/pricing utilities.
- Add-ons per hall (as supported by backend model).

### UI Pages
- /content/branches (list/create/edit)
- /content/branches/:id
- /content/halls (list/create/edit)

### API Mapping
- Branches: `POST/GET/PUT/PATCH /content/branches*`
- Halls: `POST/GET/PUT/PATCH /content/halls*`
- Pricing/Availability: `GET /content/halls/:id/pricing`, `GET /content/halls/:id/availability`

### Acceptance Criteria
- CRUD screens validated with Zod; errors localized.
- Availability & pricing calculators render correctly.

### Estimate
4–5 days.
