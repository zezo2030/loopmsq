import { AdminConfigService } from './admin-config.service';

describe('AdminConfigService', () => {
  const redisStore = new Map<string, unknown>();
  const redis = {
    get: jest.fn(async (key: string) => redisStore.get(key) ?? null),
    set: jest.fn(async (key: string, value: unknown) => {
      redisStore.set(key, value);
      return 'OK';
    }),
  };
  const encryption = {
    encrypt: jest.fn((value: string) => `enc:${value}`),
  };
  const notifications = {
    enqueue: jest.fn(),
  };

  let service: AdminConfigService;

  beforeEach(() => {
    redisStore.clear();
    jest.clearAllMocks();
    service = new AdminConfigService(
      redis as any,
      encryption as any,
      notifications as any,
    );
  });

  it('returns default private event terms when none are stored', async () => {
    const result = await service.getPrivateEventTermsConfig();

    expect(result.terms).toEqual(
      AdminConfigService.DEFAULT_PRIVATE_EVENT_TERMS,
    );
  });

  it('stores sanitized private event terms', async () => {
    const result = await service.updatePrivateEventTermsConfig({
      terms: [
        '  \u0627\u0644\u0628\u0646\u062f \u0627\u0644\u0623\u0648\u0644  ',
        '',
        '\u0627\u0644\u0628\u0646\u062f \u0627\u0644\u062b\u0627\u0646\u064a',
        '   ',
      ],
    });

    expect(result.terms).toEqual([
      '\u0627\u0644\u0628\u0646\u062f \u0627\u0644\u0623\u0648\u0644',
      '\u0627\u0644\u0628\u0646\u062f \u0627\u0644\u062b\u0627\u0646\u064a',
    ]);
    expect(redis.set).toHaveBeenCalled();
  });
});
