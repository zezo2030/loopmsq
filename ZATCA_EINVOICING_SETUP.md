# ZATCA E-Invoicing (Fatoora) Integration

Full **Integration phase** support for both **Standard (B2B → Clearance)** and
**Simplified (B2C → Reporting)** invoices, plus credit/debit notes.

## Architecture

| Layer | Path | Responsibility |
|------|------|----------------|
| Config | [apps/api/src/config/zatca.config.ts](apps/api/src/config/zatca.config.ts) | env-driven config + environment base URLs |
| REST client | [apps/api/src/integrations/zatca/zatca.client.ts](apps/api/src/integrations/zatca/zatca.client.ts) | ZATCA APIs: compliance CSID, production CSID, clearance, reporting |
| XML builder | [apps/api/src/integrations/zatca/zatca-xml.service.ts](apps/api/src/integrations/zatca/zatca-xml.service.ts) | UBL 2.1 invoice XML (standard + simplified, CN/DN) |
| Signer | [apps/api/src/integrations/zatca/zatca-signer.service.ts](apps/api/src/integrations/zatca/zatca-signer.service.ts) | openssl CSR (secp256k1) + JAR SDK signing/QR/hash/validate |
| Orchestration | [apps/api/src/modules/invoicing/invoicing.service.ts](apps/api/src/modules/invoicing/invoicing.service.ts) | onboarding, ICV/PIH chaining, issue → sign → submit |
| HTTP | [apps/api/src/modules/invoicing/invoicing.controller.ts](apps/api/src/modules/invoicing/invoicing.controller.ts) | admin endpoints (`/admin/invoicing/*`) |
| Persistence | `einvoices`, `zatca_credentials` tables (migration `...027`) | invoices + encrypted onboarding artifacts |

> The official ZATCA JAR **only signs / generates QR & hash / validates** — it does
> NOT submit. Submission to ZATCA is done over REST by `zatca.client.ts`.

## Prerequisites (runtime / Docker image) — already wired

Built and verified against the **official ZATCA SDK v3.0.8**. The API images
install everything needed:

1. **JDK 11** (secp256k1; ZATCA requires `>=11 <15`) — copied from
   `eclipse-temurin:11-jre(-alpine)` in [apps/api/Dockerfile](apps/api/Dockerfile)
   and [apps/api/Dockerfile.dev](apps/api/Dockerfile.dev).
2. The **ZATCA SDK** — extract the downloaded SDK into
   [apps/api/zatca-sdk/](apps/api/zatca-sdk/). You need the **whole extracted
   folder** (it contains `Data/Schemas` + `Data/Rules` the CLI validates against),
   not just the jar. The tree is git-ignored (ZATCA-licensed); the prod image
   `COPY`s it in, the dev image mounts it.
   - **CSR is done by the SDK** (`-csr -pem`) — openssl is no longer required.
   - **Version-resilient:** the signer auto-detects the CLI jar (`*.jar`,
     preferring `cli-*-jar-with-dependencies.jar`) and the SDK home (the folder
     with `Data/Rules`). Override with `ZATCA_SDK_JAR` / `ZATCA_SDK_HOME` if needed.
     Set `ZATCA_SDK_VERSION` (default `3.0.8`) to match `global.json`.

### How the SDK is driven (v3.x)

The CLI reads cert/key/PIH/schema/rule paths from a JSON file pointed at by the
**`SDK_CONFIG`** env var, and is run as
`java -Djdk.sunec.disableNative=false -jar cli.jar --globalVersion <v> -certpassword <pw> <flags>`.
[zatca-signer.service.ts](apps/api/src/integrations/zatca/zatca-signer.service.ts)
handles all of this — it writes a per-call `config.json` + temp cert/key/pih, sets
`SDK_CONFIG`/`FATOORA_HOME`, then runs `-sign`, `-invoiceRequest` (to get the
invoiceHash + base64 invoice for the API), `-generateHash`, `-validate`, `-csr`.

- **Health check:** `GET /admin/invoicing/health` verifies java + the jar + the
  SDK home; the admin E-Invoices page shows a red banner if not ready, and
  onboarding fails fast with a clear message.

