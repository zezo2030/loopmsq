import { MigrationInterface, QueryRunner } from 'typeorm';

export class BranchHallOneToOne1710000000004 implements MigrationInterface {
  name = 'BranchHallOneToOne1710000000004'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Check if there are any duplicate branchIds
    const duplicates = await queryRunner.query(`
      SELECT "branchId", COUNT(*) as count
      FROM "halls"
      GROUP BY "branchId"
      HAVING COUNT(*) > 1
    `);

    // Step 2: For branches with multiple halls, keep only the first one (by createdAt)
    // Delete additional halls for branches that have more than one hall
    if (duplicates && duplicates.length > 0) {
      await queryRunner.query(`
        DELETE FROM "halls" 
        WHERE id NOT IN (
          SELECT DISTINCT ON ("branchId") id 
          FROM "halls" 
          ORDER BY "branchId", "createdAt" ASC
        )
      `);
    }

    // Step 3: Drop existing index if it exists (to avoid conflicts)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_halls_branchId_unique"
    `);

    // Step 4: Add unique constraint on branchId to ensure one hall per branch
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_halls_branchId_unique" ON "halls" ("branchId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the unique constraint/index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_halls_branchId_unique"
    `);
  }
}

