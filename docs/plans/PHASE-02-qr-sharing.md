## Phase 02 — QR Exposure & Ticket Sharing/Gifting

### Goal
Expose QR data to users to download/share tickets and allow gifting to other users/phones.

### Scope
- Generate shareable token (already generating internal token/hash) and return QR image/URL.
- Share via link (deep link ready), not actual SMS/WhatsApp send (can be delegated to client or Phase 05).
- Gifting: assign ticket holder name/phone; optional transfer confirmation.

### Data Model
- `tickets` has `holderName`, `holderPhone`, `metadata` — sufficient.
- Add short-lived signed URL for viewing QR.

### API Design
- GET  `/api/v1/tickets/:id/qr` (owner) → dataURL or signed URL
- POST `/api/v1/tickets/:id/gift` { holderName, holderPhone }
- GET  `/api/v1/tickets/:id/share` → returns share link payload

### Flow
1) Owner requests QR → service computes token (store non-reversible hash), render QR (base64) or signed URL.
2) Gift flow updates holder info and optionally sends notification.

### Security
- Owner-only access; staff can only scan.
- Signed URL TTL.

### Tests
- Unit for QR service and ticket ownership checks.
- E2E for gift + retrieval + scan still works.

### Risks
- Token leakage → never expose raw token/hash; use signed URL that maps to server-side fetch.

### Estimate
2–3 days.


