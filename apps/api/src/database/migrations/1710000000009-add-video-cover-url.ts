import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVideoCoverUrl1710000000009 implements MigrationInterface {
  name = 'AddVideoCoverUrl1710000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "activities" 
      ADD COLUMN IF NOT EXISTS "videoCoverUrl" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "activities" 
      DROP COLUMN IF EXISTS "videoCoverUrl"
    `);
  }
}




