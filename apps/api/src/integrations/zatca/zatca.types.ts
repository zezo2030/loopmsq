/**
 * Shared types for the ZATCA (Fatoora) e-invoicing integration.
 */

/** invoicetypecode values per the ZATCA SDK manual */
export enum InvoiceTypeCode {
  STANDARD = '388', // tax invoice
  // Sub-type / function codes
  DEBIT_NOTE = '383',
  CREDIT_NOTE = '381',
}

/**
 * The two-letter "invoice type transaction" subtype used in the
 * <cbc:InvoiceTypeCode name="0100000"> attribute.
 * Position 1: 01 = standard (B2B), 02 = simplified (B2C)
 */
export enum InvoiceTransactionType {
  STANDARD = 'standard',
  SIMPLIFIED = 'simplified',
}

export enum InvoiceDocumentType {
  INVOICE = 'invoice',
  CREDIT_NOTE = 'credit_note',
  DEBIT_NOTE = 'debit_note',
}

export interface InvoiceLineInput {
  /** Free-text item name (BT-153) */
  name: string;
  /** Quantity (BT-129) */
  quantity: number;
  /** Unit code, default PCE */
  unitCode?: string;
  /** Net unit price excluding VAT (BT-146) */
  unitPrice: number;
  /** VAT rate percentage, e.g. 15 */
  vatRate: number;
  /**
   * VAT category code (UN/CEFACT 5305):
   * S = standard rated, Z = zero rated, E = exempt, O = out of scope
   */
  vatCategory?: 'S' | 'Z' | 'E' | 'O';
  /** Optional discount amount applied to this line (net) */
  discount?: number;
}

export interface CustomerInput {
  name?: string;
  vatNumber?: string;
  identityScheme?: string;
  identityValue?: string;
  street?: string;
  buildingNumber?: string;
  /** Additional number (KSA-19) — 4 digits; required for SA B2B buyers */
  plotIdentification?: string;
  /** Neighborhood / district (KSA-3) — required for SA B2B buyers */
  citySubdivision?: string;
  city?: string;
  postalZone?: string;
  countrySubentity?: string;
  countryCode?: string;
}

export interface BuildInvoiceInput {
  /** Internal/human invoice number (BT-1), e.g. INV-2026-000123 */
  invoiceNumber: string;
  /** UUID for the document (BT-... cbc:UUID) */
  uuid: string;
  /** Invoice Counter Value — monotonic per device (KSA-16) */
  icv: number;
  /** Previous Invoice Hash (KSA-13) — base64 of prior signed invoice hash */
  pih: string;
  /** ISO issue datetime */
  issuedAt: Date;
  transactionType: InvoiceTransactionType;
  documentType: InvoiceDocumentType;
  currency?: string; // default SAR
  lines: InvoiceLineInput[];
  customer?: CustomerInput;
  /** For credit/debit notes: reference to the original invoice number */
  originalInvoiceNumber?: string;
  /** Reason for credit/debit note */
  noteReason?: string;
}

export interface SignedInvoiceResult {
  /** Final signed UBL XML (with UBLExtensions signature + QR injected) */
  signedXml: string;
  /** base64 of the signed XML (for ZATCA API invoice field) */
  signedXmlBase64: string;
  /** Invoice hash (base64) used as PIH for the next invoice */
  invoiceHash: string;
  /** base64-encoded TLV QR string */
  qrCode: string;
}

export type ZatcaInvoiceClearanceStatus =
  | 'CLEARED'
  | 'NOT_CLEARED'
  | 'REPORTED'
  | 'NOT_REPORTED';

export interface ZatcaApiResult {
  status: number;
  clearanceStatus?: string;
  reportingStatus?: string;
  /** base64 of the cleared invoice returned by ZATCA (standard only) */
  clearedInvoice?: string;
  validationResults?: any;
  warnings?: any[];
  errors?: any[];
  raw?: any;
}

export interface ComplianceCsidResult {
  requestId: string;
  /** base64 X.509 binary security token (the CSID certificate) */
  binarySecurityToken: string;
  /** API secret paired with the token */
  secret: string;
}

export interface ProductionCsidResult {
  requestId: string;
  binarySecurityToken: string;
  secret: string;
}
