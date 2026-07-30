/**
 * One-off: activate subscription purchases where Moyasar already charged
 * but confirm failed due to amount mismatch (full plan.price vs coupon quote).
 */
const { Client } = require('pg');
const crypto = require('crypto');

const MOYASAR_SECRET = process.env.MOYASAR_SECRET_KEY;

function generateSubscriptionToken(purchaseId) {
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  return `SP:${purchaseId}:${randomSuffix}`;
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
const client = new Client({
  host: process.env.DATABASE_HOST || 'postgres',
  port: Number(process.env.DATABASE_PORT || 5432),
  user: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || '',
  database: process.env.DATABASE_NAME || 'booking_platform',
});

if (!MOYASAR_SECRET) {
  console.error('MOYASAR_SECRET_KEY missing');
  process.exit(1);
}

async function moyasarGet(id) {
  const auth = Buffer.from(`${MOYASAR_SECRET}:`).toString('base64');
  const res = await fetch(`https://api.moyasar.com/v1/payments/${id}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Moyasar ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function addCalendarMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

async function main() {
  await client.connect();

  const { rows } = await client.query(`
    SELECT
      sp.id AS purchase_id,
      p.id AS payment_id,
      p.amount AS payment_amount,
      p."gatewayRef" AS gateway_ref,
      plan."durationMonths" AS duration_months
    FROM subscription_purchases sp
    JOIN payments p ON p."subscriptionPurchaseId" = sp.id
    JOIN subscription_plans plan ON plan.id = sp."subscriptionPlanId"
    WHERE sp."paymentStatus" = 'pending'
      AND sp.status = 'pending_payment'
      AND p.status IN ('processing', 'pending')
      AND p."gatewayRef" IS NOT NULL
      AND p."gatewayRef" <> ''
    ORDER BY p."createdAt" DESC
  `);

  console.log(`Candidates: ${rows.length}`);
  let healed = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const gateway = await moyasarGet(row.gateway_ref);
      const status = String(gateway.status || '').toLowerCase();
      if (!['paid', 'authorized'].includes(status)) {
        console.log(`skip ${row.purchase_id}: moyasar=${status}`);
        skipped += 1;
        continue;
      }

      const paidSar = Number(gateway.amount) / 100;
      const startedAt = new Date();
      const endsAt = addCalendarMonths(
        startedAt,
        Number(row.duration_months || 1),
      );

      await client.query('BEGIN');

      await client.query(
        `UPDATE payments
         SET amount = $1,
             status = 'completed',
             "paidAt" = NOW(),
             "updatedAt" = NOW(),
             "gatewayRef" = COALESCE("gatewayRef", $2)
         WHERE id = $3`,
        [paidSar, row.gateway_ref, row.payment_id],
      );

      await client.query(
        `UPDATE payments
         SET status = 'failed',
             "failureReason" = 'superseded_after_heal',
             "updatedAt" = NOW()
         WHERE "subscriptionPurchaseId" = $1
           AND id <> $2
           AND status IN ('pending', 'processing')`,
        [row.purchase_id, row.payment_id],
      );

      const rawToken = generateSubscriptionToken(row.purchase_id);
      const qrTokenHash = hashToken(rawToken);

      await client.query(
        `UPDATE subscription_purchases
         SET status = 'active',
             "paymentStatus" = 'completed',
             "startedAt" = $2,
             "endsAt" = $3,
             "qrTokenHash" = $6,
             metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
               'healedAt', to_jsonb(NOW()::text),
               'healedReason', to_jsonb('moyasar_paid_amount_mismatch'::text),
               'healedPaymentId', to_jsonb($4::text),
               'healedGatewayAmount', to_jsonb($5::text),
               'qrData', to_jsonb($7::text)
             ),
             "updatedAt" = NOW()
         WHERE id = $1`,
        [
          row.purchase_id,
          startedAt,
          endsAt,
          row.payment_id,
          String(paidSar),
          qrTokenHash,
          rawToken,
        ],
      );

      await client.query('COMMIT');
      healed += 1;
      console.log(
        `healed purchase=${row.purchase_id} payment=${row.payment_id} amount=${paidSar}`,
      );
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      console.error(`error ${row.purchase_id}: ${err.message}`);
    }
  }

  console.log(`Done. healed=${healed} skipped=${skipped}`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
