import { MigrationInterface, QueryRunner } from 'typeorm';

export class SchoolTripDirectBooking1710000000014
  implements MigrationInterface
{
  name = 'SchoolTripDirectBooking1710000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "public"."school_trip_requests_status_enum"
      ADD VALUE IF NOT EXISTS 'deposit_paid'
    `);

    await queryRunner.query(`
      ALTER TABLE "school_trip_requests"
      ADD COLUMN IF NOT EXISTS "selectedTimeSlot" varchar(50),
      ADD COLUMN IF NOT EXISTS "ticketPricePerStudent" numeric(10,2),
      ADD COLUMN IF NOT EXISTS "ticketsSubtotal" numeric(10,2),
      ADD COLUMN IF NOT EXISTS "addonsSubtotal" numeric(10,2),
      ADD COLUMN IF NOT EXISTS "totalAmount" numeric(10,2),
      ADD COLUMN IF NOT EXISTS "paymentOption" varchar(20),
      ADD COLUMN IF NOT EXISTS "depositAmount" numeric(10,2),
      ADD COLUMN IF NOT EXISTS "amountPaid" numeric(10,2),
      ADD COLUMN IF NOT EXISTS "remainingAmount" numeric(10,2),
      ADD COLUMN IF NOT EXISTS "pricingMonth" varchar(20),
      ADD COLUMN IF NOT EXISTS "pricingSnapshot" json
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "school_trip_requests"
      DROP COLUMN IF EXISTS "pricingSnapshot",
      DROP COLUMN IF EXISTS "pricingMonth",
      DROP COLUMN IF EXISTS "remainingAmount",
      DROP COLUMN IF EXISTS "amountPaid",
      DROP COLUMN IF EXISTS "depositAmount",
      DROP COLUMN IF EXISTS "paymentOption",
      DROP COLUMN IF EXISTS "totalAmount",
      DROP COLUMN IF EXISTS "addonsSubtotal",
      DROP COLUMN IF EXISTS "ticketsSubtotal",
      DROP COLUMN IF EXISTS "ticketPricePerStudent",
      DROP COLUMN IF EXISTS "selectedTimeSlot"
    `);
  }
}
