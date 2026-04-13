import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropBranchPriceConfig1710000000012 implements MigrationInterface {
  name = 'DropBranchPriceConfig1710000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "branches"
      DROP COLUMN IF EXISTS "priceConfig"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "branches"
      ADD COLUMN IF NOT EXISTS "priceConfig" JSONB
    `);
  }
}
