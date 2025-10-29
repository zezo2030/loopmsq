import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';

/**
 * Cleanup old offers and coupons that don't have branchId
 * This should be run once before adding branchId constraint
 */
export async function cleanupOldOffersAndCoupons(dataSource: DataSource): Promise<void> {
  const logger = new Logger('DatabaseCleanup');
  
  try {
    // Check if branchId column exists
    const offerTable = dataSource.getMetadata('offers');
    const hasBranchId = offerTable?.columns.find((col) => col.propertyName === 'branchId');
    
    if (!hasBranchId) {
      logger.log('Cleaning up old offers and coupons without branchId...');
      
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      
      try {
        // Delete all offers and coupons (they will be recreated with branchId)
        await queryRunner.query(`DELETE FROM "offers"`);
        await queryRunner.query(`DELETE FROM "coupons"`);
        
        logger.log('✓ Old offers and coupons cleaned up successfully');
      } catch (error) {
        logger.error('Failed to cleanup old data', error);
        throw error;
      } finally {
        await queryRunner.release();
      }
    } else {
      logger.log('branchId column already exists, skipping cleanup');
    }
  } catch (error) {
    logger.error('Database cleanup error', error);
    // Don't throw - allow app to continue
  }
}

