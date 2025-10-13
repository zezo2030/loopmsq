# Admin Control Panel – Build Plan

This plan outlines the phased delivery of the Admin/Branch Managers control panel (React-based), aligned with the existing NestJS backend.

## Tech Stack
- React + Next.js (App Router), TypeScript
- Ant Design (or MUI), TanStack Query, TanStack Table
- Zod + React Hook Form, i18next (ar/en)
- OpenAPI client generated from Swagger (`/api/v1/docs`)

## Phasing Overview
1. Sprint 0: Setup & Foundation
2. Sprint 1: Users & Roles
3. Sprint 2: Branches, Halls, Add-ons
4. Sprint 3: Bookings, Trips, Events
5. Sprint 4: Search/Filters & Notifications
6. Sprint 5: Banners/Offers & Coupons & Packages
7. Sprint 6: Payments, Wallet, Loyalty, Referrals
8. Sprint 7: Reviews, Support, Reports
9. Sprint 8: Analytics, i18n, Final Hardening

See phase files in this folder for details.

## Environments
- Dev / Staging / Prod with isolated API keys for payments, SMS, push.

## Security & RBAC
- JWT bearer auth (staff/admin), role-gated routes & UI.

## Delivery
- CI/CD with Vercel (Admin UI) and Dockerized backend.