`ZATCA_*` runtime vars are passed through both `docker-compose.dev.yml` and
`docker-compose.prod.yml` (sourced from the root `.env`). Tooling paths
(`ZATCA_JAVA_BIN`, `ZATCA_OPENSSL_BIN`, `ZATCA_SDK_JAR`, `ZATCA_WORK_DIR`) are set
as image `ENV`.

> **One manual step before enabling:** place the JAR in `apps/api/zatca-sdk/` and
> rebuild the API image. Then set `ZATCA_ENABLED=true` + the `ZATCA_SELLER_*` vars.

## Configuration

Set the `ZATCA_*` variables in `.env` (a template block was appended). Key ones:

- `ZATCA_ENABLED=true`
- `ZATCA_ENV=sandbox | simulation | production`
- `ZATCA_ONBOARDING_OTP` — generated in the Fatoora portal (one-time, per CSID)
- `ZATCA_SELLER_*` — must match your ZATCA/VAT registration. `ZATCA_SELLER_VAT`
  must be 15 digits starting and ending with `3`.

Secrets (private key, CSIDs, API secrets) are stored **AES-encrypted** in
`zatca_credentials` using `ZATCA_SECRET_KEY` (falls back to `ENCRYPTION_KEY`).

## Database

Run the migration:

```bash
npm run migration:run   # adds einvoices + zatca_credentials
```

## Onboarding flow (one-time per environment)

1. Log into the **Fatoora portal**, generate an **OTP**.
2. Call:

```http
POST /admin/invoicing/onboard
{ "otp": "123345" }          # or rely on ZATCA_ONBOARDING_OTP
```

This will: generate an EC key + CSR → request the **compliance CSID** →
run the **6 compliance checks** (standard/simplified × invoice/CN/DN) →
request the **production CSID** → store it as the active credential.

Check status anytime:

```http
GET /admin/invoicing/onboarding-status
```

## Issuing invoices

```http
POST /admin/invoicing/invoices
{
  "type": "simplified",                 // or "standard"
  "documentType": "invoice",            // invoice | credit_note | debit_note
  "paymentId": "<optional payment uuid>",
  "customer": { "name": "Acme", "vatNumber": "311111111111113" },
  "lines": [
    { "name": "Trip booking", "quantity": 1, "unitPrice": 100, "vatRate": 15, "vatCategory": "S" }
  ]
}
```

- **standard** → ZATCA **clearance**; the cleared, stamped XML is stored in
  `clearedXmlBase64` and must be delivered to the buyer.
- **simplified** → ZATCA **reporting**; QR + signed XML are stored.

ICV (counter) and PIH (previous-invoice-hash) chaining is handled automatically
and serialized with a row lock so concurrent issuance can't collide.

## Automatic issuance from payments (implemented)

E-invoices are issued **automatically and asynchronously** for completed
payments — the payment transaction is never touched, so a ZATCA outage can't
block checkout.

- **Feeder:** [invoice-queue.service.ts](apps/api/src/modules/invoicing/invoice-queue.service.ts)
  runs a `@Cron` every minute, finds `COMPLETED` payments (last 7 days) with no
  e-invoice for the current environment, and enqueues one Bull job per payment
  on the `einvoice_issue` queue (deduped by `jobId = einvoice:<env>:<paymentId>`).
- **Worker:** [invoice.processor.ts](apps/api/src/modules/invoicing/invoice.processor.ts)
  calls `issueInvoiceForPayment(paymentId)` — idempotent, skips when disabled /
  not onboarded / already invoiced. Retries 5× with exponential backoff.
- **Manual trigger:** `POST /admin/invoicing/payments/:paymentId/issue` enqueues
  immediately (e.g. to retry a failed one).

Each payment becomes a **simplified (B2C)** invoice with a single line derived
from `payment.amount`. By default the amount is treated as **VAT-inclusive** and
the net is back-calculated at `ZATCA_DEFAULT_VAT_RATE` (15%). Tune via:

```
ZATCA_DEFAULT_VAT_RATE=15
ZATCA_AMOUNT_INCLUDES_VAT=true
```

### Optional: issue instantly instead of waiting for the cron

Inject `InvoiceQueueService` into `PaymentsService` and call
`enqueue(payment.id)` right after a payment is marked `COMPLETED`. The cron
remains as a safety net for anything missed.

