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
  source?: { id?: string; payment_method?: string };
  redirect?: {
    url: string;
    post?: {
      url: string;
    };
  };
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
  transaction?: {
    authorization_id?: string;
    url?: string; // Payment URL from Tap Payments (use this for redirect)
  };
  redirect?: {
    url: string;
  };
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
    try {
      const resp = await this.http.post('/v2/charges', payload);
      // Log full response for debugging
      console.log(`[TapClient] Full charge creation response:`, JSON.stringify(resp.data, null, 2));
      return resp.data as TapCharge;
    } catch (error: any) {
      // Extract error message from Tap API response
      const rawMessage = error.response?.data?.message ||
        error.response?.data?.errors?.map((e: any) => e.message).join(', ') ||
        error.message ||
        'Unknown error from payment gateway';

      const errorMessage = typeof rawMessage === 'object' ? JSON.stringify(rawMessage) : String(rawMessage);
      const errorDetails = error.response?.data ? JSON.stringify(error.response.data) : '';
      throw new Error(`Tap Payments API error: ${errorMessage}${errorDetails ? ` - ${errorDetails}` : ''}`);
    }
  }

  async retrieveCharge(chargeId: string): Promise<TapCharge> {
    try {
      const resp = await this.http.get(`/v2/charges/${chargeId}`);
      // Log full response for debugging
      console.log(`[TapClient] Full charge response for ${chargeId}:`, JSON.stringify(resp.data, null, 2));
      return resp.data as TapCharge;
    } catch (error: any) {
      // Extract error message from Tap API response
      const rawMessage = error.response?.data?.message ||
        error.response?.data?.errors?.map((e: any) => e.message).join(', ') ||
        error.message ||
        'Unknown error from payment gateway';

      const errorMessage = typeof rawMessage === 'object' ? JSON.stringify(rawMessage) : String(rawMessage);
      const errorDetails = error.response?.data ? JSON.stringify(error.response.data) : '';
      throw new Error(`Tap Payments API error: ${errorMessage}${errorDetails ? ` - ${errorDetails}` : ''}`);
    }
  }
}


