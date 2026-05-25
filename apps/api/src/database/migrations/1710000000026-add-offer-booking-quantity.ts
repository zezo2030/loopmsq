import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOfferBookingQuantity1710000000026 implements MigrationInterface {
  name = 'AddOfferBookingQuantity1710000000026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "offer_bookings"
      ADD COLUMN IF NOT EXISTS "quantity" integer NOT NULL DEFAULT 1
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "offer_bookings" DROP COLUMN IF EXISTS "quantity"
    `);
  }
}
