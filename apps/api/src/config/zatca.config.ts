import { ConfigService } from '@nestjs/config';

/**
 * ZATCA (Fatoora) e-invoicing environments.
 * Each environment has its own onboarding + reporting/clearance base URL.
 * See: https://zatca.gov.sa/en/E-Invoicing/Introduction/Pages/Roll-out-phases.aspx
 */
export type ZatcaEnvironment = 'sandbox' | 'simulation' | 'production';

const BASE_URLS: Record<ZatcaEnvironment, string> = {
  // Developer / compliance testing
  sandbox:
    'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal',
  // Pre-production simulation
  simulation:
    'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation',
  // Production
  production: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core',
};

export interface ZatcaSellerConfig {
  /** Seller legal/registered name (BT-27) */
  name: string;
  /** 15-digit VAT registration number (must start & end with 3) */
  vatNumber: string;
  /** Commercial Registration / other scheme id used in the CSR (e.g. CRN) */
  identityScheme: string; // e.g. "CRN", "MOM", "MLS", "700", "SAG", "NAT"
  identityValue: string; // the registration number value
  /** Address fields used in the UBL document */
  street: string;
  buildingNumber: string;
  plotIdentification?: string;
  citySubdivision?: string;
  city: string;
  postalZone: string;
  countrySubentity?: string;
  countryCode: string; // "SA"
  /** Branch/industry used in the CSR (e.g. "Booking Services") */
  industry: string;
}

export interface ZatcaConfig {
  enabled: boolean;
  environment: ZatcaEnvironment;
  baseUrl: string;
  /** OTP from the Fatoora portal, used once during compliance CSID onboarding */
  onboardingOtp?: string;
  seller: ZatcaSellerConfig;
  /** Java runtime + ZATCA SDK paths (the official JAR does signing/QR/hash) */
  javaBin: string;
  sdkJarPath: string; // path to the zatca SDK CLI fat-jar (sign/qr/hash/csr)
  /**
   * Root of the extracted SDK folder (contains Data/Schemas, Data/Rules, ...).
   * Auto-detected under the jar's parent if not set.
   */
  sdkHome?: string;
  /** SDK CLI version passed as --globalVersion (read from global.json) */
  sdkVersion: string;
  /** cert password the SDK CLI expects (-certpassword); sample default 123456789 */
  sdkCertPassword: string;
  /** openssl binary (fallback CSR path; the SDK's -csr is preferred) */
  opensslBin: string;
  /** Working dir for temp xml/csr/key files */
  workDir: string;
  /** AES key used to encrypt stored CSIDs/secrets/private keys at rest */
  secretEncryptionKey: string;
  /** HTTP timeout for ZATCA API calls (ms) */
  httpTimeoutMs: number;
  /** Default VAT rate (%) used when deriving invoice lines from a payment */
  defaultVatRate: number;
  /** Whether payment.amount is VAT-inclusive (true) or net (false) */
  amountIncludesVat: boolean;
}

export const getZatcaConfig = (configService: ConfigService): ZatcaConfig => {
  const environment = (
    configService.get<string>('ZATCA_ENV') || 'sandbox'
  ).toLowerCase() as ZatcaEnvironment;

  return {
    enabled: (configService.get<string>('ZATCA_ENABLED') || 'false') === 'true',
    environment,
    baseUrl:
      configService.get<string>('ZATCA_BASE_URL') ||
      BASE_URLS[environment] ||
      BASE_URLS.sandbox,
    onboardingOtp: configService.get<string>('ZATCA_ONBOARDING_OTP'),
    seller: {
      name: configService.get<string>('ZATCA_SELLER_NAME') || '',
      vatNumber: configService.get<string>('ZATCA_SELLER_VAT') || '',
      identityScheme: configService.get<string>('ZATCA_SELLER_ID_SCHEME') || 'CRN',
      identityValue: configService.get<string>('ZATCA_SELLER_ID_VALUE') || '',
      street: configService.get<string>('ZATCA_SELLER_STREET') || '',
      buildingNumber:
        configService.get<string>('ZATCA_SELLER_BUILDING') || '0000',
      plotIdentification: configService.get<string>('ZATCA_SELLER_PLOT'),
      citySubdivision: configService.get<string>('ZATCA_SELLER_SUBDIVISION'),
      city: configService.get<string>('ZATCA_SELLER_CITY') || '',
      postalZone: configService.get<string>('ZATCA_SELLER_POSTAL') || '00000',
      countrySubentity: configService.get<string>('ZATCA_SELLER_REGION'),
      countryCode: configService.get<string>('ZATCA_SELLER_COUNTRY') || 'SA',
      industry:
        configService.get<string>('ZATCA_SELLER_INDUSTRY') || 'Services',
    },
    javaBin: configService.get<string>('ZATCA_JAVA_BIN') || 'java',
    sdkJarPath:
      configService.get<string>('ZATCA_SDK_JAR') ||
      './zatca-sdk/zatca-einvoicing-sdk.jar',
    sdkHome: configService.get<string>('ZATCA_SDK_HOME') || undefined,
    sdkVersion: configService.get<string>('ZATCA_SDK_VERSION') || '3.0.8',
    sdkCertPassword:
      configService.get<string>('ZATCA_SDK_CERT_PASSWORD') || '123456789',
    opensslBin: configService.get<string>('ZATCA_OPENSSL_BIN') || 'openssl',
    workDir: configService.get<string>('ZATCA_WORK_DIR') || './tmp/zatca',
    secretEncryptionKey:
      configService.get<string>('ZATCA_SECRET_KEY') ||
      configService.get<string>('ENCRYPTION_KEY') ||
      'default-32-character-key-for-dev',
    httpTimeoutMs:
      configService.get<number>('ZATCA_HTTP_TIMEOUT_MS') || 30000,
    defaultVatRate: Number(
      configService.get<string>('ZATCA_DEFAULT_VAT_RATE') ?? '15',
    ),
    amountIncludesVat:
      (configService.get<string>('ZATCA_AMOUNT_INCLUDES_VAT') ?? 'true') ===
      'true',
  };
};
