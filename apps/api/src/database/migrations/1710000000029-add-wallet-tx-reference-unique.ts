import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Idempotency backstop for wallet credits/debits: a given (userId, reference)
 * may appear at most once. NULL references are unconstrained (Postgres treats
 * NULLs as distinct), so only referenced flows are de-duplicated.
 *
 * NOTE: if existing data already contains duplicate (userId, reference) rows,
 * this index creation will fail — those duplicates must be reconciled first.
 */
export class AddWalletTxReferenceUnique1710000000029
  implements MigrationInterface
{
  name = 'AddWalletTxReferenceUnique1710000000029';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_wallet_tx_user_reference"
       ON "wallet_transactions" ("userId", "reference")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_wallet_tx_user_reference"`,
    );
  }
}
