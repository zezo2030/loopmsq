import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Branch venue capacity is no longer modeled; availability uses working hours
 * and exclusive private-event blocks only.
 */
export class RemoveBranchCapacity1710000000019 implements MigrationInterface {
  name = 'RemoveBranchCapacity1710000000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN IF EXISTS "capacity"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "capacity" integer NOT NULL DEFAULT 0`,
    );
  }
}
