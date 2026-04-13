import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandTripContactPhone1710000000017 implements MigrationInterface {
  name = 'ExpandTripContactPhone1710000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "school_trip_requests"
      ALTER COLUMN "contactPhone" TYPE varchar(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "school_trip_requests"
      ALTER COLUMN "contactPhone" TYPE varchar(20)
    `);
  }
}
