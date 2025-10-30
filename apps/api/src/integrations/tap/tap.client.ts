import axios, { AxiosInstance } from 'axios';

export interface TapCreateChargeRequest {
  amount: number;
  currency: string; // e.g. 'SAR'
  customer?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: { country_code?: string; number?: string };
  };
  source: { id: string } | { payment_method: string };
  threeDS?: 'N' | 'Y' | 'y' | 'n' | 'required';
  description?: string;
  metadata?: Record<string, any>;
  capture?: boolean; // true for charge, false for authorize
}

export interface TapCharge {
  id: string;
  status: string; // e.g. CAPTURED, AUTHORIZED, INITIATED, FAILED
  amount: number;
  currency: string;
  transaction?: { authorization_id?: string };
}

export class TapClient {
  private http: AxiosInstance;

  constructor(private baseUrl: string, private secretKey: string) {
    this.http = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    });
  }

  async createCharge(payload: TapCreateChargeRequest): Promise<TapCharge> {
    const resp = await this.http.post('/v2/charges', payload);
    return resp.data as TapCharge;
  }

  async retrieveCharge(chargeId: string): Promise<TapCharge> {
    const resp = await this.http.get(`/v2/charges/${chargeId}`);
    return resp.data as TapCharge;
  }
}


