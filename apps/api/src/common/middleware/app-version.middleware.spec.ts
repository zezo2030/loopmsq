import { AppVersionMiddleware } from './app-version.middleware';

describe('AppVersionMiddleware', () => {
  const fullConfig = {
    enabled: true,
    serverEnforced: true,
    blockLegacy: true,
    minRequiredVersionAndroid: '2.0.0',
    minRequiredVersionIos: '2.0.0',
    androidStoreUrl: 'https://play.google.com/store/apps/details?id=x',
    iosStoreUrl: 'https://apps.apple.com/app/id1',
    message: 'please update',
  };

  function build(cfg: Partial<typeof fullConfig> = {}) {
    const adminConfig = {
      getAppVersionConfig: jest.fn(async () => ({ ...fullConfig, ...cfg })),
    };
    const config = { get: jest.fn(() => 'api/v1') };
    const mw = new AppVersionMiddleware(adminConfig as any, config as any);
    return { mw, adminConfig };
  }

  function run(
    mw: AppVersionMiddleware,
    {
      url = '/api/v1/home',
      headers = {},
    }: { url?: string; headers?: Record<string, string> } = {},
  ) {
    const req = { originalUrl: url, url, headers } as any;
    const json = jest.fn();
    const res = { status: jest.fn(() => ({ json })) } as any;
    const next = jest.fn();
    return { promise: mw.use(req, res, next), res, next, json };
  }

  describe('isVersionBelow', () => {
    it.each([
      ['1.0.0', '2.0.0', true],
      ['1.9.9', '2.0.0', true],
      ['2.0.0', '2.0.0', false],
      ['2.0.1', '2.0.0', false],
      ['3.0.0', '2.0.0', false],
      ['2.0.0+15', '2.0.0', false], // build suffix ignored
      ['2', '2.0.0', false], // missing segments default to 0
      ['1', '2.0.0', true],
    ])('isVersionBelow(%s, %s) -> %s', (cur, min, expected) => {
      expect(AppVersionMiddleware.isVersionBelow(cur, min)).toBe(expected);
    });
  });

  it('passes through when serverEnforced is off', async () => {
    const { mw } = build({ serverEnforced: false });
    const { promise, next, res } = run(mw, {
      headers: { 'x-app-name': 'customer', 'x-app-version': '1.0.0' },
    });
    await promise;
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks an outdated customer build with 426', async () => {
    const { mw } = build();
    const { promise, next, res, json } = run(mw, {
      headers: {
        'x-app-name': 'customer',
        'x-app-version': '1.0.0',
        'x-app-platform': 'android',
      },
    });
    await promise;
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(426);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'UPGRADE_REQUIRED',
        minRequiredVersion: '2.0.0',
        storeUrl: fullConfig.androidStoreUrl,
      }),
    );
  });

  it('allows an up-to-date customer build', async () => {
    const { mw } = build();
    const { promise, next, res } = run(mw, {
      headers: { 'x-app-name': 'customer', 'x-app-version': '2.1.0' },
    });
    await promise;
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('ignores the staff app regardless of version', async () => {
    const { mw } = build();
    const { promise, next, res } = run(mw, {
      headers: { 'x-app-name': 'staff' },
    });
    await promise;
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('ignores browser requests (Origin present) with no app-name', async () => {
    const { mw } = build();
    const { promise, next, res } = run(mw, {
      headers: { origin: 'https://admin.example.com', 'user-agent': 'Mozilla/5.0' },
    });
    await promise;
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('ignores non-Dart server-to-server callers with no app-name', async () => {
    const { mw } = build();
    const { promise, next, res } = run(mw, {
      headers: { 'user-agent': 'curl/8.0' },
    });
    await promise;
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks a legacy native (Dart) client with no app-name when blockLegacy is on', async () => {
    const { mw } = build();
    const { promise, next, res } = run(mw, {
      headers: { 'user-agent': 'Dart/3.4 (dart:io)' },
    });
    await promise;
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(426);
  });

  it('allows a legacy native client when blockLegacy is off', async () => {
    const { mw } = build({ blockLegacy: false });
    const { promise, next, res } = run(mw, {
      headers: { 'user-agent': 'Dart/3.4 (dart:io)' },
    });
    await promise;
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it.each([
    '/api/v1/app/version',
    '/api/v1/payments/webhook',
    '/api/v1/payments/success',
    '/api/v1/admin/config/app-version',
    '/uploads/x.png',
  ])('always allows excluded path %s', async (url) => {
    const { mw } = build();
    const { promise, next, res } = run(mw, {
      url,
      headers: { 'x-app-name': 'customer', 'x-app-version': '1.0.0' },
    });
    await promise;
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('fails open if the config store throws', async () => {
    const { mw, adminConfig } = build();
    adminConfig.getAppVersionConfig.mockRejectedValueOnce(new Error('redis down'));
    const { promise, next, res } = run(mw, {
      headers: { 'x-app-name': 'customer', 'x-app-version': '1.0.0' },
    });
    await promise;
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
