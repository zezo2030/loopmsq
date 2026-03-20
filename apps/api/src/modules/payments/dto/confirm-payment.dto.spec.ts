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
});
