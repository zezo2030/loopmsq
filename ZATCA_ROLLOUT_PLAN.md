# ZATCA E-Invoicing — Rollout Plan

Staged plan to apply the e-invoicing changes safely: **dev → simulation → production**.
Each phase has: actions, verification, and rollback.

---

## Phase 0 — Pre-flight (code & repo)

**Actions**
- [ ] Work on a branch: `git checkout -b feat/zatca-einvoicing`
- [ ] Review the diff (new module `modules/invoicing`, `integrations/zatca`, 2 entities,
      2 migrations `...027` `...028`, payments wiring, admin pages, Dockerfiles, compose, `.env`).
- [ ] Confirm the licensed SDK is in place: `apps/api/zatca-sdk/zatca-envoice-sdk-203/`
      (git-ignored) + the CLI jar.

**Verify**
- [ ] API compiles: `docker build -f apps/api/Dockerfile --target build -t api-check .`
- [ ] Admin compiles: `docker build -f apps/admin/Dockerfile -t console-check .`

**Rollback** — feature is dormant while `ZATCA_ENABLED=false`; nothing runs.

---

## Phase 1 — Collect data & secrets

From the **organization’s tax registration** (شركة الترفيه المنظم):
- [ ] VAT: `311267633500003`  → `ZATCA_SELLER_VAT`
- [ ] Legal name → `ZATCA_SELLER_NAME`
- [ ] CRN (or MOM/MLS/700/SAG/NAT) → `ZATCA_SELLER_ID_SCHEME` + `ZATCA_SELLER_ID_VALUE`
- [ ] National address: street, building no, **additional number (4 digits)**,
      **neighborhood**, city, **postal (5 digits)**, region →
      `ZATCA_SELLER_STREET/BUILDING/PLOT/SUBDIVISION/CITY/POSTAL/REGION`

From the **Fatoora portal** (per environment, when onboarding):
- [ ] An **OTP** for a *new* EGS unit for the booking app (separate from Loyverse/DAFTRA).

**Verify** — `assertSellerConfigured()` will reject a bad VAT / missing 4-digit
additional number / missing neighborhood / non-5-digit postal at onboarding time.

---

## Phase 2 — Database migrations

**Actions**
```bash
docker compose -f docker-compose.dev.yml up -d postgres redis
docker compose -f docker-compose.dev.yml run --rm api npm run migration:run
```
Adds `einvoices`, `zatca_credentials`, and `users.billingProfile`.

**Verify** — `migration:show` lists `...027` and `...028` as run; tables exist.

**Rollback** — `migration:revert` (twice). Additive only; no data loss.

---

## Phase 3 — Build & deploy images (feature OFF)

**Actions**
- [ ] Set `.env`: `ZATCA_ENABLED=false`, `ZATCA_ENV=simulation`, all `ZATCA_SELLER_*`.
- [ ] `docker compose -f docker-compose.dev.yml up -d --build`

**Verify**
- [ ] API healthy; existing payment/booking flows unaffected (feature gated off).
- [ ] `GET /admin/invoicing/health` → `ready:true` (java + jar + sdkHome found).
  - In the Admin: **Finance → E-Invoices (ZATCA)** banner is green.

**Rollback** — redeploy previous image; `ZATCA_*` vars are inert when disabled.

---

## Phase 4 — Onboarding on **simulation**

**Actions**
- [ ] Set `ZATCA_ENABLED=true`, `ZATCA_ENV=simulation`, restart api.
- [ ] Generate an OTP in the Fatoora **simulation** portal for a new unit.
- [ ] Admin → E-Invoices → **Onboard** (paste OTP). This: generates key+CSR →
      compliance CSID → runs the 6 compliance checks → production CSID → stores it.

**Verify**
- [ ] `GET /admin/invoicing/onboarding-status` → `onboarded:true`, `stage:production`.
- [ ] `zatca_credentials` row `isActive=true` (secrets stored AES-encrypted).

**Rollback** — set `ZATCA_ENABLED=false`. Re-onboard later (creates a fresh credential).

---

## Phase 5 — Smoke test one invoice (simulation)

**Actions**
- [ ] Create a small test payment (or `POST /admin/invoicing/payments/:id/issue`).

**Verify**
- [ ] New `einvoices` row → status `reported` (B2C) or `cleared` (B2B).
- [ ] Detail page shows the **QR** and a downloadable signed XML; `invoiceHash` set.
- [ ] On reject: `lastError` shows ZATCA messages → fix data → **Retry**.

**Rollback** — none needed; simulation submissions are not fiscal.

---

## Phase 6 — Enable automatic issuance (simulation soak)

Already wired: the `@Cron` sweeper + post-payment enqueue fire when `ZATCA_ENABLED=true`.

**Verify (let it run a day or two)**
- [ ] Completed booking/offer/subscription payments → invoices auto-created.
- [ ] **Wallet recharges are skipped** (not a supply).
- [ ] No duplicates (idempotent); ICV is sequential; PIH chains correctly.
- [ ] ZATCA outage doesn’t block checkout (jobs retry 5×).

**Rollback** — `ZATCA_ENABLED=false` pauses all issuance instantly.

---

## Phase 7 — Production cutover

**Pre-reqs** — Phases 4–6 fully green on simulation.

**Actions**
- [ ] In **prod** env file: `ZATCA_ENV=production`, valid `ZATCA_SELLER_*`,
      `ZATCA_ENABLED=true`.
- [ ] Deploy prod images (`docker-compose.prod.yml` — JDK 11 + openssl + SDK baked in).
- [ ] `migration:run` on the prod DB.
- [ ] Generate a **production** OTP in Fatoora → **Onboard** (new prod EGS unit).
- [ ] Issue ONE real low-value invoice → confirm `cleared/reported` + QR.

**Verify**
- [ ] `onboarding-status` (production) onboarded; first real invoice accepted.
- [ ] Monitor `einvoices.status` for `rejected/failed` over the first day.

**Rollback** — `ZATCA_ENABLED=false`. Invoices already issued stay; the cron
re-picks any missed once re-enabled. The chain (ICV/PIH) resumes from the last row.

---

## Cross-cutting checks
- **Secrets:** `ZATCA_SECRET_KEY` (or `ENCRYPTION_KEY`) set & stable — rotating it
  makes stored CSIDs undecryptable (would force re-onboard).
- **Backups:** `zatca_credentials` (encrypted keys/CSIDs) + `einvoices` (the legal
  chain) must be in DB backups.
- **Don’t reset** the ICV/PIH chain — it must stay monotonic per environment.
- **Security:** rotate the secrets currently committed in `docker-compose.prod.yml`
  (Firebase key, SMTP password) — unrelated to ZATCA but a real exposure.

## Quick command reference
```bash
# build/typecheck
docker build -f apps/api/Dockerfile --target build -t api-check .
# migrations
docker compose -f docker-compose.dev.yml run --rm api npm run migration:run
# health / onboarding / issue (admin JWT required)
GET  /admin/invoicing/health
GET  /admin/invoicing/onboarding-status
POST /admin/invoicing/onboard                 { "otp": "..." }
POST /admin/invoicing/payments/:paymentId/issue
GET  /admin/invoicing/invoices
```
