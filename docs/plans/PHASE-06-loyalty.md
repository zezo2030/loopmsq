## Phase 06 — Loyalty Program

### Goal
Implement earn/burn rules, points ledger, and redemption.

### Scope
- Earn points on completed payments; burn points for discounts.
- Admin rules: conversion rates, promos, expiry.

### Data Model
- `wallets`, `loyalty_transactions` exist. Add rules/config table.

### API
- GET `/api/v1/loyalty` (balance, history)
- POST `/api/v1/loyalty/redeem` { amount }
- Admin: rules CRUD

### Tests
- Unit on conversions/edge cases; E2E with payments.

### Estimate
3–4 days.


