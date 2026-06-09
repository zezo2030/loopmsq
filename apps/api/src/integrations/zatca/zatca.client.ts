import axios, { AxiosInstance } from 'axios';
import {
  ComplianceCsidResult,
  ProductionCsidResult,
  ZatcaApiResult,
} from './zatca.types';

/**
 * Thin HTTP client for the ZATCA Fatoora APIs (Integration phase).
 *
 * Endpoints (relative to the environment base url):
 *   POST /compliance                       -> compliance CSID (needs OTP)
 *   POST /compliance/invoices              -> compliance check (uses compliance CSID)
 *   POST /production/csids                 -> production CSID (uses compliance CSID)
 *   PATCH /production/csids                -> renew production CSID
 *   POST /invoices/clearance/single        -> standard invoices (clearance)
 *   POST /invoices/reporting/single        -> simplified invoices (reporting)
 *
 * Auth: HTTP Basic where username = base64 binarySecurityToken, password = secret.
 */
export class ZatcaClient {
  private http: AxiosInstance;

  constructor(baseUrl: string, timeoutMs = 30000) {
    this.http = axios.create({
      baseURL: baseUrl.replace(/\/+$/, ''),
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'en',
        'Accept-Version': 'V2',
      },
      // ZATCA can return 303/4xx with meaningful bodies we want to inspect
      validateStatus: () => true,
    });
  }

  private basicAuth(token: string, secret: string): string {
    const user = token; // binary security token (already base64)
    return (
      'Basic ' + Buffer.from(`${user}:${secret}`).toString('base64')
    );
  }

  /**
   * Step 1: Request the Compliance CSID using the CSR + OTP from Fatoora portal.
   * @param csrBase64 base64 of the PEM CSR (without headers, single-line base64)
   */
  async requestComplianceCsid(
    csrBase64: string,
    otp: string,
  ): Promise<ComplianceCsidResult> {
    const res = await this.http.post(
      '/compliance',
      { csr: csrBase64 },
      { headers: { OTP: otp } },
    );
    if (res.status !== 200 && res.status !== 201) {
      throw new ZatcaApiError('requestComplianceCsid', res.status, res.data);
    }
    return {
      requestId: String(res.data.requestID ?? res.data.requestId),
      binarySecurityToken: res.data.binarySecurityToken,
      secret: res.data.secret,
    };
  }

  /**
   * Step 2: Submit a signed sample invoice to the compliance endpoint.
   * Must pass for each document type (standard/simplified invoice, CN, DN)
   * before a production CSID can be issued.
   */
  async complianceCheck(
    complianceToken: string,
    complianceSecret: string,
    payload: { invoiceHash: string; uuid: string; invoiceBase64: string },
  ): Promise<ZatcaApiResult> {
    const res = await this.http.post(
      '/compliance/invoices',
      {
        invoiceHash: payload.invoiceHash,
        uuid: payload.uuid,
        invoice: payload.invoiceBase64,
      },
      { headers: { Authorization: this.basicAuth(complianceToken, complianceSecret) } },
    );
    return this.toResult(res);
  }

  /**
   * Step 3: Exchange the compliance CSID for a production CSID.
   */
  async requestProductionCsid(
    complianceToken: string,
    complianceSecret: string,
    complianceRequestId: string,
  ): Promise<ProductionCsidResult> {
    const res = await this.http.post(
      '/production/csids',
      { compliance_request_id: complianceRequestId },
      { headers: { Authorization: this.basicAuth(complianceToken, complianceSecret) } },
    );
    if (res.status !== 200 && res.status !== 201) {
      throw new ZatcaApiError('requestProductionCsid', res.status, res.data);
    }
    return {
      requestId: String(res.data.requestID ?? res.data.requestId),
      binarySecurityToken: res.data.binarySecurityToken,
      secret: res.data.secret,
    };
  }

  /**
   * Standard (B2B) invoices: clearance. ZATCA validates + returns a cleared,
   * stamped copy that must be delivered to the buyer.
   */
  async clearInvoice(
    productionToken: string,
    productionSecret: string,
    payload: { invoiceHash: string; uuid: string; invoiceBase64: string },
  ): Promise<ZatcaApiResult> {
    const res = await this.http.post(
      '/invoices/clearance/single',
      {
        invoiceHash: payload.invoiceHash,
        uuid: payload.uuid,
        invoice: payload.invoiceBase64,
      },
      {
        headers: {
          Authorization: this.basicAuth(productionToken, productionSecret),
          'Clearance-Status': '1',
        },
      },
    );
    const result = this.toResult(res);
    result.clearedInvoice = res.data?.clearedInvoice;
    result.clearanceStatus = res.data?.clearanceStatus;
    return result;
  }

  /**
   * Simplified (B2C) invoices: reporting. ZATCA acknowledges within 24h window.
   */
  async reportInvoice(
    productionToken: string,
    productionSecret: string,
    payload: { invoiceHash: string; uuid: string; invoiceBase64: string },
  ): Promise<ZatcaApiResult> {
    const res = await this.http.post(
      '/invoices/reporting/single',
      {
        invoiceHash: payload.invoiceHash,
        uuid: payload.uuid,
        invoice: payload.invoiceBase64,
      },
      {
        headers: {
          Authorization: this.basicAuth(productionToken, productionSecret),
          'Clearance-Status': '0',
        },
      },
    );
    const result = this.toResult(res);
    result.reportingStatus = res.data?.reportingStatus;
    return result;
  }

  private toResult(res: { status: number; data: any }): ZatcaApiResult {
    const data = res.data || {};
    const vr = data.validationResults || {};
    return {
      status: res.status,
      validationResults: vr,
      warnings: vr.warningMessages || [],
      errors: vr.errorMessages || [],
      raw: data,
    };
  }
}

export class ZatcaApiError extends Error {
  constructor(
    public readonly op: string,
    public readonly status: number,
    public readonly body: any,
  ) {
    super(
      `ZATCA API error in ${op}: HTTP ${status} - ${
        typeof body === 'string' ? body : JSON.stringify(body)
      }`,
    );
    this.name = 'ZatcaApiError';
  }
}
