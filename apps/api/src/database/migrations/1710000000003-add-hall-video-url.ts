import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHallVideoUrl1710000000003 implements MigrationInterface {
  name = 'AddHallVideoUrl1710000000003'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add videoUrl column to halls table
    await queryRunner.query(`ALTER TABLE "halls" ADD "videoUrl" varchar(500)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove videoUrl column from halls table
    await queryRunner.query(`ALTER TABLE "halls" DROP COLUMN "videoUrl"`);
  }
}



