import { MigrationInterface, QueryRunner } from 'typeorm';

export class PrivateEventsDirectBooking1710000000015
  implements MigrationInterface
{
  name = 'PrivateEventsDirectBooking1710000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "public"."event_requests_status_enum"
      ADD VALUE IF NOT EXISTS 'deposit_paid'
    `);

    await queryRunner.query(`
      ALTER TABLE "addons"
      ADD COLUMN IF NOT EXISTS "category" varchar(50) NOT NULL DEFAULT 'general',
      ADD COLUMN IF NOT EXISTS "description" text,
      ADD COLUMN IF NOT EXISTS "imageUrl" text,
      ADD COLUMN IF NOT EXISTS "metadata" json
    `);

    await queryRunner.query(`
      ALTER TABLE "event_requests"
      ADD COLUMN IF NOT EXISTS "bookingId" uuid,
      ADD COLUMN IF NOT EXISTS "selectedTimeSlot" varchar(20),
      ADD COLUMN IF NOT EXISTS "acceptedTerms" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "hallRentalPrice" numeric(10,2),
      ADD COLUMN IF NOT EXISTS "addOnsSubtotal" numeric(10,2),
      ADD COLUMN IF NOT EXISTS "totalAmount" numeric(10,2),
      ADD COLUMN IF NOT EXISTS "paymentOption" varchar(20),
      ADD COLUMN IF NOT EXISTS "depositAmount" numeric(10,2),
      ADD COLUMN IF NOT EXISTS "amountPaid" numeric(10,2),
      ADD COLUMN IF NOT EXISTS "remainingAmount" numeric(10,2)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "event_requests"
      DROP COLUMN IF EXISTS "remainingAmount",
      DROP COLUMN IF EXISTS "amountPaid",
      DROP COLUMN IF EXISTS "depositAmount",
      DROP COLUMN IF EXISTS "paymentOption",
      DROP COLUMN IF EXISTS "totalAmount",
      DROP COLUMN IF EXISTS "addOnsSubtotal",
      DROP COLUMN IF EXISTS "hallRentalPrice",
      DROP COLUMN IF EXISTS "acceptedTerms",
      DROP COLUMN IF EXISTS "selectedTimeSlot",
      DROP COLUMN IF EXISTS "bookingId"
    `);

    await queryRunner.query(`
      ALTER TABLE "addons"
      DROP COLUMN IF EXISTS "metadata",
      DROP COLUMN IF EXISTS "imageUrl",
      DROP COLUMN IF EXISTS "description",
      DROP COLUMN IF EXISTS "category"
    `);
  }
}
