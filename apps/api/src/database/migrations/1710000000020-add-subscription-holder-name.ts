import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionHolderName1710000000020
  implements MigrationInterface
{
  name = 'AddSubscriptionHolderName1710000000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subscription_purchases"
      ADD COLUMN IF NOT EXISTS "holderName" varchar(100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subscription_purchases"
      DROP COLUMN IF EXISTS "holderName"
    `);
  }
}
