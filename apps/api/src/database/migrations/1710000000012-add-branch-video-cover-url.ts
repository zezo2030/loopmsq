import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBranchVideoCoverUrl1710000000012 implements MigrationInterface {
  name = 'AddBranchVideoCoverUrl1710000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "branches" 
      ADD COLUMN IF NOT EXISTS "videoCoverUrl" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "branches" 
      DROP COLUMN IF EXISTS "videoCoverUrl"
    `);
  }
}