### Itemized lines & B2B (implemented)

[invoice-composition.service.ts](apps/api/src/modules/invoicing/invoice-composition.service.ts)
turns a payment into invoice lines + buyer details:

- **Itemization** from the linked aggregate:
  - *Booking* → base service line (`pax × hours`) + one line per add-on.
  - *Offer booking* → product line (× quantity) + an add-ons line.
  - *Subscription* → a single plan line (named from the plan snapshot).
  - *Trip / event / gift / other* → single line.
- **Reconcile-or-fallback:** the itemized lines' VAT-inclusive total must match
  the actually-charged `payment.amount` (±0.02). If not, it falls back to one
  reconciled line — so ZATCA total rules (BR-CO-*) can never fail.
- **B2C vs B2B:** the buyer is resolved from the aggregate's user. If that user
  has a tax profile (`users.billingProfile.vatNumber`), the invoice is issued as
  **STANDARD (B2B) → clearance** with full buyer party details; otherwise
  **SIMPLIFIED (B2C) → reporting**.

#### Enabling B2B for a customer

Set the buyer's tax details on the `users.billingProfile` jsonb column
(migration `...028`):

```json
{
  "vatNumber": "399999999900003",
  "companyName": "Acme Co.",
  "idScheme": "CRN",
  "idValue": "2020202020",
  "street": "Olaya St", "buildingNumber": "5678",
  "plotIdentification": "8888", "citySubdivision": "Al Malaz",
  "city": "Riyadh", "postalZone": "54321", "countryCode": "SA"
}
```

> For SA B2B buyers, ZATCA requires the full national address (BR-KSA-63):
> `plotIdentification` (additional number, 4 digits) and `citySubdivision`
> (neighborhood) are **mandatory** alongside street/building/city/postal.

> An admin UI to edit `billingProfile` is **not** built yet — set it via API/DB
> for now, or ask to add a billing-profile section to the user edit page.

## Verified against the real SDK (v3.0.8) ✅

Both invoice types, generated by the actual `ZatcaXmlService`, were signed and
validated by the official SDK with **GLOBAL VALIDATION RESULT = PASSED** (XSD, EN,
KSA, QR, SIGNATURE, PIH). Fixes that came out of that testing:

- `cbc:IssueTime` must be `HH:MM:SS` with **no** `Z` suffix.
- Invoice hash / PIH chain uses **base64 of the SHA-256 digest bytes** (44 chars).
  First PIH = `X+zrZv/IbzjZUnhsbWlsecLbwjndTpG0ZynXOif7V+k=`.
- **Seller** national address requires `ZATCA_SELLER_PLOT` (additional number,
  4 digits) + `ZATCA_SELLER_SUBDIVISION` (neighborhood) — enforced at onboarding.
- **Simplified B2C** invoices omit the buyer postal address (a bare `SA` country
  with no 5-digit postal trips BR-KSA-67).

## Admin UI (implemented)

A finance section page is available in the admin app:

- **List:** [apps/admin/src/pages/finance/EInvoicesList.tsx](apps/admin/src/pages/finance/EInvoicesList.tsx)
  — `/admin/finance/einvoices`. Shows onboarding status with an **Onboard / Re-onboard**
  action (OTP modal), the invoice list (type, ICV, totals, status), and a **Retry**
  button for failed/rejected invoices.
- **Detail:** [apps/admin/src/pages/finance/EInvoiceDetail.tsx](apps/admin/src/pages/finance/EInvoiceDetail.tsx)
  — `/admin/finance/einvoices/:id`. Renders the **ZATCA QR** (antd `QRCode` from the
  TLV base64), totals, hash, last error, and download buttons for the signed /
  cleared XML.

Linked from the sidebar under **Finance → E-Invoices (ZATCA)**.

## Important notes / limits

- This was authored against the SDK User Manual v1.0.0 and the ZATCA Integration
  API contract. **End-to-end signing/QR depends on the exact CLI flags of the JAR
  build you download** — `zatca-signer.service.ts` centralizes those flags; adjust
  `sign()` / `generateHash()` if your JAR's argument names differ.
- Test against **sandbox**, then **simulation**, before **production**.
- Compliance with the SDK does **not** mean ZATCA accepted the invoice.
