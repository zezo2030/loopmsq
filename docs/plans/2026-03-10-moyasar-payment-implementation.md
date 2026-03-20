# Moyasar Payment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the test-mode Moyasar payment integration so the Flutter app uses the correct publishable key and the NestJS API performs real server-side payment verification before confirming payment-dependent records.

**Architecture:** The client continues to collect card details and create the gateway payment through the Flutter Moyasar SDK. The backend remains the source of truth by retrieving the external payment with `MOYASAR_SECRET_KEY` and validating `status`, `amount`, and `currency` before completing the internal payment.

**Tech Stack:** Flutter, Dart, NestJS, TypeORM, Jest, Moyasar Flutter SDK, Moyasar REST API

---

### Task 1: Add failing backend regression tests

**Files:**
- Modify: `loopmsq/apps/api/src/modules/payments/payments.service.spec.ts`
- Test: `loopmsq/apps/api/src/modules/payments/payments.service.spec.ts`

**Step 1: Write the failing test**

Add tests that expect `confirmPayment()` to:
- call `MoyasarService.retrievePayment()`
- accept `paid` and matching `amount`/`currency`
- reject mismatched `amount`
- reject mismatched `currency`

**Step 2: Run test to verify it fails**

Run: `npm test -- payments.service.spec.ts`
Expected: FAIL because the current test doubles do not cover the real Moyasar verification path correctly.

**Step 3: Write minimal implementation**

Update the test module mocks so `PaymentsService` receives:
- `ConfigService` with `MOYASAR_SECRET_KEY` present and `PAYMENTS_BYPASS=false`
- `MoyasarService` mock with `retrievePayment()`
- notification and loyalty dependencies required by the success path

**Step 4: Run test to verify it passes**

Run: `npm test -- payments.service.spec.ts`
Expected: PASS

### Task 2: Fix backend runtime configuration

**Files:**
- Modify: `loopmsq/.env`
- Modify: `loopmsq/apps/api/.env.example`

**Step 1: Write the failing test**

No automated test for env files. Use config review as the verification mechanism for this task.

**Step 2: Verify current broken state**

Check that:
- `MOYASAR_SECRET_KEY` is present
- `PAYMENTS_BYPASS=true` currently prevents real gateway verification

**Step 3: Write minimal implementation**

- Set `PAYMENTS_BYPASS=false` in `loopmsq/.env`
- Keep real secrets only in `.env`
- Keep `apps/api/.env.example` as placeholders only

**Step 4: Verify the configuration**

Run the targeted test suite again and confirm the real verification path stays enabled in test mode.

### Task 3: Update Flutter publishable key

**Files:**
- Modify: `user-app/user_app/lib/core/constants/api_constants.dart`

**Step 1: Write the failing test**

No existing automated test covers this constant. Use code verification and linting for this task.

**Step 2: Verify current broken state**

Confirm the file still contains the outdated test publishable key.

**Step 3: Write minimal implementation**

Replace the old hardcoded `moyasarPublishableKey` with the provided `pk_test_YQE7QedoWj3Mw7xyfh44HaN1WWwRdioQoeer6foL`.

**Step 4: Verify the update**

Run lint/analysis for the edited Dart files and confirm there are no diagnostics introduced.

### Task 4: Validate the Flutter-to-backend confirmation path

**Files:**
- Review: `user-app/user_app/lib/features/payments/presentation/pages/moyasar_payment_page.dart`
- Review: `user-app/user_app/lib/features/payments/data/datasources/payment_remote_datasource.dart`
- Review: `loopmsq/apps/api/src/modules/payments/dto/confirm-payment.dto.ts`

**Step 1: Write the failing test**

If inspection reveals a contract mismatch, add a focused backend or Flutter test for that mismatch before changing code.

**Step 2: Run test to verify it fails**

Run only the focused test you added.

**Step 3: Write minimal implementation**

Adjust the request payload only if needed so the external Moyasar payment ID is reliably passed to `confirmPayment()`.

**Step 4: Run test to verify it passes**

Run the focused test plus the payment service spec.

### Task 5: Final verification

**Files:**
- Review: edited files only

**Step 1: Run backend tests**

Run: `npm test -- payments.service.spec.ts`
Expected: PASS

**Step 2: Run lint/diagnostics**

Run IDE diagnostics on:
- `loopmsq/apps/api/src/modules/payments/payments.service.spec.ts`
- `user-app/user_app/lib/core/constants/api_constants.dart`

Expected: no new issues from these changes

**Step 3: Summarize operational follow-up**

Document that:
- the backend must be restarted after `.env` changes
- the app must be rebuilt/restarted after the Flutter key change
- live keys must be rotated separately for production
