import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductTermsAndSubscriptionLoyalty1710000000016
  implements MigrationInterface
{
  name = 'AddProductTermsAndSubscriptionLoyalty1710000000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "offer_products"
      ADD COLUMN IF NOT EXISTS "termsAndConditions" text
    `);
    await queryRunner.query(`
      ALTER TABLE "subscription_plans"
      ADD COLUMN IF NOT EXISTS "termsAndConditions" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subscription_plans"
      DROP COLUMN IF EXISTS "termsAndConditions"
    `);
    await queryRunner.query(`
      ALTER TABLE "offer_products"
      DROP COLUMN IF EXISTS "termsAndConditions"
    `);
  }
}
