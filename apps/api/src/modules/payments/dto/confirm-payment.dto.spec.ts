import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfirmPaymentDto } from './confirm-payment.dto';

describe('ConfirmPaymentDto', () => {
  it('allows confirm requests without gatewayPayload', async () => {
    const dto = plainToInstance(ConfirmPaymentDto, {
      bookingId: '550e8400-e29b-41d4-a716-446655440000',
      paymentId: 'mysr-payment-1',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('allows gift payment confirmation requests', async () => {
    const dto = plainToInstance(ConfirmPaymentDto, {
      giftOrderId: '550e8400-e29b-41d4-a716-446655440001',
      paymentId: 'mysr-payment-2',
      gatewayPayload: {
        paymentId: 'ext-payment-2',
      },
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
