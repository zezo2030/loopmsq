import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOfferBookingMetadata1710000000031 implements MigrationInterface {
  name = 'AddOfferBookingMetadata1710000000031';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "offer_bookings"
      ADD COLUMN IF NOT EXISTS "metadata" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "offer_bookings" DROP COLUMN IF EXISTS "metadata"
    `);
  }
}
