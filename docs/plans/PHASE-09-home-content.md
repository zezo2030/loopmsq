## Phase 09 — Home Content (Banners/Offers/Videos)

### Goal
Provide APIs to power the app home: banners, offers, and branch videos.

### Data Model
- `banners` (id, title, imageUrl, link, startsAt, endsAt, isActive)
- `offers` (id, title, description, discountType/Value, startsAt, endsAt, isActive)
- Add `videoUrl` to `branches`.

### API
- GET `/api/v1/home` → { banners, offers, featuredBranches }
- Admin CRUD for banners/offers.

### Cache
- Redis short TTL.

### Tests
- Unit + E2E list/filters.

### Estimate
2–3 days.


