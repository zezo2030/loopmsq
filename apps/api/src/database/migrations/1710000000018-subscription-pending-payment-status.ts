import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Unpaid checkouts were stored as status=active, which made the app treat them as real subscriptions.
 * Adds pending_payment and moves legacy unpaid rows off active.
 */
export class SubscriptionPendingPaymentStatus1710000000018
  implements MigrationInterface
{
  name = 'SubscriptionPendingPaymentStatus1710000000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "subscription_purchases_status_enum" ADD VALUE 'pending_payment';
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      UPDATE "subscription_purchases"
      SET "status" = 'pending_payment'
      WHERE "status" = 'active'
        AND "paymentStatus" = 'pending'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "subscription_purchases"
      SET "status" = 'active'
      WHERE "status" = 'pending_payment'
        AND "paymentStatus" = 'pending'
    `);
  }
}
