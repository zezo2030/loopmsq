import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserBillingProfile1710000000028 implements MigrationInterface {
  name = 'AddUserBillingProfile1710000000028';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "billingProfile" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "billingProfile"
    `);
  }
}
