import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBranchIdToSchoolTrips1710000000007 implements MigrationInterface {
  name = 'AddBranchIdToSchoolTrips1710000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add branchId column
    await queryRunner.query(`
      ALTER TABLE "school_trip_requests" 
      ADD COLUMN IF NOT EXISTS "branchId" uuid
    `);

    // Add foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "school_trip_requests" 
      ADD CONSTRAINT "FK_school_trip_requests_branchId" 
      FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL
    `);

    // Add index
    await queryRunner.query(`
      CREATE INDEX "IDX_school_trip_requests_branchId" ON "school_trip_requests" ("branchId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "IDX_school_trip_requests_branchId"
    `);

    await queryRunner.query(`
      ALTER TABLE "school_trip_requests" 
      DROP CONSTRAINT "FK_school_trip_requests_branchId"
    `);

    await queryRunner.query(`
      ALTER TABLE "school_trip_requests" 
      DROP COLUMN "branchId"
    `);
  }
}











