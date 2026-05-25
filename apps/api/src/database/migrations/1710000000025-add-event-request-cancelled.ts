import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventRequestCancelled1710000000025
  implements MigrationInterface
{
  name = 'AddEventRequestCancelled1710000000025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "public"."event_requests_status_enum"
      ADD VALUE IF NOT EXISTS 'cancelled'
    `);

    await queryRunner.query(`
      ALTER TABLE "event_requests"
      ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "cancellationReason" text,
      ADD COLUMN IF NOT EXISTS "refundDueAmount" numeric(10,2)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "event_requests"
      DROP COLUMN IF EXISTS "refundDueAmount",
      DROP COLUMN IF EXISTS "cancellationReason",
      DROP COLUMN IF EXISTS "cancelledAt"
    `);
  }
}
