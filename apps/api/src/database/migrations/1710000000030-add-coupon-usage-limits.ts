import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Coupon usage limits (#8) and discount cap (#11): adds limit/counter columns
 * to `coupons` and a `coupon_redemptions` ledger that backs per-user/global
 * enforcement with an idempotency key on (couponId, reference).
 */
export class AddCouponUsageLimits1710000000030 implements MigrationInterface {
  name = 'AddCouponUsageLimits1710000000030';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "maxDiscountAmount" numeric(10,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "usageLimit" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "perUserLimit" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "usageCount" integer NOT NULL DEFAULT 0`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "coupon_redemptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "couponId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "reference" varchar(255) NOT NULL,
        "code" varchar(50),
        "orderAmount" numeric(10,2) NOT NULL DEFAULT 0,
        "discountAmount" numeric(10,2) NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_coupon_redemptions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_coupon_redemptions_couponId" ON "coupon_redemptions" ("couponId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_coupon_redemptions_userId" ON "coupon_redemptions" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_coupon_redemptions_coupon_user" ON "coupon_redemptions" ("couponId", "userId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_coupon_redemptions_coupon_reference" ON "coupon_redemptions" ("couponId", "reference")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "coupon_redemptions"`);
    await queryRunner.query(
      `ALTER TABLE "coupons" DROP COLUMN IF EXISTS "usageCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "coupons" DROP COLUMN IF EXISTS "perUserLimit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "coupons" DROP COLUMN IF EXISTS "usageLimit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "coupons" DROP COLUMN IF EXISTS "maxDiscountAmount"`,
    );
  }
}
