## Phase 08 — Favorites

### Goal
Allow users to favorite branches/halls for quick access.

### Data Model
- `favorites` table: id, userId, entityType ('branch'|'hall'), entityId, createdAt (unique (userId, entityType, entityId)).

### API
- POST `/api/v1/favorites` { entityType, entityId }
- DELETE `/api/v1/favorites` { entityType, entityId }
- GET `/api/v1/favorites` (list)

### Tests
- Unit services; E2E add/remove/list.

### Estimate
1–2 days.


