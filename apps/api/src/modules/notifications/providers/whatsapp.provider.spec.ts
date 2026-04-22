import axios from 'axios';
import { WhatsAppProvider } from './whatsapp.provider';

jest.mock('axios');

describe('WhatsAppProvider', () => {
  const post = jest.fn();
  const create = axios.create as unknown as jest.Mock;
  const configValues: Record<string, string | undefined> = {
    WHATSAPP_ACCESS_TOKEN: 'token-123',
    WHATSAPP_PHONE_NUMBER_ID: 'phone-id-123',
    WHATSAPP_GIFT_TEMPLATE_NAME: 'send_giff',
    WHATSAPP_GIFT_LANGUAGE: 'ar',
  };

  const configService = {
    get: jest.fn((key: string) => configValues[key]),
  };
  const redis = {
    get: jest.fn(async () => null),
  };
  const encryption = {
    decrypt: jest.fn((value: string) => value),
  };

  let provider: WhatsAppProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    configValues.WHATSAPP_GIFT_LANGUAGE = 'ar';
    post.mockResolvedValue({
      data: {
        messages: [{ id: 'wamid.test.123' }],
      },
    });
    create.mockReturnValue({ post });
    provider = new WhatsAppProvider(
      configService as any,
      redis as any,
      encryption as any,
    );
  });

  it('sends gift invites through send_giff with body parameters in order', async () => {
    const result = await provider.sendGiftInvite('+966500000000', {
      senderName: 'Ahmed',
      productTitle: 'Monthly Subscription',
      branchName: 'Riyadh Branch',
      claimUrl: 'https://example.com/gift/claim?token=abc',
    });

    expect(result).toEqual({
      success: true,
      messageId: 'wamid.test.123',
    });
    expect(post).toHaveBeenCalledWith('/messages', {
      messaging_product: 'whatsapp',
      to: '966500000000',
      type: 'template',
      template: {
        name: 'send_giff',
        language: { code: 'ar' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'Ahmed' },
              { type: 'text', text: 'Monthly Subscription' },
              { type: 'text', text: 'Riyadh Branch' },
              {
                type: 'text',
                text: 'https://example.com/gift/claim?token=abc',
              },
            ],
          },
        ],
      },
    });
  });

  it('falls back to a friendly sender name when sender name is hidden', async () => {
    await provider.sendGiftInvite('+966500000000', {
      senderName: '',
      productTitle: 'Game Offer',
      branchName: 'Jeddah Branch',
      claimUrl: 'https://example.com/gift/claim?token=offer',
    });

    const payload = post.mock.calls[0][1];
    expect(payload.template.components[0].parameters[0].text).toBe(
      '\u0623\u062d\u062f \u0623\u062d\u0628\u0627\u0626\u0643',
    );
    expect(payload.template.components[0].parameters[1].text).toBe(
      'Game Offer',
    );
  });

  it('expands WHATSAPP_GIFT_LANGUAGE=en_US to English fallbacks', async () => {
    configValues.WHATSAPP_GIFT_LANGUAGE = 'en_US';
    const result = await provider.sendGiftInvite(
      '+966500000000',
      {
        senderName: 'Ahmed',
        productTitle: 'Monthly Subscription',
        branchName: 'Riyadh Branch',
        claimUrl: 'https://example.com/gift/claim?token=abc',
      },
      'ar',
    );

    expect(result.success).toBe(true);
    expect(post.mock.calls[0][1].template.language.code).toBe('en_US');
  });

  it('retries gift invites with fallback languages when translation is missing', async () => {
    delete configValues.WHATSAPP_GIFT_LANGUAGE;
    post
      .mockRejectedValueOnce({
        response: {
          data: {
            error: {
              message: 'Template name does not exist in the translation',
              code: 132001,
            },
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          messages: [{ id: 'wamid.test.456' }],
        },
      });

    const result = await provider.sendGiftInvite(
      '+966500000000',
      {
        senderName: 'Ahmed',
        productTitle: 'Monthly Subscription',
        branchName: 'Riyadh Branch',
        claimUrl: 'https://example.com/gift/claim?token=abc',
      },
      'ar',
    );

    expect(result).toEqual({
      success: true,
      messageId: 'wamid.test.456',
    });
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0][1].template.language.code).toBe('ar');
    expect(post.mock.calls[1][1].template.language.code).toBe('ar_SA');
  });
});
