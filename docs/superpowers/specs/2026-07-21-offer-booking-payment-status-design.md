# Offer Booking Manual Payment Status (Admin)

**Date:** 2026-07-21  
**Status:** Approved for implementation planning  
**Goal:** Allow admins to manually change offer-booking payment status from the dashboard, mirroring subscription purchases.

## Context

Subscription purchases already support admin manual payment-status updates via:

- `PATCH /subscription-purchases/admin/all/:id/payment-status`
- Modal in `apps/admin/src/pages/transactions/SubscriptionsList.tsx`

Offer bookings share the same payment status enum (`pending` | `completed` | `failed`) and have admin list/detail UI, but payment status can only change through the gateway confirm flow (`OfferBookingsService.confirmPayment`). There is no admin override.

## Requirements

| Requirement | Decision |
|---|---|
| Who can update | Admin only (`UserRole.ADMIN`) |
| On `completed` | Run normal confirmation path (tickets + notifications) |
| On `failed` | Set payment failed and cancel booking (`status = cancelled`) |
| On `pending` | Flip payment flag and sync related Payment rows |
| UI location | Admin offer bookings list (same pattern as subscriptions) |
| Branch UI | Out of scope (read-only remains) |

## Approach

**Mirror the subscription pattern** in the offer-bookings module (no shared abstraction refactor).

## Architecture

### Backend

**Endpoint**

```
PATCH /offer-bookings/admin/all/:id/payment-status
```

- Guards: JWT + `RolesGuard` + `@Roles(UserRole.ADMIN)`
- Body DTO: `{ paymentStatus: OfferBookingPaymentStatus }`
- Response: `{ id, paymentStatus, status }`

**Service method:** `adminUpdatePaymentStatus(bookingId, newStatus, adminUserId?)`

Behavior (aligned with `SubscriptionPurchasesService.adminUpdatePaymentStatus`):

1. Load booking; `404` if missing.
2. Remember previous `paymentStatus` for audit.
3. If `completed`:
   - Update related `Payment` rows where `offerBookingId = id` and `status = pending` → `completed`
   - Call existing `confirmPayment(bookingId)` (idempotent: skips duplicate tickets if already confirmed)
   - Write audit metadata
4. Else (`failed` / `pending`):
   - Set `booking.paymentStatus = newStatus`
   - If `failed`: set `booking.status = cancelled`
   - Save booking
   - Sync Payment rows currently `completed` → `failed` or `pending` respectively
   - Write audit metadata
5. Audit shape in `booking.metadata.manualPaymentStatusUpdate`:
   ```json
   {
     "from": "pending",
     "to": "completed",
     "adminUserId": "<uuid|null>",
     "at": "<ISO timestamp>"
   }
   ```

**Files to add/change**

- Add: `apps/api/src/modules/offer-bookings/dto/update-payment-status.dto.ts`
- Change: `offer-bookings.controller.ts` — new PATCH route
- Change: `offer-bookings.service.ts` — `adminUpdatePaymentStatus` (+ Payment repo access if not already injected)

### Frontend (Admin)

**Page:** `apps/admin/src/pages/transactions/OfferBookingsList.tsx`

- Import `apiPatch`, `Modal`, `EditOutlined`
- State: `payModalRow`, `payModalStatus`, `savingPayStatus`
- Actions column: link «تغيير حالة الدفع» opens modal
- Modal title: «تغيير حالة الدفع يدويًا»
- Select options: pending / completed / failed (Arabic labels matching subscriptions)
- On save: PATCH endpoint, success toast, reload list

**Unchanged**

- `OfferBookingDetail.tsx` (display only)
- Branch offer-booking pages
- Mobile / customer APIs

## Error handling

| Case | Result |
|---|---|
| Unknown booking id | `404 Not Found` |
| Invalid enum body | `400` validation |
| Non-admin caller | `403 Forbidden` |
| Already completed + tickets exist | `confirmPayment` no-ops safely (idempotent) |

## Testing (manual)

1. Pending booking → set `completed` → tickets created, push/admin notifications, `paymentStatus=completed`
2. Booking → set `failed` → `paymentStatus=failed`, `status=cancelled`, related Payment synced
3. Completed → set `pending` → payment flag pending; existing tickets not deleted (same as subscription behavior)
4. Branch or customer JWT cannot call the endpoint

## Out of scope

- Branch dashboard payment-status edit
- Payment gateway refunds / chargebacks
- Separate booking-status controls unrelated to payment
- Refactoring a shared payment-status service across modules

## Success criteria

- Admin can change offer booking payment status from the list page with the same UX as subscriptions
- Marking completed activates the booking through the real confirm path
- Marking failed cancels the booking
- Manual changes are audited in booking metadata
