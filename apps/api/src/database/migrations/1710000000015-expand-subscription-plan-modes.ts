import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandSubscriptionPlanModes1710000000015
  implements MigrationInterface
{
  name = 'ExpandSubscriptionPlanModes1710000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "subscription_plans_usagemode_enum" AS ENUM (
          'flexible_total_hours',
          'daily_limited',
          'daily_unlimited'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "subscription_plans"
      ADD COLUMN IF NOT EXISTS "usageMode" "subscription_plans_usagemode_enum" NOT NULL DEFAULT 'daily_limited'
    `);
    await queryRunner.query(`
      ALTER TABLE "subscription_plans"
      ADD COLUMN IF NOT EXISTS "mealItems" text
    `);
    await queryRunner.query(`
      ALTER TABLE "subscription_plans"
      ALTER COLUMN "totalHours" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "subscription_plans"
      ALTER COLUMN "dailyHoursLimit" DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "subscription_purchases"
      ALTER COLUMN "totalHours" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "subscription_purchases"
      ALTER COLUMN "remainingHours" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "subscription_purchases"
      ALTER COLUMN "dailyHoursLimit" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "subscription_plans"
      SET "usageMode" = 'daily_limited'
      WHERE "usageMode" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "subscription_plans"
      SET "totalHours" = COALESCE("totalHours", 30.0),
          "dailyHoursLimit" = COALESCE("dailyHoursLimit", 1.0)
      WHERE "totalHours" IS NULL OR "dailyHoursLimit" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "subscription_purchases"
      SET "totalHours" = COALESCE("totalHours", 30.0),
          "remainingHours" = COALESCE("remainingHours", 30.0),
          "dailyHoursLimit" = COALESCE("dailyHoursLimit", 1.0)
      WHERE "totalHours" IS NULL
         OR "remainingHours" IS NULL
         OR "dailyHoursLimit" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "subscription_plans"
      ALTER COLUMN "totalHours" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "subscription_plans"
      ALTER COLUMN "dailyHoursLimit" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "subscription_purchases"
      ALTER COLUMN "totalHours" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "subscription_purchases"
      ALTER COLUMN "remainingHours" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "subscription_purchases"
      ALTER COLUMN "dailyHoursLimit" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "subscription_plans"
      DROP COLUMN IF EXISTS "mealItems"
    `);
    await queryRunner.query(`
      ALTER TABLE "subscription_plans"
      DROP COLUMN IF EXISTS "usageMode"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "subscription_plans_usagemode_enum"
    `);
  }
}
