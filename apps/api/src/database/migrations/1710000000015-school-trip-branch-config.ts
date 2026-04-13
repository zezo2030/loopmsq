import { MigrationInterface, QueryRunner } from 'typeorm';

export class SchoolTripBranchConfig1710000000015 implements MigrationInterface {
  name = 'SchoolTripBranchConfig1710000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "branches"
      ADD COLUMN IF NOT EXISTS "schoolTripMinimumStudents" integer,
      ADD COLUMN IF NOT EXISTS "schoolTripDepositPercentage" integer,
      ADD COLUMN IF NOT EXISTS "schoolTripMonthlyPrices" json
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "branches"
      DROP COLUMN IF EXISTS "schoolTripMonthlyPrices",
      DROP COLUMN IF EXISTS "schoolTripDepositPercentage",
      DROP COLUMN IF EXISTS "schoolTripMinimumStudents"
    `);
  }
}
