# Offer Booking Payment Status Implementation Plan

> **For agentic workers:** Execute inline. Steps use checkbox syntax for tracking.

**Goal:** Admin can manually change offer-booking payment status from the dashboard, mirroring subscriptions.

**Architecture:** Add `PATCH /offer-bookings/admin/all/:id/payment-status` that reuses `confirmPayment` on completed and cancels on failed; add matching modal on admin `OfferBookingsList`. Add nullable `metadata` jsonb on `offer_bookings` for audit.

**Tech Stack:** NestJS, TypeORM, React + Ant Design (admin)

## Global Constraints

- Admin only (`UserRole.ADMIN`)
- Mirror subscription `adminUpdatePaymentStatus` behavior
- No branch UI changes
- Arabic UI copy matches subscriptions

---

### Task 1: Backend DTO + migration + service + controller

**Files:**
- Create: `apps/api/src/modules/offer-bookings/dto/update-payment-status.dto.ts`
- Create: `apps/api/src/database/migrations/1710000000031-add-offer-booking-metadata.ts`
- Modify: `apps/api/src/database/entities/offer-booking.entity.ts`
- Modify: `apps/api/src/modules/offer-bookings/offer-bookings.service.ts`
- Modify: `apps/api/src/modules/offer-bookings/offer-bookings.controller.ts`

- [x] Add metadata column + DTO + `adminUpdatePaymentStatus` + PATCH route

### Task 2: Admin UI modal

**Files:**
- Modify: `apps/admin/src/pages/transactions/OfferBookingsList.tsx`

- [x] Add «تغيير حالة الدفع» action + modal calling the new endpoint
