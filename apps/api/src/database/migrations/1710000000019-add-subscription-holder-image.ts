import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionHolderImage1710000000019
  implements MigrationInterface
{
  name = 'AddSubscriptionHolderImage1710000000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subscription_purchases"
      ADD COLUMN IF NOT EXISTS "holderImageUrl" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subscription_purchases"
      DROP COLUMN IF EXISTS "holderImageUrl"
    `);
  }
}
