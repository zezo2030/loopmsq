import axios, { AxiosInstance } from 'axios';

export interface MoyasarPayment {
  id: string;
  status: string;
  amount: number;
  currency: string;
  metadata?: Record<string, any>;
}

export class MoyasarClient {
  private http: AxiosInstance;

  constructor(baseUrl: string, secretKey: string) {
    this.http = axios.create({
      baseURL: baseUrl,
      auth: {
        username: secretKey,
        password: '',
      },
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    });
  }

  async retrievePayment(paymentId: string): Promise<MoyasarPayment> {
    try {
      const response = await this.http.get(`/payments/${paymentId}`);
      return response.data as MoyasarPayment;
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.errors?.map((e: any) => e.message).join(', ') ||
        error.message ||
        'Unknown error from payment gateway';
      throw new Error(`Moyasar API error: ${String(message)}`);
    }
  }
}
