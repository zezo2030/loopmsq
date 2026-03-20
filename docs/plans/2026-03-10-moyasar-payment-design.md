# Moyasar Payment Design

**Date:** 2026-03-10

**Goal:** Complete the test-mode Moyasar payment flow between `user-app/user_app` and `loopmsq/apps/api` so card payments are created in the Flutter client and verified securely by the backend before any booking, event request, or trip request is confirmed.

## Current State

- The Flutter app already uses the `moyasar` package in `user-app/user_app/lib/features/payments/presentation/pages/moyasar_payment_page.dart`.
- The app still points to an outdated test publishable key in `user-app/user_app/lib/core/constants/api_constants.dart`.
- The backend already includes `MoyasarService` and `MoyasarClient` in `loopmsq/apps/api/src/integrations/moyasar`.
- The backend `confirmPayment()` flow already verifies the external payment using the server-side secret key, then validates `status`, `amount`, and `currency`.
- The root `loopmsq/.env` already contains the provided test keys, but `PAYMENTS_BYPASS=true` currently disables real gateway verification.

## Recommended Approach

Use the Flutter SDK on the client with the test publishable key, and keep all secret-key verification inside the NestJS API.

Why this approach:

- It matches Moyasar's documented split between client publishable key and server secret key.
- It preserves the existing architecture instead of replacing it.
- It minimizes risk by only completing missing configuration and reliability gaps.

## Target Flow

1. The app creates an internal payment intent by calling `POST /payments/intent`.
2. The app opens the Moyasar payment UI using the publishable key.
3. Moyasar returns a payment result containing the external `paymentId`.
4. The app calls `POST /payments/confirm` with the internal context and external Moyasar payment ID.
5. The backend fetches the payment from Moyasar using `MOYASAR_SECRET_KEY`.
6. The backend accepts the payment only if:
   - `status` is `paid` or `authorized`
   - `amount` matches the expected amount in halalas
   - `currency` matches `SAR`
7. The backend marks the internal payment as completed and confirms the related booking/request.

## Required Changes

### Flutter App

- Replace the hardcoded outdated publishable key with the provided test key.
- Ensure the payment confirmation call always passes the external Moyasar payment ID to the backend.
- Keep the current in-app success/failure handling, since the SDK already returns a `PaymentResponse`.

### Backend API

- Disable `PAYMENTS_BYPASS` for real test-gateway verification.
- Keep `MOYASAR_SECRET_KEY` only in server env configuration.
- Add regression coverage for the server-side confirmation rules.
- Verify the current response contract is sufficient for the Flutter flow.

### Reliability

- Preserve the existing `/payments/success` page for deep-link recovery, but do not make it the primary path for this step.
- Treat the backend verification as the source of truth even if the client SDK reports success.

## Security Notes

- `sk_test_*` must never be moved into Flutter code.
- `pk_test_*` is safe to use in client code.
- The backend must continue rejecting mismatched amount/currency even if the gateway status is successful.
- Test keys should stay in env/config, not in committed example files with real values.

## Testing Strategy

- Add or fix unit tests around `PaymentsService.confirmPayment()`.
- Cover:
  - successful Moyasar verification
  - rejected status
  - amount mismatch
  - currency mismatch
- Verify the Flutter side at least by static inspection and linting unless a full device test is available in this session.

## Non-Goals

- No production-key rollout
- No webhook redesign
- No Apple Pay or STC Pay expansion in this task
