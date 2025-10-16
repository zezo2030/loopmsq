## Phase 06 — Payments, Wallet, Loyalty, Referrals

### Goal
Financial overview and incentives.

### Scope
- Payments listing + detail; statuses.
- Wallet balance & transactions; manual adjustments (admin only).
- Loyalty: rules management, user points history.
- Referrals: codes and earnings (requires backend additions).

### UI Pages
- /finance/payments
- /finance/wallets
- /marketing/loyalty (rules/history)
- /marketing/referrals

### API Mapping
- Payments: `/payments` endpoints (admin list, admin detail)
- Wallet/Loyalty: `/loyalty` (me, admin user summary, wallets list/adjust, rules CRUD/activate)
- Referrals: `/referrals` (codes list/create, attribute, earnings list, approve)

### Acceptance Criteria
- Points awarded on successful payments visible in UI (wallet transactions).
- Rule activation is exclusive and persisted. Verified via admin page.
- Referrals earnings created on first paid order and approvable to credit wallet.

### Estimate
4–6 days.
