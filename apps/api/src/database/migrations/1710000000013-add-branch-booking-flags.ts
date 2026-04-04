import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBranchBookingFlags1710000000013 implements MigrationInterface {
  name = 'AddBranchBookingFlags1710000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "branches"
      ADD COLUMN IF NOT EXISTS "hasEventBookings" boolean DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "branches"
      ADD COLUMN IF NOT EXISTS "hasSchoolTrips" boolean DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "branches"
      DROP COLUMN IF EXISTS "hasSchoolTrips"
    `);
    await queryRunner.query(`
      ALTER TABLE "branches"
      DROP COLUMN IF EXISTS "hasEventBookings"
    `);
  }
}
