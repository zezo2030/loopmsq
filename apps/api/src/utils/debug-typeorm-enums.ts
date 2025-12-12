import { DataSource } from 'typeorm';

// #region agent log
const DEBUG_LOG_ENDPOINT = 'http://127.0.0.1:7242/ingest/2e2472bd-ae94-4601-b07f-fbff218202a0';
function debugLog(location: string, message: string, data: any, hypothesisId?: string) {
  fetch(DEBUG_LOG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location,
      message,
      data,
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId,
    }),
  }).catch(() => {});
}
// #endregion

// Helper to safely get enum array
function getEnumArray(enumValue: any): any[] | undefined {
  if (enumValue === undefined || enumValue === null) return undefined;
  if (Array.isArray(enumValue)) return enumValue;
  if (typeof enumValue === 'object') {
    const values = Object.values(enumValue);
    return Array.isArray(values) && values.length > 0 ? values : undefined;
  }
  return undefined;
}

export async function logEnumColumnsInfo(dataSource: DataSource): Promise<void> {
  try {
    // #region agent log
    debugLog('debug-typeorm-enums.ts:logEnumColumnsInfo', 'Starting enum columns analysis', {}, 'A');
    // #endregion

    const entityMetadatas = dataSource.entityMetadatas;
    
    // #region agent log
    debugLog('debug-typeorm-enums.ts:logEnumColumnsInfo', 'Entity metadatas count', { count: entityMetadatas.length }, 'A');
    // #endregion

    for (const metadata of entityMetadatas) {
      const enumColumns = metadata.columns.filter((col) => {
        const type = col.type === 'enum' || (col as any).enum !== undefined;
        // #region agent log
        debugLog(
          `debug-typeorm-enums.ts:logEnumColumnsInfo:${metadata.name}`,
          'Checking column',
          {
            columnName: col.propertyName,
            type: col.type,
            hasEnum: !!(col as any).enum,
            enumType: typeof (col as any).enum,
            enumName: (col as any).enumName,
            isArray: Array.isArray((col as any).enum),
            enumLength: Array.isArray((col as any).enum) ? (col as any).enum.length : undefined,
          },
          'A',
        );
        // #endregion
        return type;
      });

      if (enumColumns.length > 0) {
        // #region agent log
        debugLog(
          `debug-typeorm-enums.ts:logEnumColumnsInfo:${metadata.name}`,
          'Found enum columns',
          {
            tableName: metadata.tableName,
            enumColumnsCount: enumColumns.length,
            enumColumns: enumColumns.map((col) => ({
              propertyName: col.propertyName,
              databaseName: col.databaseName,
              type: col.type,
              enum: (col as any).enum,
              enumType: typeof (col as any).enum,
              enumName: (col as any).enumName,
              isArray: Array.isArray((col as any).enum),
              enumLength: Array.isArray((col as any).enum) ? (col as any).enum.length : undefined,
              enumValues: Array.isArray((col as any).enum)
                ? (col as any).enum
                : typeof (col as any).enum === 'object' && (col as any).enum !== null
                ? Object.values((col as any).enum)
                : undefined,
            })),
          },
          'A',
        );
        // #endregion

        // Check for potential issues
        for (const col of enumColumns) {
          const enumValue = (col as any).enum;
          const columnMetadata = col as any;
          
          // #region agent log
          debugLog(
            `debug-typeorm-enums.ts:logEnumColumnsInfo:${metadata.name}:${col.propertyName}`,
            'Enum column details',
            {
              propertyName: col.propertyName,
              databaseName: col.databaseName,
              enum: enumValue,
              enumType: typeof enumValue,
              isArray: Array.isArray(enumValue),
              enumLength: Array.isArray(enumValue) ? enumValue.length : undefined,
              enumName: columnMetadata.enumName,
              hasEnumName: !!columnMetadata.enumName,
              isEnumObject: typeof enumValue === 'object' && enumValue !== null && !Array.isArray(enumValue),
              enumObjectKeys: typeof enumValue === 'object' && enumValue !== null && !Array.isArray(enumValue) ? Object.keys(enumValue) : undefined,
              enumObjectValues: typeof enumValue === 'object' && enumValue !== null && !Array.isArray(enumValue) ? Object.values(enumValue) : undefined,
              // Check TypeORM's internal enum array conversion
              enumArray: columnMetadata.enum ? (Array.isArray(columnMetadata.enum) ? columnMetadata.enum : Object.values(columnMetadata.enum)) : undefined,
            },
            'B',
          );
          // #endregion

          // Hypothesis C: Check if enum is undefined or null
          if (enumValue === undefined || enumValue === null) {
            // #region agent log
            debugLog(
              `debug-typeorm-enums.ts:logEnumColumnsInfo:${metadata.name}:${col.propertyName}`,
              'POTENTIAL ISSUE: Enum is undefined or null',
              {
                propertyName: col.propertyName,
                databaseName: col.databaseName,
                enum: enumValue,
              },
              'C',
            );
            // #endregion
          }

          // Hypothesis D: Check if enum is object vs array mismatch
          if (typeof enumValue === 'object' && enumValue !== null && !Array.isArray(enumValue)) {
            const enumValues = Object.values(enumValue);
            // #region agent log
            debugLog(
              `debug-typeorm-enums.ts:logEnumColumnsInfo:${metadata.name}:${col.propertyName}`,
              'Enum is object (not array) - checking conversion',
              {
                propertyName: col.propertyName,
                databaseName: col.databaseName,
                enumObjectKeys: Object.keys(enumValue),
                enumObjectValues: enumValues,
                enumValuesLength: enumValues.length,
                // Try to simulate what TypeORM does
                simulatedArray: enumValues,
                simulatedArrayLength: enumValues ? enumValues.length : undefined,
              },
              'D',
            );
            // #endregion
            
            // Hypothesis E: Check if enum values array would be undefined
            if (!enumValues || enumValues.length === 0) {
              // #region agent log
              debugLog(
                `debug-typeorm-enums.ts:logEnumColumnsInfo:${metadata.name}:${col.propertyName}`,
                'POTENTIAL ISSUE: Enum object has no values',
                {
                  propertyName: col.propertyName,
                  databaseName: col.databaseName,
                  enumObject: enumValue,
                },
                'E',
              );
              // #endregion
            }
          }
          
          // Hypothesis F: Check column metadata for enum array property
          const enumArray = getEnumArray(columnMetadata.enum);
          // #region agent log
          debugLog(
            `debug-typeorm-enums.ts:logEnumColumnsInfo:${metadata.name}:${col.propertyName}`,
            'Enum array conversion check',
            {
              propertyName: col.propertyName,
              enumArray: enumArray,
              enumArrayType: typeof enumArray,
              enumArrayIsArray: Array.isArray(enumArray),
              enumArrayLength: Array.isArray(enumArray) ? enumArray.length : (enumArray ? 'not-array' : 'undefined'),
              // Check if this would cause the error
              wouldCauseLengthError: enumArray === undefined,
            },
            'F',
          );
          // #endregion
          
          // Hypothesis G: Simulate what OrmUtils.isArraysEqual would receive
          const enumArray1 = getEnumArray(enumValue);
          // #region agent log
          debugLog(
            `debug-typeorm-enums.ts:logEnumColumnsInfo:${metadata.name}:${col.propertyName}`,
            'Simulating OrmUtils.isArraysEqual input',
            {
              propertyName: col.propertyName,
              enumArray1: enumArray1,
              enumArray1Length: enumArray1 ? enumArray1.length : 'UNDEFINED - THIS WOULD CAUSE ERROR',
              // This is what would be passed to isArraysEqual
              wouldFail: enumArray1 === undefined,
            },
            'G',
          );
          // #endregion
        }
      }
    }

    // #region agent log
    debugLog('debug-typeorm-enums.ts:logEnumColumnsInfo', 'Finished enum columns analysis', {}, 'A');
    // #endregion
  } catch (error) {
    // #region agent log
    debugLog('debug-typeorm-enums.ts:logEnumColumnsInfo', 'Error during enum analysis', { error: error?.message, stack: (error as Error)?.stack }, 'A');
    // #endregion
  }
}

