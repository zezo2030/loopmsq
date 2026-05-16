import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReferralRewardPoints1710000000024
  implements MigrationInterface
{
  name = 'AddReferralRewardPoints1710000000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loyalty_rules" ADD COLUMN IF NOT EXISTS "referralRewardPoints" integer NOT NULL DEFAULT 100`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loyalty_rules" DROP COLUMN IF EXISTS "referralRewardPoints"`,
    );
  }
}
